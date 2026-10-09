import { analyze } from '../src/lib/analyze.js';
import { t, setLang, getLang, detectLang, LANG_NAMES } from '../src/lib/i18n.js';
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

const statusInfo = (s) => ({ label: t(`status.${s}`), title: t(`status.${s}.title`) });

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
    app.innerHTML = html`<section class="empty"><h1>${t('err.title')}</h1><p>${data.error}</p><p>${t('err.hint')}</p></section>`;
    return;
  }
  if (data.empty) {
    live.hidden = true;
    app.innerHTML = html`<section class="empty">${icon('shield', 'empty-icon')}<h1>${t('empty.title')}</h1><p>${t('empty.text')}</p></section>`;
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
      <div class="grade" aria-label="${t('gradeAria', { grade: r.grade })}">${r.grade}</div>
      <div class="verdict-text">
        <p class="site" title="${r.url}">${hostOf(r.url)}</p>
        <h1>${r.levelLabel}</h1>
        <p class="headline">${r.headline}</p>
      </div>
      <div class="meter" role="img" aria-label="${t('scoreAria', { score: r.score })}">
        ${each(['A', 'B', 'C', 'D', 'F'], (g) => `<span class="seg${g === r.grade ? ' on' : ''}">${g}</span>`)}
      </div>
    </section>

    ${data.partial ? raw(html`<p class="notice">${t('partial.before')}<button type="button" id="reload">${t('partial.button')}</button>${t('partial.after')}</p>`) : raw('')}

    <nav class="tabs" role="tablist">
      ${tabButton('collects', t('tab.collects'), r.kinds.length)}
      ${tabButton('companies', t('tab.companies'), r.companies.length + r.unknown.length)}
      ${tabButton('policy', t('tab.policy'))}
      ${tabButton('details', t('tab.details'))}
    </nav>

    <section class="panel" id="panel-collects" role="tabpanel" ${raw(activeTab === 'collects' ? '' : 'hidden')}>
      ${r.kinds.length ? each(r.kinds, kindRow) : raw(html`<p class="none">${t('none.kinds')}</p>`)}
    </section>

    <section class="panel" id="panel-companies" role="tabpanel" ${raw(activeTab === 'companies' ? '' : 'hidden')}>
      ${r.companies.length ? each(r.companies, companyRow) : raw('')}
      ${r.unknown.length ? raw(unknownBlock(r.unknown)) : raw('')}
      ${!r.companies.length && !r.unknown.length ? raw(html`<p class="none">${t('none.companies')}</p>`) : raw('')}
    </section>

    <section class="panel" id="panel-policy" role="tabpanel" ${raw(activeTab === 'policy' ? '' : 'hidden')}>
      ${raw(policyPanel(r))}
    </section>

    <section class="panel" id="panel-details" role="tabpanel" ${raw(activeTab === 'details' ? '' : 'hidden')}>
      ${raw(detailsPanel(r))}
    </section>

    <footer class="foot">
      ${r.policyUrl
        ? raw(html`<a class="policy" href="${r.policyUrl}" target="_blank" rel="noopener noreferrer">${icon('external')}${t('foot.policy', { site: r.site })}</a>`)
        : raw(html`<span class="policy missing">${t('foot.noPolicy')}</span>`)}
      <p class="limits">${t('foot.limits')}</p>
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
  const s = statusInfo(k.status);
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
        ${k.recipients.length ? raw(html`<div class="chips" aria-label="${t('companies')}">${each(k.recipients, (n) => html`<span class="chip">${n}</span>`)}</div>`) : raw('')}
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
        <span class="row-title">${c.name}<small>${c.categoryLabels.join(', ')}${c.selfHosted.length ? t('company.hiddenSuffix') : ''}</small></span>
        <span class="req" title="${t('req.title')}">${c.requests} ${t('req')}</span>
        ${icon('chevron', 'icon chev')}
      </summary>
      <div class="row-body">
        <p class="about">${c.about}</p>
        ${c.selfHosted.length ? raw(html`<p class="hidden-note">${icon('eye')}<span>${t('company.hidden', { name: c.name })}</span></p>`) : raw('')}
        <dl class="facts">
          ${c.domains.length ? raw(html`<dt>${t('company.servers')}</dt><dd>${c.domains.join(', ')}</dd>`) : raw('')}
          ${c.selfHosted.length ? raw(html`<dt>${t('company.loadedFrom')}</dt><dd>${c.selfHosted.join(', ')}</dd>`) : raw('')}
          <dt>${t('company.cookies')}</dt><dd>${c.setsCookies ? t('yes') : t('no')}</dd>
        </dl>
        <a class="report" href="${reportUrl({ domain: reportDomain, seenOn: currentSite, company: c.name })}" target="_blank" rel="noopener noreferrer">${t('company.correct')}</a>
      </div>
    </details>`;
}

function unknownBlock(list) {
  const key = 'unknown';
  return html`
    <details class="row unknown" data-key="${key}" ${raw(open.has(key) ? 'open' : '')}>
      <summary>
        <span class="avatar" aria-hidden="true">?</span>
        <span class="row-title">${t('unknown.title', { n: list.length })}<small>${t('unknown.sub')}</small></span>
        <span class="req">${list.reduce((s, u) => s + u.requests, 0)} ${t('req')}</span>
        ${icon('chevron', 'icon chev')}
      </summary>
      <div class="row-body">
        <p class="about">${t('unknown.about')}</p>
        <ul class="hosts">${each(list, (u) => html`<li><span class="host">${u.host}<small class="muted">${u.requests} ${t('req')}${u.setsCookies ? t('unknown.setsCookie') : ''}</small></span><a class="report-btn" href="${reportUrl({ domain: u.host, seenOn: currentSite })}" target="_blank" rel="noopener noreferrer" title="${t('unknown.reportTitle', { host: u.host })}" aria-label="${t('unknown.reportAria', { host: u.host })}">${t('unknown.report')}</a></li>`)}</ul>
      </div>
    </details>`;
}

function detailsPanel(r) {
  const s = r.stats;
  const stat = (n, label) => html`<div class="stat"><b>${n}</b><span>${label}</span></div>`;
  return html`
    <div class="stats">
      ${raw(stat(r.score, t('stat.score')))}
      ${raw(stat(s.requests, t('stat.requests')))}
      ${raw(stat(s.thirdPartySites, t('stat.sites')))}
      ${raw(stat(s.cookieSetters, t('stat.cookieSetters')))}
      ${raw(stat(s.firstPartyCookies, t('stat.firstCookies', { site: r.site })))}
      ${raw(stat(s.localStorage + s.sessionStorage, t('stat.storage')))}
    </div>
    <h2>${t('details.howTitle')}</h2>
    <p class="explain">${t('details.how')}</p>
    <h2>${t('details.legendTitle')}</h2>
    <ul class="legend">
      <li><span class="status status-seen">${t('status.seen')}</span>${t('legend.seen')}</li>
      <li><span class="status status-likely">${t('status.likely')}</span>${t('legend.likely')}</li>
      <li><span class="status status-asked">${t('status.asked')}</span>${t('legend.asked')}</li>
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
      if (!res.ok) throw new Error(t('pol.err.http', { status: res.status }));
      const type = res.headers.get('content-type') || '';
      if (/pdf/i.test(type)) throw new Error(t('pol.err.pdf'));
      text = /html|xml/i.test(type) || !type ? htmlToText(await res.text()) : await res.text();
      if (wordCount(text) < 300) {
        const fromTab = await textViaBackgroundTab(url).catch(() => '');
        if (wordCount(fromTab) > wordCount(text)) text = fromTab;
      }
    }
    if (wordCount(text) < 40) throw new Error(t('pol.err.empty'));
    text = text.slice(0, 400000);
    policy = { ...policy, status: 'done', url, text };
    chrome.storage.session.set({ [cacheKey(url)]: { text, at: Date.now() } }).catch(() => {});
  } catch (e) {
    const message = /Receiving end does not exist|Could not establish connection/i.test(e.message)
      ? t('pol.err.reload')
      : /Failed to fetch|NetworkError/i.test(e.message)
        ? t('pol.err.network')
        : e.message;
    policy = { ...policy, status: 'error', error: message };
  }
  rerender();
}

function policyPanel(r) {
  const onPolicyPage = r.policyUrl && stripHash(r.policyUrl) === stripHash(r.url);
  const readButtons = r.policyUrl && !onPolicyPage
    ? html`<button type="button" class="btn primary" data-action="read-policy">${t('pol.btn.read')}</button>
           <button type="button" class="btn link" data-action="read-page">${t('pol.btn.thisIsPolicy')}</button>`
    : html`<button type="button" class="btn primary" data-action="read-page">${onPolicyPage ? t('pol.btn.readThisPolicy') : t('pol.btn.readAsPolicy')}</button>`;

  if (policy.status === 'loading') {
    return html`<div class="pol-intro"><p class="pol-loading"><span class="spinner" aria-hidden="true"></span>${t('pol.loading')}</p></div>`;
  }
  if (policy.status === 'error') {
    return html`<div class="pol-intro">${icon('alert', 'pol-intro-icon warn')}<h2>${t('pol.errTitle')}</h2><p>${policy.error}</p><div class="btns">${raw(readButtons)}</div></div>`;
  }
  if (policy.status !== 'done') {
    return html`<div class="pol-intro">
      ${icon('doc', 'pol-intro-icon')}
      <h2>${t('pol.introTitle', { site: r.site })}</h2>
      ${r.policyUrl || onPolicyPage
        ? raw(html`<p>${t('pol.intro')}</p>`)
        : raw(html`<p>${t('pol.noLink')}</p>`)}
      <div class="btns">${raw(readButtons)}</div>
    </div>`;
  }

  const a = analyzePolicy(policy.text, { companies: r.companies, kinds: r.kinds });
  const meta = [t('pol.minutes', { n: a.minutes }), a.updated ? t('pol.updated', { date: a.updated }) : t('pol.noDate')];

  return html`
    <section class="pol-summary rating-${a.rating}">
      <div class="pol-score" aria-label="${a.covered} of ${a.total}"><b>${a.covered}</b><span>/${a.total}</span></div>
      <div class="pol-summary-text">
        <h2>${t('pol.covers', { n: a.covered, total: a.total })}</h2>
        <p>${meta.join(' ')}</p>
        <a href="${policy.url}" target="_blank" rel="noopener noreferrer">${icon('external')}${t('pol.open')}</a>
      </div>
    </section>

    ${a.tooShort || !a.looksLikePolicy ? raw(html`<p class="notice">${t('pol.notFull')}</p>`) : raw('')}

    ${a.gaps.length ? raw(html`<section class="pol-gaps">
      <h3>${icon('alert')}${t('pol.gapsTitle')}</h3>
      <ul>${each(a.gaps, (g) => html`<li>${g.text}</li>`)}</ul>
      <p class="fine">${t('pol.gapsFine')}</p>
      <button type="button" class="btn primary email-btn" data-action="email-site">${icon('mail')}${t('pol.email', { site: r.site })}</button>
    </section>`) : raw('')}

    ${raw(policyGroup(t('pol.h.data'), 'pd', a.data))}
    ${raw(policyGroup(t('pol.h.purposes'), 'pp', a.purposes))}
    ${raw(policyGroup(t('pol.h.bases'), 'pb', a.bases))}
    ${raw(policyGroup(t('pol.h.rights'), 'pr', a.rights))}
    ${raw(policyGroup(t('pol.h.checklist'), 'pc', a.checklist.map((c) => ({ ...c, label: c.optional ? c.label + t('pol.notRequired') : c.label }))))}

    <h3 class="pol-h">${t('pol.h.named')}</h3>
    ${a.named.length
      ? raw(html`<div class="chips">${each(a.named, (n) => html`<span class="chip">${n}</span>`)}</div>`)
      : raw(html`<p class="fine">${t('pol.noneNamed')}</p>`)}

    <p class="limits">${t('pol.limits')}</p>
    <button type="button" class="btn link" data-action="policy-reset">${t('pol.readOther')}</button>
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
  const note = state === 'no' ? t('pol.notMentioned') : state === 'denied' ? t('pol.denied') : '';
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

// ---- Language ------------------------------------------------------------------
const langSelect = document.getElementById('lang-switch');

function applyStaticText() {
  document.documentElement.lang = getLang();
  live.textContent = t('live');
  live.title = t('liveTitle');
  langSelect.setAttribute('aria-label', t('language'));
  langSelect.title = t('language');
  const loading = app.querySelector('.loading');
  if (loading) loading.textContent = t('loading');
}

async function initLanguage() {
  let saved;
  try { saved = (await chrome.storage.local.get('uiLang')).uiLang; } catch { /* no storage */ }
  setLang(saved || detectLang(chrome.i18n?.getUILanguage?.() || navigator.language));
  langSelect.innerHTML = Object.entries(LANG_NAMES)
    .map(([code, name]) => `<option value="${code}" ${code === getLang() ? 'selected' : ''}>${name}</option>`)
    .join('');
  applyStaticText();
  langSelect.addEventListener('change', async () => {
    setLang(langSelect.value);
    try { await chrome.storage.local.set({ uiLang: langSelect.value }); } catch { /* ignore */ }
    applyStaticText();
    lastJson = '';
    refresh();
  });
}

// ---- Start -------------------------------------------------------------------
await initLanguage();
await resolveTab();
await refresh();
setInterval(refresh, 1500);
