// Turns the raw observations for one tab into the report the popup shows.
// Pure function, no browser APIs, so it can be unit tested with `npm test`.

import { CATEGORIES, lookupTracker } from './trackers.js';
import { getSite } from './domain.js';

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
  for (const [host, info] of Object.entries(hosts)) {
    if (getSite(host) === site) continue;
    if (info.cookies) cookieSetters.push(host);
    const t = lookupTracker(host);
    if (!t) {
      unknown.push({ host, requests: info.count || 0, setsCookies: !!info.cookies });
      continue;
    }
    let c = companies.get(t.company);
    if (!c) {
      c = { name: t.company, categories: [], domains: [], requests: 0, setsCookies: false, data: new Set() };
      companies.set(t.company, c);
    }
    if (!c.categories.includes(t.category)) c.categories.push(t.category);
    c.domains.push(host);
    c.requests += info.count || 0;
    c.setsCookies ||= !!info.cookies;
    for (const k of CATEGORIES[t.category].data) c.data.add(k);
    if (info.cookies) c.data.add('identifiers');
  }

  const companyList = [...companies.values()]
    .map((c) => ({
      ...c,
      data: [...c.data],
      weight: Math.max(...c.categories.map((k) => CATEGORIES[k].weight)),
      categoryLabels: c.categories.map((k) => CATEGORIES[k].label),
      about: CATEGORIES[mainCategory(c.categories)].about
    }))
    .sort((a, b) => b.weight - a.weight || b.requests - a.requests);
  unknown.sort((a, b) => b.requests - a.requests);

  const thirdPartySites = new Set(
    Object.keys(hosts).filter((h) => getSite(h) !== site).map(getSite)
  );

  // ---- Data kinds
  const kinds = {};
  const kind = (id) =>
    (kinds[id] ||= { id, ...DATA_KINDS[id], evidence: [], recipients: new Set(), confirmed: false, severity: 1 });

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
    k.evidence.push(who ? `${meta.label}, by ${who}` : meta.label);
    for (const s of info.sources || []) {
      const t = lookupTracker(s);
      if (t) k.recipients.add(t.company);
    }
  }

  if (cookieSetters.length) {
    const k = kind('identifiers');
    k.confirmed = true;
    k.evidence.push(`${plural(cookieSetters.length, 'outside server')} stored a tracking cookie`);
  }

  // Contact, payment and identity fields
  const fieldKinds = Object.keys(fields).filter((f) => fields[f] > 0 && FIELD_LABELS[f]);
  const contactFields = fieldKinds.filter((f) => f !== 'card' && f !== 'password');
  if (contactFields.length || fields.password) {
    const k = kind('contact');
    k.asked = true;
    const list = [...contactFields, ...(fields.password ? ['password'] : [])].map((f) => FIELD_LABELS[f]);
    k.evidence.push(`This page has a form asking for your ${joinList(list)}`);
  }
  if (fields.card) {
    const k = kind('payment');
    k.asked = true;
    k.evidence.push('This page has a form asking for your card number');
  }

  if (thirdPartySites.size) {
    const k = kind('ip');
    k.confirmed = true;
    k.evidence.push(
      `Your browser contacted ${plural(thirdPartySites.size, 'other website')}. Each one sees your IP address, which reveals your approximate location and internet provider.`
    );
  }

  // Severity and plain-language evidence for inferred kinds
  const SEVERITY = { interactions: 3, device: 3, location: 3, media: 3, clipboard: 3, identifiers: 2, payment: 2, contact: 2, browsing: 2, ip: 1 };
  const kindList = Object.values(kinds).map((k) => {
    const recipients = [...k.recipients];
    if (!k.evidence.length && recipients.length) {
      k.evidence.push(inferredEvidence(k.id, recipients));
    } else if (recipients.length && k.id !== 'ip') {
      k.evidence.push(`Likely shared with ${joinList(recipients.slice(0, 4))}${recipients.length > 4 ? ` and ${recipients.length - 4} more` : ''}`);
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
    levelLabel: g.label,
    headline: headline(trackingCompanies.length, thirdPartySites.size, kindList),
    kinds: kindList,
    companies: companyList,
    unknown,
    policyUrl: raw.policyUrl || null,
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
  if (!sites && !kinds.length) return 'This page hasn’t sent your data anywhere else that we can see.';
  if (!tracking) return `This page loads content from ${plural(sites, 'other website')}, but none we know as trackers.`;
  return `${plural(tracking, 'tracking company', 'tracking companies')} can see your visit to this page.`;
}

function inferredEvidence(id, recipients) {
  const names = joinList(recipients.slice(0, 4)) + (recipients.length > 4 ? ` and ${recipients.length - 4} more` : '');
  switch (id) {
    case 'interactions': return `${names} ${recipients.length > 1 ? 'record' : 'records'} sessions on this site, which can capture mouse movement, clicks and text you type`;
    case 'browsing': return `The pages you view here are sent to ${names}`;
    case 'identifiers': return `${names} ${recipients.length > 1 ? 'use' : 'uses'} cookies or IDs to recognise you on other websites`;
    case 'device': return `${names} ${recipients.length > 1 ? 'collect' : 'collects'} details about your browser and device`;
    case 'contact': return `${names} can link this visit to your email or name once you share them`;
    case 'payment': return `${names} will receive your payment details if you buy something`;
    default: return `Shared with ${names}`;
  }
}

function describeSources(sources, site) {
  const names = new Set();
  for (const s of sources) {
    if (!s || getSite(s) === site) names.add('this site');
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

export function joinList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
