// Turns the raw observations for one tab into the report the popup shows.
// Pure function, no browser APIs, so it can be unit tested with `npm test`.

import { CATEGORIES, lookupTracker, scriptPatternById } from './trackers.js';
import { getSite } from './domain.js';
import { t, joinList } from './i18n.js';

export { joinList };

/** The kinds of personal data we report on, in the user's words. */
export const DATA_KINDS = {
  interactions: { title: 'Your clicks, scrolling and typing', icon: 'cursor' },
  device: { title: 'A fingerprint of your device', icon: 'fingerprint' },
  identifiers: { title: 'IDs that follow you across websites', icon: 'tag' },
  browsing: { title: 'What you look at on this site', icon: 'eye' },
  location: { title: 'Your precise location', icon: 'pin' },
  media: { title: 'Your camera or microphone', icon: 'camera' },
  clipboard: { title: 'Text you copied', icon: 'clipboard' },
  contact: { title: 'Your contact and identity details', icon: 'person' },
  payment: { title: 'Your payment details', icon: 'card' },
  ip: { title: 'Your IP address and rough location', icon: 'globe' }
};

/** Form field kinds detected by the content script. */
export const FIELD_LABELS = {
  email: 'email address',
  name: 'name',
  phone: 'phone number',
  address: 'postal address',
  birthday: 'date of birth',
  password: 'password',
  card: 'card number',
  govid: 'ID or tax number',
  gender: 'gender',
  username: 'username'
};

/** Browser features the page script can use to identify or locate you. */
export const API_INFO = {
  canvas: { kind: 'device', label: 'Drew a hidden image to fingerprint your graphics card (canvas)', weight: 8 },
  webgl: { kind: 'device', label: 'Read your graphics card model (WebGL)', weight: 6 },
  audio: { kind: 'device', label: 'Measured how your device processes sound (audio fingerprint)', weight: 8 },
  fonts: { kind: 'device', label: 'Checked which fonts you have installed', weight: 6 },
  uaHints: { kind: 'device', label: 'Asked for your exact OS version, device model and CPU type', weight: 4 },
  battery: { kind: 'device', label: 'Read your battery level', weight: 4 },
  devices: { kind: 'device', label: 'Listed your cameras, microphones and speakers', weight: 5 },
  geolocation: { kind: 'location', label: 'Asked for your precise GPS location', weight: 6 },
  camera: { kind: 'media', label: 'Asked to use your camera or microphone', weight: 6 },
  clipboard: { kind: 'clipboard', label: 'Tried to read your clipboard', weight: 6 }
};

export const GRADES = [
  { min: 90, grade: 'A', level: 'low', label: 'Low exposure' },
  { min: 75, grade: 'B', level: 'low', label: 'Some exposure' },
  { min: 55, grade: 'C', level: 'moderate', label: 'Moderate exposure' },
  { min: 35, grade: 'D', level: 'high', label: 'High exposure' },
  { min: 0, grade: 'F', level: 'high', label: 'Very high exposure' }
];

const TRACKING_CATEGORIES = new Set(['advertising', 'session-replay', 'fingerprinting', 'social', 'analytics', 'customer']);

/**
 * @param {object} raw
 * @param {string} raw.url            page URL
 * @param {Record<string,{count:number,cookies?:number,types?:Record<string,number>}>} raw.hosts  hosts contacted
 * @param {Record<string,{sources:string[]}>} [raw.apis]   sensitive browser APIs used, by API id
 * @param {Record<string,number>} [raw.fields]             personal-data form fields on the page
 * @param {{cookies?:number, local?:number, session?:number}} [raw.storage]
 * @param {number} [raw.firstPartyCookies]               all cookies for the site (incl. HttpOnly)
 * @param {string} [raw.policyUrl]                       link to the privacy policy, if found
 */
export function analyze(raw) {
  const site = getSite(safeHost(raw.url));
  const hosts = raw.hosts || {};
  const apis = raw.apis || {};
  const fields = raw.fields || {};

  // ---- Group third-party hosts by company
  const companies = new Map();
  const unknown = [];
  const cookieSetters = [];
  const addCompany = (t, host, requests, cookies, selfHosted) => {
    let c = companies.get(t.company);
    if (!c) {
      c = { name: t.company, categories: [], domains: [], selfHosted: [], requests: 0, setsCookies: false, data: new Set() };
      companies.set(t.company, c);
    }
    if (!c.categories.includes(t.category)) c.categories.push(t.category);
    const list = selfHosted ? c.selfHosted : c.domains;
    if (!list.includes(host)) list.push(host);
    c.requests += requests;
    c.setsCookies ||= cookies;
    for (const k of CATEGORIES[t.category].data) c.data.add(k);
    if (cookies) c.data.add('identifiers');
  };

  for (const [host, info] of Object.entries(hosts)) {
    const firstParty = getSite(host) === site;

    // Tracker code recognised by file name, often served from the site's own domain.
    const sdkIds = Object.keys(info.sdks || {});
    for (const id of sdkIds) {
      const t = scriptPatternById(id);
      if (t) addCompany(t, host, info.sdks[id], false, true);
    }

    if (firstParty) continue;
    if (info.cookies) cookieSetters.push(host);
    const t = lookupTracker(host);
    if (t) addCompany(t, host, info.count || 0, !!info.cookies, false);
    else if (!sdkIds.length) unknown.push({ host, requests: info.count || 0, setsCookies: !!info.cookies });
  }

  const companyList = [...companies.values()]
    .map((c) => ({
      ...c,
      data: [...c.data],
      weight: Math.max(...c.categories.map((k) => CATEGORIES[k].weight)),
      categoryLabels: c.categories.map((k) => t(`cat.${k}`)),
      about: t(`cat.${mainCategory(c.categories)}.about`)
    }))
    .sort((a, b) => b.weight - a.weight || b.requests - a.requests);
  unknown.sort((a, b) => b.requests - a.requests);

  const thirdPartySites = new Set(
    Object.keys(hosts).filter((h) => getSite(h) !== site).map(getSite)
  );

  // ---- Data kinds
  const kinds = {};
  const kind = (id) =>
    (kinds[id] ||= { id, ...DATA_KINDS[id], title: t(`kind.${id}`), evidence: [], recipients: new Set(), confirmed: false, severity: 1 });

  for (const c of companyList) {
    for (const d of c.data) {
      const k = kind(d);
      k.recipients.add(c.name);
    }
  }

  for (const [api, info] of Object.entries(apis)) {
    const meta = API_INFO[api];
    if (!meta) continue;
    const k = kind(meta.kind);
    k.confirmed = true;
    const who = describeSources(info.sources || [], site);
    const label = t(`api.${api}`);
    k.evidence.push(who ? t('apiBy', { label, who }) : label);
    for (const s of info.sources || []) {
      const t = lookupTracker(s);
      if (t) k.recipients.add(t.company);
    }
  }

  if (cookieSetters.length) {
    const k = kind('identifiers');
    k.confirmed = true;
    k.evidence.push(t('cookieSetters', { n: cookieSetters.length }));
  }

  // Contact, payment and identity fields
  const fieldKinds = Object.keys(fields).filter((f) => fields[f] > 0 && FIELD_LABELS[f]);
  const contactFields = fieldKinds.filter((f) => f !== 'card' && f !== 'password');
  if (contactFields.length || fields.password) {
    const k = kind('contact');
    k.asked = true;
    const list = [...contactFields, ...(fields.password ? ['password'] : [])].map((f) => t(`field.${f}`));
    k.evidence.push(t('form.contact', { list: joinList(list) }));
  }
  if (fields.card) {
    const k = kind('payment');
    k.asked = true;
    k.evidence.push(t('form.card'));
  }

  if (thirdPartySites.size) {
    const k = kind('ip');
    k.confirmed = true;
    k.evidence.push(t('ipEvidence', { n: thirdPartySites.size }));
  }

  // Severity and plain-language evidence for inferred kinds
  const SEVERITY = { interactions: 3, device: 3, location: 3, media: 3, clipboard: 3, identifiers: 2, payment: 2, contact: 2, browsing: 2, ip: 1 };
  const kindList = Object.values(kinds).map((k) => {
    const recipients = [...k.recipients];
    if (!k.evidence.length && recipients.length) {
      k.evidence.push(inferredEvidence(k.id, recipients));
    } else if (recipients.length && k.id !== 'ip') {
      k.evidence.push(t('likelyShared', { names: namesList(recipients) }));
    }
    const status = k.confirmed ? 'seen' : k.asked ? 'asked' : 'likely';
    return { id: k.id, title: k.title, icon: k.icon, status, severity: SEVERITY[k.id] || 1, evidence: k.evidence, recipients };
  });
  const STATUS_ORDER = { seen: 0, likely: 1, asked: 2 };
  kindList.sort((a, b) => b.severity - a.severity || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  // ---- Score
  let penalty = 0;
  penalty += companyList.reduce((sum, c) => sum + c.weight, 0);
  penalty += Math.min(15, unknown.length * 1.5);
  penalty += Math.min(12, cookieSetters.length * 1.5);
  let apiPenalty = 0;
  for (const [api, info] of Object.entries(apis)) {
    const meta = API_INFO[api];
    if (!meta) continue;
    const byThirdParty = (info.sources || []).some((s) => s && getSite(s) !== site);
    apiPenalty += byThirdParty ? meta.weight : meta.weight / 2;
  }
  penalty += Math.min(25, apiPenalty);
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const g = GRADES.find((x) => score >= x.min);

  const trackingCompanies = companyList.filter((c) => c.categories.some((k) => TRACKING_CATEGORIES.has(k)));

  return {
    site,
    url: raw.url,
    score,
    grade: g.grade,
    level: g.level,
    levelLabel: t(`level.${g.grade}`),
    headline: headline(trackingCompanies.length, thirdPartySites.size, kindList),
    kinds: kindList,
    companies: companyList,
    unknown,
    policyUrl: raw.policyUrl || null,
    // Raw facts about sensitive browser features, for evidence in other languages.
    // A source of '' means the site itself.
    apis: Object.entries(apis).filter(([api]) => API_INFO[api]).map(([api, info]) => ({
      id: api,
      kind: API_INFO[api].kind,
      by: [...new Set((info.sources || []).map((s) => (!s || getSite(s) === site ? '' : lookupTracker(s)?.company || s)))]
    })),
    stats: {
      requests: Object.values(hosts).reduce((s, h) => s + (h.count || 0), 0),
      thirdPartySites: thirdPartySites.size,
      trackingCompanies: trackingCompanies.length,
      cookieSetters: cookieSetters.length,
      firstPartyCookies: raw.firstPartyCookies ?? raw.storage?.cookies ?? 0,
      localStorage: raw.storage?.local ?? 0,
      sessionStorage: raw.storage?.session ?? 0
    }
  };
}

function headline(tracking, sites, kinds) {
  if (!sites && !kinds.length) return t('headline.none');
  if (!tracking) return t('headline.noTracking', { n: sites });
  return t('headline.tracking', { n: tracking });
}

function namesList(recipients) {
  return joinList(recipients.slice(0, 4)) + (recipients.length > 4 ? t('more', { n: recipients.length - 4 }) : '');
}

const INFERRED = new Set(['interactions', 'browsing', 'identifiers', 'device', 'contact', 'payment']);
function inferredEvidence(id, recipients) {
  const vars = { names: namesList(recipients), many: recipients.length > 1 };
  return t(INFERRED.has(id) ? `inferred.${id}` : 'inferred.other', vars);
}

function describeSources(sources, site) {
  const names = new Set();
  for (const s of sources) {
    if (!s || getSite(s) === site) names.add(t('thisSite'));
    else names.add(lookupTracker(s)?.company || s);
  }
  return joinList([...names]);
}

function mainCategory(cats) {
  return cats.reduce((best, k) => (CATEGORIES[k].weight > CATEGORIES[best].weight ? k : best), cats[0]);
}

function safeHost(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

export function plural(n, one, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

