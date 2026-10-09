import { analyze, plural } from '../src/lib/analyze.js';
import { isWebUrl } from '../src/lib/domain.js';
import { CATEGORIES } from '../src/lib/trackers.js';
import { reportUrl } from '../src/config.js';

const app = document.getElementById('app');
const live = document.getElementById('live');

let tabId = null;
let pageUrl = '';
let lastJson = '';
let activeTab = 'collects';
let currentSite = '';
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
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'
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
  render(data);
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

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

// ---- Start -------------------------------------------------------------------
await resolveTab();
await refresh();
setInterval(refresh, 1500);
