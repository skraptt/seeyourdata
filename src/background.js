// Background service worker.
//
// Watches the network requests each tab makes (read-only, nothing is blocked
// or changed), collects reports from the content scripts, and keeps one
// record per tab in chrome.storage.session. That storage lives in memory and
// is wiped when the browser closes. Nothing ever leaves your computer.

import { getHost, getSite, isWebUrl } from './lib/domain.js';
import { analyze } from './lib/analyze.js';
import { lookupTracker, matchScriptPattern } from './lib/trackers.js';

const MAX_HOSTS = 400;
const tabs = new Map(); // tabId -> state (in-memory cache)
const loading = new Map(); // tabId -> Promise<state>
const saveTimers = new Map();

function emptyState(url) {
  return { url: url || '', site: getSite(getHost(url)), startedAt: Date.now(), hosts: {}, apis: {}, fields: {}, storage: {}, policyUrl: null };
}

async function getState(tabId) {
  if (tabs.has(tabId)) return tabs.get(tabId);
  if (!loading.has(tabId)) {
    loading.set(tabId, (async () => {
      const key = `tab:${tabId}`;
      const stored = (await chrome.storage.session.get(key))[key];
      let state = tabs.get(tabId) || stored;
      if (!state) {
        // A tab that was already open before we started watching it: adopt it,
        // but remember that we missed the start of the page load.
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        state = { ...emptyState(tab?.url || ''), partial: true };
      }
      tabs.set(tabId, state);
      loading.delete(tabId);
      return state;
    })());
  }
  return loading.get(tabId);
}

function scheduleSave(tabId) {
  clearTimeout(saveTimers.get(tabId));
  saveTimers.set(tabId, setTimeout(async () => {
    saveTimers.delete(tabId);
    const state = tabs.get(tabId);
    if (!state) return;
    await chrome.storage.session.set({ [`tab:${tabId}`]: state }).catch(() => {});
    updateBadge(tabId, state);
  }, 400));
}

function resetTab(tabId, url) {
  const state = emptyState(url);
  tabs.set(tabId, state);
  scheduleSave(tabId);
  return state;
}

// ---- Network observation -------------------------------------------------

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    if (details.type === 'main_frame') {
      resetTab(details.tabId, details.url);
      return;
    }
    record(details.tabId, details.url, details.type);
  },
  { urls: ['<all_urls>'] }
);

async function record(tabId, url, type) {
  if (!isWebUrl(url)) return;
  const host = getHost(url);
  if (!host) return;
  const state = await getState(tabId);
  if (!state.site) return;
  let h = state.hosts[host];
  if (!h) {
    if (Object.keys(state.hosts).length >= MAX_HOSTS) return;
    h = state.hosts[host] = { count: 0, cookies: 0, types: {} };
  }
  h.count++;
  h.types[type] = (h.types[type] || 0) + 1;
  // Tracker code served from an address we don't know (often the site's own).
  if (!lookupTracker(host)) {
    let path = '';
    try { path = new URL(url).pathname; } catch { /* ignore */ }
    const hit = matchScriptPattern(path);
    if (hit) {
      h.sdks ||= {};
      h.sdks[hit.id] = (h.sdks[hit.id] || 0) + 1;
    }
  }
  scheduleSave(tabId);
}

chrome.webRequest.onHeadersReceived.addListener(
  async (details) => {
    if (details.tabId < 0 || details.type === 'main_frame') return;
    const setsCookie = details.responseHeaders?.some((h) => h.name.toLowerCase() === 'set-cookie');
    if (!setsCookie) return;
    const host = getHost(details.url);
    const state = await getState(details.tabId);
    const h = state.hosts[host];
    if (h) {
      h.cookies++;
      scheduleSave(details.tabId);
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders', 'extraHeaders']
);

// ---- Reports from content scripts ------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'syd:getTab') {
    getState(msg.tabId).then((state) => sendResponse(state));
    return true;
  }

  const tabId = sender.tab?.id;
  if (tabId == null || tabId < 0) return;

  if (msg?.type === 'syd:api') {
    getState(tabId).then((state) => {
      const entry = (state.apis[msg.api] ||= { sources: [] });
      const src = typeof msg.source === 'string' ? msg.source.slice(0, 200) : '';
      if (!entry.sources.includes(src) && entry.sources.length < 10) entry.sources.push(src);
      scheduleSave(tabId);
    });
  } else if (msg?.type === 'syd:page') {
    getState(tabId).then((state) => {
      // Form fields from every frame are merged; storage and policy come from the top frame.
      for (const [k, v] of Object.entries(msg.fields || {})) {
        state.fields[k] = Math.max(state.fields[k] || 0, Number(v) || 0);
      }
      if (sender.frameId === 0) {
        state.storage = msg.storage || state.storage;
        state.policyUrl = msg.policyUrl || state.policyUrl;
      }
      scheduleSave(tabId);
    });
  }
});

// ---- Tab lifecycle -------------------------------------------------------

chrome.tabs.onRemoved.addListener((tabId) => {
  tabs.delete(tabId);
  clearTimeout(saveTimers.get(tabId));
  chrome.storage.session.remove(`tab:${tabId}`).catch(() => {});
});

// Pages restored from the back/forward cache don't fire a new main_frame request.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!info.url) return;
  const state = await getState(tabId);
  if (getSite(getHost(info.url)) !== state.site) resetTab(tabId, info.url);
  else if (!isWebUrl(state.url)) state.url = info.url;
});

// ---- Toolbar badge -------------------------------------------------------

const BADGE_COLORS = { low: '#1F8A5B', moderate: '#B7791F', high: '#C2412D' };

function updateBadge(tabId, state) {
  if (!isWebUrl(state.url)) {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    return;
  }
  const report = analyze(state);
  const n = report.stats.trackingCompanies;
  chrome.action.setBadgeText({ tabId, text: n ? String(n) : '' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLORS[report.level] }).catch(() => {});
  chrome.action.setBadgeTextColor?.({ tabId, color: '#FFFFFF' })?.catch?.(() => {});
  chrome.action.setTitle({ tabId, title: `SeeYourData: ${report.levelLabel.toLowerCase()} (${report.grade}) on ${report.site}` }).catch(() => {});
}
