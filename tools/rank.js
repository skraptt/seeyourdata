#!/usr/bin/env node
// Ranks the outside servers found by tools/crawl.py.
//
//   node tools/rank.js crawl-out/crawl.jsonl [more.jsonl ...] [--top 150] [--min-sites 2]
//
// Writes next to the first input file:
//   candidates.md   the unknown servers, most widespread first, each with a
//                   ready-to-edit trackers.js line and hints about what it does
//   candidates.csv  every outside server (known and unknown), for spreadsheets
//
// It also prints how much of the crawl's outside traffic the current tracker
// list already recognises, so you can see the list improve over time.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getHost, getSite } from '../src/lib/domain.js';
import { lookupTracker } from '../src/lib/trackers.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  if (i === -1) return def;
  const v = Number(args[i + 1]);
  args.splice(i, 2);
  return v;
};
const TOP = opt('--top', 150);
const MIN_SITES = opt('--min-sites', 2);
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('Usage: node tools/rank.js crawl-out/crawl.jsonl [--top 150] [--min-sites 2]');
  process.exit(1);
}

// Path fragments that usually mean tracking, and the category they hint at.
const PATH_HINTS = [
  [/pixel|\/tr\b|\/p\.gif|\/1x1|\/b\.gif|\/t\.gif|beacon|\/imp\b|impression/i, 'advertising'],
  [/sync|match|cookie-?sync|usersync|\/setuid|\/getuid|\/cm\b|\/rtb|bid|prebid|\/ads?\b|adserver|\/gampad/i, 'advertising'],
  [/collect|analytics|\/track|\/event|\/stats|\/metrics|\/log\b|\/hit\b|\/g\/collect/i, 'analytics'],
  [/record|session|replay|heatmap/i, 'session-replay'],
  [/fingerprint|\/fp\b|\/device|\/bot|captcha|challenge/i, 'fingerprinting'],
  [/consent|cmp|gdpr|tcf/i, 'consent'],
  [/chat|widget|messenger|livechat/i, 'customer'],
  [/\.woff2?$|\/fonts?\//i, 'content']
];

const sites = new Map(); // registrable site of the outside server -> aggregate
let pagesOk = 0;
let pagesFailed = 0;
let thirdPartyRequests = 0;
let knownRequests = 0;

for (const file of files) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (!rec.ok) { pagesFailed++; continue; }
    pagesOk++;
    const firstParty = getSite(getHost(rec.finalUrl || rec.url));

    const apiBySite = {};
    for (const [api, sources] of Object.entries(rec.apis || {})) {
      for (const src of sources) {
        const s = getSite(src);
        if (s && s !== firstParty) (apiBySite[s] ||= new Set()).add(api);
      }
    }

    const seenHere = new Set();
    for (const [host, info] of Object.entries(rec.hosts || {})) {
      const site = getSite(host);
      if (!site || site === firstParty) continue;
      thirdPartyRequests += info.count || 0;
      const known = lookupTracker(host);
      if (known) knownRequests += info.count || 0;

      let s = sites.get(site);
      if (!s) {
        s = { site, pages: 0, cookiePages: 0, requests: 0, hosts: new Set(), types: {}, paths: new Set(), apis: new Set(), examples: [], known: null };
        sites.set(site, s);
      }
      if (!seenHere.has(site)) {
        seenHere.add(site);
        s.pages++;
        if (s.examples.length < 5) s.examples.push(firstParty);
      }
      if (info.cookies && !s._cookieSeen?.has(firstParty)) {
        (s._cookieSeen ||= new Set()).add(firstParty);
        s.cookiePages++;
      }
      s.requests += info.count || 0;
      s.hosts.add(host);
      for (const [t, n] of Object.entries(info.types || {})) s.types[t] = (s.types[t] || 0) + n;
      for (const p of info.paths || []) if (s.paths.size < 8) s.paths.add(p);
      if (known && !s.known) s.known = known;
    }
    for (const [site, apis] of Object.entries(apiBySite)) {
      const s = sites.get(site);
      if (s) for (const a of apis) s.apis.add(a);
    }
  }
}

function hint(s) {
  if (s.apis.size >= 2 || s.apis.has('canvas') || s.apis.has('audio')) return 'fingerprinting';
  const votes = {};
  for (const p of s.paths) {
    for (const [re, cat] of PATH_HINTS) if (re.test(p)) { votes[cat] = (votes[cat] || 0) + 1; break; }
  }
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (best) return best[0];
  if (s.cookiePages / s.pages > 0.5 && (s.types.image || s.types.ping || s.types.xhr)) return 'advertising';
  const total = Object.values(s.types).reduce((a, b) => a + b, 0) || 1;
  if (((s.types.font || 0) + (s.types.stylesheet || 0) + (s.types.media || 0)) / total > 0.6) return 'content';
  return '';
}

const all = [...sites.values()].sort((a, b) => b.pages - a.pages || b.requests - a.requests);
const unknown = all.filter((s) => !s.known && s.pages >= MIN_SITES).slice(0, TOP);

// ---- CSV of everything
const csvEsc = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = [['site', 'pages', 'share_of_pages', 'requests', 'sets_cookies_on', 'known_company', 'known_category', 'suggested_category', 'hosts', 'fingerprinting_apis', 'resource_types', 'sample_paths', 'example_pages'].join(',')];
for (const s of all) {
  csv.push([
    s.site, s.pages, (s.pages / pagesOk).toFixed(3), s.requests, s.cookiePages,
    s.known?.company || '', s.known?.category || '', s.known ? '' : hint(s),
    [...s.hosts].join(' '), [...s.apis].join(' '),
    Object.entries(s.types).map(([t, n]) => `${t}:${n}`).join(' '),
    [...s.paths].join(' '), s.examples.join(' ')
  ].map(csvEsc).join(','));
}

// ---- Markdown worklist of unknown servers
const pct = (n) => `${Math.round((n / pagesOk) * 100)}%`;
const md = [
  '# Tracker candidates',
  '',
  `Crawled ${pagesOk} pages (${pagesFailed} failed). The current tracker list recognises ${pct2(knownRequests, thirdPartyRequests)} of all requests to outside servers.`,
  '',
  `Below are the ${unknown.length} most widespread outside servers that are **not** in \`src/lib/trackers.js\` yet (seen on at least ${MIN_SITES} pages).`,
  'For each one: check who runs it and what it does, fix the company name and category, and paste the line into `TRACKERS`.',
  'The suggested category is only a guess from URL paths, cookies and fingerprinting behaviour. Delete lines that are the site\'s own infrastructure.',
  '',
  'Categories: advertising, session-replay, fingerprinting, social, analytics, customer, performance, consent, payments, content.',
  ''
];
for (const s of unknown) {
  const facts = [
    `on ${s.pages} pages (${pct(s.pages)})`,
    s.cookiePages ? `sets cookies on ${s.cookiePages}` : 'no cookies',
    s.apis.size ? `uses ${[...s.apis].join(', ')}` : '',
    `e.g. ${s.examples.slice(0, 3).join(', ')}`
  ].filter(Boolean).join(' · ');
  md.push(`## ${s.site}`);
  md.push(facts);
  md.push(`Hosts: ${[...s.hosts].slice(0, 6).join(', ')}${s.hosts.size > 6 ? ' …' : ''}`);
  if (s.paths.size) md.push(`Paths: \`${[...s.paths].slice(0, 4).join('` `')}\``);
  md.push('```js');
  md.push(`{ company: '${guessName(s.site)}', category: '${hint(s) || 'TODO'}', domains: ['${s.site}'] },`);
  md.push('```');
  md.push('');
}

function guessName(site) {
  const label = site.split('.')[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function pct2(a, b) {
  return b ? `${Math.round((a / b) * 100)}%` : 'n/a';
}

const outDir = dirname(files[0]);
writeFileSync(join(outDir, 'candidates.csv'), csv.join('\n') + '\n');
writeFileSync(join(outDir, 'candidates.md'), md.join('\n'));

console.log(`Pages crawled: ${pagesOk} ok, ${pagesFailed} failed`);
console.log(`Outside servers found: ${all.length} sites, ${all.filter((s) => s.known).length} already in the tracker list`);
console.log(`Tracker list coverage: ${pct2(knownRequests, thirdPartyRequests)} of outside requests`);
console.log(`Unknown servers on ${MIN_SITES}+ pages: ${all.filter((s) => !s.known && s.pages >= MIN_SITES).length}`);
console.log(`\nWrote ${join(outDir, 'candidates.md')} and candidates.csv`);
