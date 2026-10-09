import { analyze, plural } from '../src/lib/analyze.js';
import { isWebUrl } from '../src/lib/domain.js';
import { CATEGORIES } from '../src/lib/trackers.js';
import { reportUrl } from '../src/config.js';
import { analyzePolicy } from '../src/lib/policy.js';
import { collectEvidence } from '../src/lib/complaint.js';

const app = document.getElementById('app');
const live = document.getElementById('live');

let tabId = null;
let pageUrl = '';
let lastJson = '';
let activeTab = 'collects';
let currentSite = '';
let lastData = null;
// Privacy-policy reading state for the current site.
let policy = { status: 'idle', site: '', url: '', text: '', error: '', cacheChecked: false };
const open = new Set(); // keys of expanded rows, kept across live refreshes

// ---- Tiny safe templating ----------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const html = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? (values[i]?.__raw ?? esc(values[i])) : ''), '');
const raw = (s) => ({ __raw: s });
const each = (list, fn) => raw(list.map(fn).join(''));

const ICONS = {
  cursor: '<path d="M5 3l6 16 2.2-6.8L20 10z"/><path d="M13.2 12.2L19 18"/>',
  fingerprint: '<path d="M7 11a5 5 0 0 1 10 0v2"/><path d="M4 9a8.5 8.5 0 0 1 16 0"/><path d="M12 11v4a6 6 0 0 1-1.5 4"/><path d="M8.5 13v1a9 9 0 0 1-1.6 5"/><path d="M15.5 15.5a10 10 0 0 1-1.2 4.5"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  camera: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h4"/>',
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  dash: '<path d="M7 12h10"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.2v.3"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>'
};
const icon = (name, cls = 'icon') =>
  raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`);

const STATUS = {
  seen: { label: 'Seen', title: 'We saw this happen on this page' },
  likely: { label: 'Likely', title: 'Based on what the companies on this page are known to do' },
  asked: { label: 'Asked', title: 'The page asks you to enter this' }
};

// ---- Data ------------------------------------------------------------------
async function resolveTab() {
  const param = new URLSearchParams(location.search).get('tabId');
  if (param) {
    tabId = Number(param);
    document.body.classList.add('page');
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  pageUrl = tab?.url || '';
}

async function load() {
  const state = tabId == null ? null : await chrome.runtime.sendMessage({ type: 'syd:getTab', tabId });
  const url = state?.url || pageUrl;
  if (!isWebUrl(url)) return { empty: true };
  let firstPartyCookies;
  try {
    firstPartyCookies = (await chrome.cookies.getAll({ url })).length;
  } catch { /* cookies API unavailable */ }
  return { report: analyze({ ...state, url, firstPartyCookies }), startedAt: state?.startedAt, partial: !state || !!state.partial };
}

async function refresh() {
  let data;
  try { data = await load(); } catch (e) { data = { error: e.message }; }
  const json = JSON.stringify(data);
  if (json === lastJson) return;
  lastJson = json;
  lastData = data;
  render(data);
}

function rerender() {
  if (lastData) render(lastData);
}

// ---- Rendering -------------------------------------------------------------
function render(data) {
  if (data.error) {
    app.innerHTML = html`<section class="empty"><h1>Couldn’t read this tab</h1><p>${data.error}</p><p>Reload the page and open SeeYourData again.</p></section>`;
    return;
  }
  if (data.empty) {
    live.hidden = true;
    app.innerHTML = html`<section class="empty">${icon('shield', 'empty-icon')}<h1>Open a website to see what it collects</h1><p>SeeYourData checks regular web pages. Browser pages like this one don’t send your data anywhere.</p></section>`;
    return;
  }
  // Keep keyboard focus where it was across live refreshes.
  const focused = document.activeElement;
  const focusSel = focused?.dataset?.tab ? `[data-tab="${focused.dataset.tab}"]`
    : focused?.parentElement?.dataset?.key ? `details[data-key="${CSS.escape(focused.parentElement.dataset.key)}"] > summary` : null;
  const scroll = document.scrollingElement.scrollTop;

  const r = data.report;
  currentSite = r.site;
  if (policy.site !== r.site) policy = { status: 'idle', site: r.site, url: '', text: '', error: '', cacheChecked: false };
  if (!policy.cacheChecked && r.policyUrl) checkPolicyCache(r.policyUrl);
  const fresh = data.startedAt && Date.now() - data.startedAt < 15000;
  live.hidden = !fresh;

  app.innerHTML = html`
    <section class="verdict level-${r.level}">
      <div class="grade" aria-label="Privacy grade ${r.grade}">${r.grade}</div>
      <div class="verdict-text">
        <p class="site" title="${r.url}">${hostOf(r.url)}</p>
        <h1>${r.levelLabel}</h1>
        <p class="headline">${r.headline}</p>
      </div>
      <div class="meter" role="img" aria-label="Score ${r.score} out of 100">
        ${each(['A', 'B', 'C', 'D', 'F'], (g) => `<span class="seg${g === r.grade ? ' on' : ''}">${g}</span>`)}
      </div>
    </section>

    ${data.partial ? raw(html`<p class="notice">This tab was open before SeeYourData started watching it. <button type="button" id="reload">Reload the page</button> for a complete report.</p>`) : raw('')}

    <nav class="tabs" role="tablist">
      ${tabButton('collects', 'Your data', r.kinds.length)}
      ${tabButton('companies', 'Who gets it', r.companies.length + r.unknown.length)}
      ${tabButton('policy', 'Policy')}
      ${tabButton('details', 'Details')}
    </nav>

    <section class="panel" id="panel-collects" role="tabpanel" ${raw(activeTab === 'collects' ? '' : 'hidden')}>
      ${r.kinds.length ? each(r.kinds, kindRow) : raw(html`<p class="none">Nothing found yet. This page hasn’t contacted any trackers, asked for personal details or used fingerprinting features.</p>`)}
    </section>

    <section class="panel" id="panel-companies" role="tabpanel" ${raw(activeTab === 'companies' ? '' : 'hidden')}>
      ${r.companies.length ? each(r.companies, companyRow) : raw('')}
      ${r.unknown.length ? raw(unknownBlock(r.unknown)) : raw('')}
      ${!r.companies.length && !r.unknown.length ? raw('<p class="none">This page only talks to its own servers.</p>') : raw('')}
    </section>

    <section class="panel" id="panel-policy" role="tabpanel" ${raw(activeTab === 'policy' ? '' : 'hidden')}>
      ${raw(policyPanel(r))}
    </section>

    <section class="panel" id="panel-details" role="tabpanel" ${raw(activeTab === 'details' ? '' : 'hidden')}>
      ${raw(detailsPanel(r))}
    </section>

    <footer class="foot">
      ${r.policyUrl
        ? raw(html`<a class="policy" href="${r.policyUrl}" target="_blank" rel="noopener noreferrer">${icon('external')}Read ${r.site}’s privacy policy</a>`)
        : raw('<span class="policy missing">No privacy policy link found on this page</span>')}
      <p class="limits">Based on what this page did in your browser. What a site does with your data on its own servers can’t be seen from here.</p>
    </footer>
  `;
  wire();
  document.scrollingElement.scrollTop = scroll;
  if (focusSel) app.querySelector(focusSel)?.focus();
}

function tabButton(id, label, count) {
  return raw(html`<button role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${activeTab === id}" data-tab="${id}">${label}${count != null ? raw(html`<span class="count">${count}</span>`) : ''}</button>`);
}

function kindRow(k) {
  const key = 'k:' + k.id;
  const s = STATUS[k.status];
  return html`
    <details class="row sev-${k.severity}" data-key="${key}" ${raw(open.has(key) ? 'open' : '')}>
      <summary>
        <span class="row-icon">${icon(k.icon)}</span>
        <span class="row-title">${k.title}</span>
        <span class="status status-${k.status}" title="${s.title}">${s.label}</span>
        ${icon('chevron', 'icon chev')}
      </summary>
      <div class="row-body">
        <ul class="evidence">${each(k.evidence, (e) => html`<li>${e}</li>`)}</ul>
        ${k.recipients.length ? raw(html`<div class="chips" aria-label="Companies">${each(k.recipients, (n) => html`<span class="chip">${n}</span>`)}</div>`) : raw('')}
      </div>
    </details>`;
}

function companyRow(c) {
  const key = 'c:' + c.name;
  const reportDomain = c.domains[0] || c.selfHosted[0];
  const main = c.categories.reduce((a, b) => (CATEGORIES[b].weight > CATEGORIES[a].weight ? b : a));
  return html`
    <details class="row company cat-${main}" data-key="${key}" ${raw(open.has(key) ? 'open' : '')}>
      <summary>
        <span class="avatar" aria-hidden="true">${c.name.slice(0, 1)}</span>
        <span class="row-title">${c.name}<small>${c.categoryLabels.join(', ')}${c.selfHosted.length ? ', hidden in the site' : ''}</small></span>
        <span class="req" title="Requests from this page">${c.requests}</span>
        ${icon('chevron', 'icon chev')}
      </summary>
      <div class="row-body">
        <p class="about">${c.about}</p>
        ${c.selfHosted.length ? raw(html`<p class="hidden-note">${icon('eye')}<span>${c.name}’s code is loaded from an address that isn’t ${c.name}’s own, so it looks like part of the site and is harder for ad blockers to spot.</span></p>`) : raw('')}
        <dl class="facts">
          ${c.domains.length ? raw(html`<dt>Servers contacted</dt><dd>${c.domains.join(', ')}</dd>`) : raw('')}
          ${c.selfHosted.length ? raw(html`<dt>Loaded from</dt><dd>${c.selfHosted.join(', ')}</dd>`) : raw('')}
          <dt>Set cookies</dt><dd>${c.setsCookies ? 'Yes' : 'No'}</dd>
        </dl>
        <a class="report" href="${reportUrl({ domain: reportDomain, seenOn: currentSite, company: c.name })}" target="_blank" rel="noopener noreferrer">Something wrong here? Suggest a correction</a>
      </div>
    </details>`;
}

function unknownBlock(list) {
  const key = 'unknown';
  return html`
    <details class="row unknown" data-key="${key}" ${raw(open.has(key) ? 'open' : '')}>
      <summary>
        <span class="avatar" aria-hidden="true">?</span>
        <span class="row-title">${plural(list.length, 'other server')}<small>Not in our tracker list</small></span>
        <span class="req">${list.reduce((s, u) => s + u.requests, 0)}</span>
        ${icon('chevron', 'icon chev')}
      </summary>
      <div class="row-body">
        <p class="about">Often the site’s own CDNs or services. Each one still sees your IP address. Spot a tracker? Report it and it can be added for everyone. You’ll review the form on GitHub before anything is sent.</p>
        <ul class="hosts">${each(list, (u) => html`<li><span class="host">${u.host}<small class="muted">${u.requests} req${u.setsCookies ? ', sets a cookie' : ''}</small></span><a class="report-btn" href="${reportUrl({ domain: u.host, seenOn: currentSite })}" target="_blank" rel="noopener noreferrer" title="Suggest ${u.host} for the tracker list on GitHub" aria-label="Report ${u.host} as a tracker">Report</a></li>`)}</ul>
      </div>
    </details>`;
}

function detailsPanel(r) {
  const s = r.stats;
  const stat = (n, label) => html`<div class="stat"><b>${n}</b><span>${label}</span></div>`;
  return html`
    <div class="stats">
      ${raw(stat(r.score, 'Score out of 100'))}
      ${raw(stat(s.requests, 'Requests made'))}
      ${raw(stat(s.thirdPartySites, 'Other websites contacted'))}
      ${raw(stat(s.cookieSetters, 'Servers that set cookies'))}
      ${raw(stat(s.firstPartyCookies, `Cookies kept by ${r.site}`))}
      ${raw(stat(s.localStorage + s.sessionStorage, 'Items in site storage'))}
    </div>
    <h2>How the grade works</h2>
    <p class="explain">Every page starts at 100. Points come off for each tracking company (session recording and fingerprinting cost the most), for unknown outside servers, for tracking cookies, and for fingerprinting or location features the page actually used.</p>
    <h2>What “Seen”, “Likely” and “Asked” mean</h2>
    <ul class="legend">
      <li><span class="status status-seen">Seen</span>We watched it happen in your browser on this page.</li>
      <li><span class="status status-likely">Likely</span>A company on this page is known to collect it.</li>
      <li><span class="status status-asked">Asked</span>The page has a form field for it.</li>
    </ul>
  `;
}

function wire() {
  app.querySelector('#reload')?.addEventListener('click', () => chrome.tabs.reload(tabId));
  for (const b of app.querySelectorAll('[data-action]')) {
    b.addEventListener('click', () => {
      const r = lastData?.report;
      if (!r) return;
      if (b.dataset.action === 'read-policy') readPolicy(r.policyUrl, false);
      if (b.dataset.action === 'read-page') readPolicy(r.url, true);
      if (b.dataset.action === 'email-site') openEmailDraft(r);
      if (b.dataset.action === 'policy-reset') { policy = { ...policy, status: 'idle', text: '', error: '' }; rerender(); }
    });
  }
  for (const b of app.querySelectorAll('[data-tab]')) {
    b.addEventListener('click', () => {
      activeTab = b.dataset.tab;
      for (const t of app.querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', String(t === b));
      for (const p of app.querySelectorAll('.panel')) p.hidden = p.id !== 'panel-' + activeTab;
    });
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const all = [...app.querySelectorAll('[data-tab]')];
      const next = all[(all.indexOf(b) + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      next.focus();
      next.click();
    });
  }
  for (const d of app.querySelectorAll('details[data-key]')) {
    d.addEventListener('toggle', () => (d.open ? open.add(d.dataset.key) : open.delete(d.dataset.key)));
  }
}


// ---- Privacy policy --------------------------------------------------------------
// The policy is downloaded from the site itself (without cookies) and read here,
// on this computer. Nothing is sent anywhere else.

const cacheKey = (url) => 'policy:' + url;

async function checkPolicyCache(url) {
  policy.cacheChecked = true;
  try {
    const hit = (await chrome.storage.session.get(cacheKey(url)))[cacheKey(url)];
    if (hit?.text && policy.status === 'idle') {
      policy = { ...policy, status: 'done', url, text: hit.text };
      rerender();
    }
  } catch { /* no cache */ }
}

function htmlToText(source) {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  doc.querySelectorAll('script, style, noscript, svg, iframe, template, nav, form, button, [aria-hidden="true"]').forEach((e) => e.remove());
  const candidates = [...doc.querySelectorAll('main, article, [role="main"]')];
  const best = candidates.sort((a, b) => b.textContent.length - a.textContent.length)[0];
  const root = best && best.textContent.trim().length > 1500 ? best : doc.body;
  if (!root) return '';
  root.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, div, br, tr, section, dd, dt, td').forEach((e) => e.append(doc.createTextNode('\n')));
  return (root.textContent || '').replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

const wordCount = (t) => (t.match(/\S+/g) || []).length;

async function textFromTab(id) {
  const res = await chrome.tabs.sendMessage(id, { type: 'syd:getText' });
  return res?.text || '';
}

// Some policies are built by JavaScript, so a plain download is nearly empty.
// Then open the policy in a background tab, take its text, and close it.
async function textViaBackgroundTab(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await new Promise((resolve) => {
      const timer = setTimeout(done, 20000);
      function done() {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
      function onUpdated(id, info) {
        if (id === tab.id && info.status === 'complete') done();
      }
      chrome.tabs.onUpdated.addListener(onUpdated);
    });
    await new Promise((r) => setTimeout(r, 1500));
    return await textFromTab(tab.id);
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function readPolicy(url, fromThisPage) {
  if (!url) return;
  policy = { ...policy, status: 'loading', url, error: '' };
  rerender();
  try {
    let text = '';
    if (fromThisPage) {
      text = await textFromTab(tabId);
    } else {
      const res = await fetch(url, { credentials: 'omit', redirect: 'follow' });
      if (!res.ok) throw new Error(`The site answered with an error (${res.status}).`);
      const type = res.headers.get('content-type') || '';
      if (/pdf/i.test(type)) throw new Error('This privacy policy is a PDF, which SeeYourData can’t read yet. Open it to read it yourself.');
      text = /html|xml/i.test(type) || !type ? htmlToText(await res.text()) : await res.text();
      if (wordCount(text) < 300) {
        const fromTab = await textViaBackgroundTab(url).catch(() => '');
        if (wordCount(fromTab) > wordCount(text)) text = fromTab;
      }
    }
    if (wordCount(text) < 40) throw new Error('The page came back almost empty, so there was nothing to read.');
    text = text.slice(0, 400000);
    policy = { ...policy, status: 'done', url, text };
    chrome.storage.session.set({ [cacheKey(url)]: { text, at: Date.now() } }).catch(() => {});
  } catch (e) {
    const message = /Receiving end does not exist|Could not establish connection/i.test(e.message)
      ? 'This page can’t be read yet. Reload it and try again.'
      : /Failed to fetch|NetworkError/i.test(e.message)
        ? 'The policy couldn’t be downloaded. Check your connection, or open the policy and use “Read this page”.'
        : e.message;
    policy = { ...policy, status: 'error', error: message };
  }
  rerender();
}

function policyPanel(r) {
  const onPolicyPage = r.policyUrl && stripHash(r.policyUrl) === stripHash(r.url);
  const readButtons = r.policyUrl && !onPolicyPage
    ? html`<button type="button" class="btn primary" data-action="read-policy">Read the privacy policy</button>
           <button type="button" class="btn link" data-action="read-page">This page is the policy? Read this page</button>`
    : html`<button type="button" class="btn primary" data-action="read-page">${onPolicyPage ? 'Read this privacy policy' : 'Read this page as the policy'}</button>`;

  if (policy.status === 'loading') {
    return html`<div class="pol-intro"><p class="pol-loading"><span class="spinner" aria-hidden="true"></span>Reading the privacy policy…</p></div>`;
  }
  if (policy.status === 'error') {
    return html`<div class="pol-intro">${icon('alert', 'pol-intro-icon warn')}<h2>Couldn’t read the policy</h2><p>${policy.error}</p><div class="btns">${raw(readButtons)}</div></div>`;
  }
  if (policy.status !== 'done') {
    return html`<div class="pol-intro">
      ${icon('doc', 'pol-intro-icon')}
      <h2>What does ${r.site}’s privacy policy say?</h2>
      ${r.policyUrl || onPolicyPage
        ? raw(html`<p>SeeYourData will download the policy and read it on your computer. You’ll see what it says about your data, and anything this page does that the policy leaves out. Nothing is sent anywhere else.</p>`)
        : raw(html`<p>There’s no privacy policy link on this page. Open the site’s privacy policy (often linked at the bottom of the home page), then come back here.</p>`)}
      <div class="btns">${raw(readButtons)}</div>
    </div>`;
  }

  const a = analyzePolicy(policy.text, { companies: r.companies, kinds: r.kinds });
  const meta = [`About ${a.minutes} minute${a.minutes === 1 ? '' : 's'} to read.`, a.updated ? `Last updated ${a.updated}.` : 'No date of last update found.'];

  return html`
    <section class="pol-summary rating-${a.rating}">
      <div class="pol-score" aria-label="${a.covered} of ${a.total}"><b>${a.covered}</b><span>/${a.total}</span></div>
      <div class="pol-summary-text">
        <h2>Covers ${a.covered} of ${a.total} things GDPR says a privacy notice must tell you</h2>
        <p>${meta.join(' ')}</p>
        <a href="${policy.url}" target="_blank" rel="noopener noreferrer">${icon('external')}Open the policy</a>
      </div>
    </section>

    ${a.tooShort || !a.looksLikePolicy ? raw(html`<p class="notice">This doesn’t look like a full privacy policy, so the results may be incomplete. If the real policy is on another page, open it and use “Read this page”.</p>`) : raw('')}

    ${a.gaps.length ? raw(html`<section class="pol-gaps">
      <h3>${icon('alert')}On this page, but not in the policy</h3>
      <ul>${each(a.gaps, (g) => html`<li>${g.text}</li>`)}</ul>
      <p class="fine">The policy might still cover these with general wording such as “our partners”.</p>
      <button type="button" class="btn primary email-btn" data-action="email-site">${icon('mail')}Email ${r.site} about this</button>
    </section>`) : raw('')}

    ${raw(policyGroup('What they say they collect', 'pd', a.data))}
    ${raw(policyGroup('Why they use it', 'pp', a.purposes))}
    ${raw(policyGroup('Legal reasons they give', 'pb', a.bases))}
    ${raw(policyGroup('Your rights they explain', 'pr', a.rights))}
    ${raw(policyGroup('What a GDPR notice must include', 'pc', a.checklist.map((c) => ({ ...c, label: c.optional ? c.label + ' (not always required)' : c.label }))))}

    <h3 class="pol-h">Companies the policy names</h3>
    ${a.named.length
      ? raw(html`<div class="chips">${each(a.named, (n) => html`<span class="chip">${n}</span>`)}</div>`)
      : raw('<p class="fine">It doesn’t name any of the tracking companies SeeYourData knows.</p>')}

    <p class="limits">Read automatically by looking for key words in English, German and Turkish. It can miss or misread things, and it isn’t legal advice. Tap a line to see the sentence it’s based on.</p>
    <button type="button" class="btn link" data-action="policy-reset">Read a different page</button>
  `;
}

// Prepares the evidence and opens the email draft page in a new tab.
async function openEmailDraft(r) {
  const analysis = analyzePolicy(policy.text, { companies: r.companies, kinds: r.kinds });
  const evidence = collectEvidence({ report: r, analysis, policyText: policy.text, policyUrl: policy.url, observedAt: lastData?.startedAt || Date.now() });
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await chrome.storage.session.set({ ['draft:' + id]: evidence });
  chrome.tabs.create({ url: chrome.runtime.getURL('popup/compose.html?id=' + id) });
}

function policyGroup(title, prefix, items) {
  const sorted = [...items].sort((x, y) => (y.found ? 1 : 0) - (x.found ? 1 : 0));
  return html`<h3 class="pol-h">${title}</h3><div class="pol-list">${each(sorted, (it) => policyItem(prefix, it))}</div>`;
}

function policyItem(prefix, it) {
  const key = prefix + ':' + it.id;
  const state = it.found ? (it.warn || it.sensitive ? 'warn' : 'yes') : it.denied ? 'denied' : 'no';
  const mark = state === 'no' ? icon('dash') : state === 'warn' ? icon('alert') : icon('check');
  const note = state === 'no' ? 'Not mentioned' : state === 'denied' ? 'Says it doesn’t' : '';
  if (!it.quote) {
    return html`<div class="pi pi-${state}"><span class="pi-mark">${mark}</span><span class="pi-label">${it.label}</span>${note ? raw(html`<span class="pi-note">${note}</span>`) : ''}</div>`;
  }
  return html`<details class="pi pi-${state}" data-key="${key}" ${raw(open.has(key) ? 'open' : '')}>
    <summary><span class="pi-mark">${mark}</span><span class="pi-label">${it.label}</span>${note ? raw(html`<span class="pi-note">${note}</span>`) : ''}</summary>
    <blockquote>${it.quote}</blockquote>
  </details>`;
}

function stripHash(u) {
  try { const x = new URL(u); x.hash = ''; return x.href.replace(/\/$/, ''); } catch { return u; }
}

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

// ---- Start -------------------------------------------------------------------
await resolveTab();
await refresh();
setInterval(refresh, 1500);
