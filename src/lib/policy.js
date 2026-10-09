// Reads a privacy policy (GDPR "privacy notice") and summarises what it says.
//
// This is keyword matching, not legal analysis. It understands English,
// German and Turkish wording. Every finding keeps the sentence it came from,
// so people can check it themselves. Pure function: no browser APIs.
//
// To improve it: add wording to the patterns below and a test case in
// test/policy.test.js with a real sentence from a real policy.

import { TRACKERS, CATEGORIES } from './trackers.js';

// ---- What data the policy says it collects -------------------------------------
// `kind` links a finding to the data kinds the popup shows from page behaviour.
export const DATA_RULES = [
  { id: 'contact', kind: 'contact', label: 'Name, email, phone or address',
    re: /\b(e-?mail(?: address)?|phone number|telephone number|postal address|mailing address|first name|last name|full name)\b|e-?mail-?adresse|telefonnummer|anschrift|vor- und nachname|e-?posta|telefon numaras|ad[ıi],? soyad|adres bilgi|iletişim bilgi/iu },
  { id: 'identifiers', kind: 'identifiers', label: 'IP address, cookie IDs and device IDs',
    re: /\bIP[- ]?(?:address|adresse)|cookie (?:id|identifier)|device (?:id|identifier)|advertising (?:id|identifier)|\bIDFA\b|\bGAID\b|online identifier|online-kennung|kennung(?:en)? (?:ihres|des) (?:geräts|endgeräts)|ip adres|cihaz kimli|çerez kimli/iu },
  { id: 'device', kind: 'device', label: 'Device and browser details',
    re: /browser (?:type|version)|operating system|device (?:type|information|model|characteristics)|screen (?:resolution|size)|user[- ]agent|fingerprint|betriebssystem|browsertyp|browserversion|bildschirmauflösung|endgerät|tarayıcı (?:türü|bilgi)|işletim sistemi|cihaz bilgi|parmak izi/iu },
  { id: 'browsing', kind: 'browsing', label: 'Pages you view and what you do on the site',
    re: /pages? (?:you )?(?:visit|view)|browsing (?:history|behavio)|click(?:s|stream| behavio)|usage (?:data|information)|interactions? with (?:our|the|this)|time spent on|referring (?:url|page|website)|nutzungsdaten|nutzungsverhalten|besuchte(?:n)? (?:seiten|unterseiten)|surfverhalten|klickverhalten|referrer|kullanım veri|ziyaret ettiğiniz|gezinme/iu },
  { id: 'interactions', kind: 'interactions', label: 'Mouse movements, clicks and typing (session recording)',
    re: /session (?:recording|replay)|record(?:s|ing)? (?:your )?(?:sessions?|visits?)|mouse (?:movements?|clicks?)|keystrokes?|heat ?maps?|scroll(?:ing)? (?:behavio|depth)|mausbewegung|sitzungsaufzeichnung|aufzeichnung (?:ihrer|der) sitzung|tastatureingabe|scrollverhalten|fare hareket|oturum kayd|ısı harita/iu },
  { id: 'location', kind: 'location', label: 'Your location',
    re: /(?:precise|exact|approximate|gps|geo-?)\s?location|geolocation|location (?:data|information)|standortdaten|standortbestimmung|geolokali|gps-daten|konum (?:bilgi|veri)/iu },
  { id: 'payment', kind: 'payment', label: 'Payment details',
    re: /credit card|debit card|card (?:number|details)|payment (?:information|details|data)|bank (?:account|details)|\bIBAN\b|billing (?:information|details)|zahlungsdaten|kreditkarte|bankverbindung|kontodaten|ödeme bilgi|kredi kart|banka hesa/iu },
  { id: 'special', kind: null, sensitive: true, label: 'Sensitive data (health, religion, ethnicity, sexuality, biometrics)',
    re: /\b(?:health|medical) (?:data|information|condition)|religious (?:belief|affiliation)|ethnic origin|racial|sexual orientation|sex life|political opinion|trade union|biometric|genetic data|special categor|besondere(?:n)? kategorien|gesundheitsdaten|religiöse|ethnische herkunft|biometrisch|sexuelle orientierung|özel nitelikli|sağlık veri|biyometrik|etnik köken|dini inanç/iu },
  { id: 'children', kind: null, label: 'Data about children',
    re: /\bchildren(?:'s)?\b|\bminors?\b|under (?:the age of )?1[3-8]\b|\bkinder\b|minderjährig|unter 16|çocuk/iu }
];

// ---- Why they say they use it ---------------------------------------------------
export const PURPOSE_RULES = [
  { id: 'service', label: 'Running the website or service you asked for',
    re: /provide (?:you with )?(?:our|the) (?:services?|website|products?)|(?:deliver|operat(?:e|ing)|run(?:ning)?) (?:our|the) (?:services?|website|sites?)|(?:fulfil|process) (?:your )?orders?|bereitstellung (?:der|unserer|des) (?:website|dienste|dienstes|angebots)|abwicklung (?:ihrer|der) bestellung|hizmet(?:lerimizi)? sun|siparişlerin/iu },
  { id: 'analytics', label: 'Measuring and analysing visits',
    re: /analytic|statistic|measur(?:e|ing) (?:the )?(?:use|performance|traffic)|reichweitenmessung|webanalyse|analysezwecke|statistische|istatistik|analiz/iu },
  { id: 'advertising', label: 'Advertising and marketing', negatable: true,
    re: /advertis|marketing|targeted ads|retargeting|remarketing|werbung|werbezwecke|werbliche|reklam|pazarlama/iu },
  { id: 'personalisation', label: 'Personalising what you see',
    re: /personali[sz]|customi[sz](?:e|ed|ing|able) (?:content|experience|services)|more customizable|tailor(?:ed)? (?:content|ads|offers)|recommendations|personalisier|individualisier|kişiselleştir|öneri/iu },
  { id: 'security', label: 'Security and fraud prevention',
    re: /security|fraud|abuse|prevent(?:ing)? (?:misuse|attacks)|sicherheit|betrug|missbrauch|güvenli|dolandırıcılık/iu },
  { id: 'profiling', label: 'Building a profile of you, or automated decisions', warn: true,
    re: /profil(?:e|ing) |\bprofiling\b|automated decision|automatisierte entscheidung|profilbildung|nutzungsprofil|profilleme|otomatik karar|otomatik sistemler/iu },
  { id: 'sale', label: 'Selling or sharing your data for others’ advertising', warn: true, negatable: true,
    re: /\bsell\b|\bsold\b|\bsale of (?:personal )?(?:data|information)|share[sd]? .{0,40}(?:cross-context )?behavio(?:u)?ral advertising|verkauf(?:en)?|veri(?:lerinizi)? sat/iu }
];

// ---- Legal bases (GDPR Art. 6) ---------------------------------------------------
export const BASIS_RULES = [
  { id: 'consent', label: 'Your consent', re: /\bconsent\b|art\.?\s*6\s*\(?1\)?\s*(?:lit\.?\s*)?\(?a\)?(?![a-z])|einwilligung|açık rıza|rızanız/iu },
  { id: 'contract', label: 'Needed for a contract with you', re: /performance of (?:a|the|our) contract|necessary (?:for|to perform) (?:a|the) contract|contractual necessity|art\.?\s*6\s*\(?1\)?\s*(?:lit\.?\s*)?\(?b\)?(?![a-z])|vertragserfüllung|vertragsanbahnung|erfüllung (?:eines|des) vertrag|sözleşmenin (?:kurulması|ifası)/iu },
  { id: 'legal', label: 'A legal obligation', re: /legal obligation|comply with (?:applicable |our )?(?:law|legal)|art\.?\s*6\s*\(?1\)?\s*(?:lit\.?\s*)?\(?c\)?(?![a-z])|rechtliche(?:n)? verpflichtung|gesetzliche(?:n)? (?:verpflichtung|pflicht)|hukuki yükümlülü|kanuni yükümlülü/iu },
  { id: 'legitimate', label: 'Their “legitimate interests”', re: /legitimate interest|art\.?\s*6\s*\(?1\)?\s*(?:lit\.?\s*)?\(?f\)?(?![a-z])|berechtigte(?:n|s)? interesse|meşru menfaat/iu }
];

// ---- Your rights (GDPR Art. 15-22, 77) ------------------------------------------
export const RIGHT_RULES = [
  { id: 'access', label: 'See the data they hold', re: /right (?:of|to) access|access to (?:your|the) (?:personal )?(?:data|information)|request(?:ing)? (?:to )?access|access (?:to )?or (?:removal|deletion) of|(?:request|receive|obtain) a copy|auskunft|erişim hakkı|bilgi talep/iu },
  { id: 'rectify', label: 'Correct it', re: /rectif|correct(?:ion of| inaccurate)|(?:access|request)(?:,| and| to)? update|update (?:or correct )?(?:your|some) personal|berichtigung|düzeltil/iu },
  { id: 'erase', label: 'Have it deleted', re: /erasure|delet(?:e|ion of) (?:your|the|it)|removal of your|right to be forgotten|löschung|silinmes|imha edil/iu },
  { id: 'restrict', label: 'Limit how it’s used', re: /restrict(?:ion of)?(?:\/object to)? (?:the )?processing|einschränkung der verarbeitung|kısıtlan/iu },
  { id: 'portability', label: 'Take it elsewhere', re: /portabilit|transmit(?:ting)? it to another|übertragbarkeit|taşınabilir/iu },
  { id: 'object', label: 'Object to its use', re: /right to object|object to (?:the |our )?processing|\/object to|widerspruch|itiraz/iu },
  { id: 'withdraw', label: 'Withdraw consent', re: /withdraw (?:your )?consent|revoke (?:your )?consent|consent to and\/or deactivate|widerruf|rızanızı geri/iu },
  { id: 'complain', label: 'Complain to a data protection authority', re: /supervisory authority|data protection authority|lodge a complaint|aufsichtsbehörde|beschwerderecht|kişisel verileri koruma kurul|kurula şikayet/iu }
];

// ---- What GDPR Art. 13 says a privacy notice must tell you -------------------------
const CONTROLLER = /data controller|\bcontroller\b|responsible for (?:the )?processing|verantwortliche(?:r|n)?\b|veri sorumlusu/iu;
const DPO = /data protection officer|\bDPO\b|datenschutzbeauftragte|veri koruma görevlisi/iu;
const RECIPIENTS = /recipients?|third[- ]part(?:y|ies)|service providers?|(?:data )?processors?|empfänger|dritte(?:n)?\b|auftragsverarbeit|dienstleister|alıcı|üçüncü (?:taraf|kişi)|aktarıl/iu;
const TRANSFERS = /third countr|transferr?(?:ed|ing)? .{0,60}to other countries|outside (?:the )?(?:EU|EEA|European)|international(?:ly)? transfer|transfer(?:red)? to the (?:US|USA|United States)|standard contractual clauses|adequacy decision|data privacy framework|drittland|drittländer|drittstaat|standardvertragsklauseln|angemessenheitsbeschluss|yurt ?dışına aktar/iu;
const RETENTION = /\bretain\b|retention|stored for|(?:keep|store) (?:your )?(?:personal )?(?:data|information) (?:for|as long|until|only)|delete(?:d)? (?:after|once|when)|speicherdauer|aufbewahrung|gespeichert, (?:bis|solange)|gelöscht, sobald|saklama süre|muhafaza süre|saklanır/iu;

const DATE = String.raw`(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{1,2}\.?\s+[A-Za-zÄÖÜäöüçğıİşŞ]+\.?\s+\d{4}|[A-Za-z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|[A-Za-zÄÖÜäöüçğıİşŞ]+\s+\d{4})`;
const UPDATED = new RegExp(String.raw`(?:last (?:updated|modified|revised|changed)|effective(?: date| as of| from| on)?|went into effect(?: on)?|in effect (?:on|since)|\bstand\b|zuletzt (?:aktualisiert|geändert)|gültig ab|son güncelleme(?: tarihi)?|yürürlük tarihi)[^\d\n]{0,12}?` + DATE, 'giu');

/** The newest date the policy gives for itself (older versions are often listed too). */
function lastUpdated(text) {
  let best = null;
  for (const m of String(text || '').matchAll(UPDATED)) {
    const year = Number((m[1].match(/\d{4}/) || m[1].match(/\d{2}$/))?.[0] || 0);
    const y = year < 100 ? 2000 + year : year;
    if (!best || y > best.year) best = { year: y, value: m[1].trim() };
  }
  return best?.value || null;
}

const NEGATION = /\b(?:not|never|no|don['’]t|doesn['’]t|nicht|keine?n?|niemals|asla|etmiyoruz|etmeyiz|satmıyoruz|satmayız)\b/iu;

// Company names that are also ordinary words: only count them when the policy names their domain.
const AMBIGUOUS = new Set(['Heap', 'Convert', 'Piano', 'Square (Block)', 'Crisp', 'Castle', 'Insider', 'Impact', 'Braze', 'Iterable', 'Affirm', 'Paddle', 'Sift', 'Kargo', 'Nativo', 'Plausible', 'Pendo', 'Sentry', 'Fastly', 'Ketch', 'Osano', 'Termly', 'Giphy', 'Algolia', 'Mollie', 'Signifyd', 'Forter', 'Castle', 'Gorgias', 'Olark', 'Primis', 'Seedtag', 'Teads', 'Sovrn', 'Quora', 'VK', 'Woopra', 'Clicky', 'Convert', 'Imgur', 'Vercel', 'Prebid (ad auctions)']);

const TRACKING_CATEGORIES = new Set(['advertising', 'session-replay', 'fingerprinting', 'social', 'analytics', 'customer', 'bot-protection']);

/** Splits text into trimmed sentences (and list items), dropping tiny fragments. */
export function sentences(text) {
  return String(text || '')
    .split(/\n+/)
    .flatMap((line) => line.replace(/\s+/g, ' ').split(/(?<=[.!?;:])\s+(?=[A-ZÄÖÜÇĞİŞ0-9"„(•\-–])|\s+[•·▪]\s+/u))
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

function firstMatch(sents, re, { negatable = false } = {}) {
  let denied = null;
  for (const s of sents) {
    if (!re.test(s)) continue;
    if (negatable && NEGATION.test(s)) { denied ||= s; continue; }
    return { found: true, quote: trimQuote(s, re) };
  }
  if (denied) return { found: false, denied: true, quote: trimQuote(denied, re) };
  return { found: false };
}

/** Keeps quotes short: a window of ~220 characters around the match. */
function trimQuote(s, re) {
  if (s.length <= 240) return s;
  const m = s.match(re);
  const at = m ? m.index : 0;
  const start = Math.max(0, at - 90);
  const end = Math.min(s.length, at + 150);
  return (start > 0 ? '…' : '') + s.slice(start, end).trim() + (end < s.length ? '…' : '');
}

// Names to look for per company: "Meta (Facebook)" -> Meta, Facebook; plus its domains.
const COMPANY_ALIASES = (() => {
  // Names that are companies in their own right: "Google (YouTube)" should only
  // count as named when YouTube is mentioned, not whenever Google is.
  const plainNames = new Set(TRACKERS.map((t) => t.company).filter((n) => !n.includes('(')));
  const map = new Map();
  for (const t of TRACKERS) {
    if (!TRACKING_CATEGORIES.has(t.category)) continue;
    let entry = map.get(t.company);
    if (!entry) {
      const names = new Set();
      if (!AMBIGUOUS.has(t.company)) {
        const base = t.company.replace(/\s*\(.*\)\s*/, '').trim();
        const inner = t.company.match(/\(([^)]+)\)/)?.[1];
        const ownName = (n) => n === t.company || !plainNames.has(n);
        if (base.length >= 3 && ownName(base)) names.add(base);
        if (inner) for (const part of inner.split(/,\s*/)) if (part.length >= 3 && !/^(?:on the|run by)/.test(part) && ownName(part)) names.add(part);
      }
      entry = { company: t.company, names, domains: new Set() };
      map.set(t.company, entry);
    }
    for (const d of t.domains) entry.domains.add(d);
  }
  return [...map.values()].map((e) => ({
    company: e.company,
    nameRe: e.names.size ? new RegExp(`(?<![\\w-])(?:${[...e.names].map(escapeRe).join('|')})(?![\\w-])`, 'u') : null,
    domainRe: new RegExp(`(?<![\\w-])(?:${[...e.domains].map(escapeRe).join('|')})(?![\\w-])`, 'iu')
  }));
})();

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Which tracking companies does the policy name? */
export function companiesNamed(text) {
  const named = [];
  for (const c of COMPANY_ALIASES) {
    if ((c.nameRe && c.nameRe.test(text)) || c.domainRe.test(text)) named.push(c.company);
  }
  return named;
}

/**
 * @param {string} text  the policy's visible text
 * @param {object} [observed]  what SeeYourData saw on the page
 * @param {{name:string, categories:string[]}[]} [observed.companies]
 * @param {{id:string, status:string, title:string}[]} [observed.kinds]
 */
export function analyzePolicy(text, observed = {}) {
  const sents = sentences(text);
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  const run = (rules) => rules.map((r) => ({ id: r.id, label: r.label, kind: r.kind, warn: r.warn, sensitive: r.sensitive, ...firstMatch(sents, r.re, { negatable: r.negatable }) }));

  const data = run(DATA_RULES);
  const purposes = run(PURPOSE_RULES);
  const bases = run(BASIS_RULES);
  const rights = run(RIGHT_RULES);

  const has = (re) => firstMatch(sents, re);
  const rightsFound = rights.filter((r) => r.found).length;
  const checklist = [
    { id: 'controller', label: 'Who is responsible for your data', ...has(CONTROLLER) },
    { id: 'purposes', label: 'Why your data is used', found: purposes.some((p) => p.found) },
    { id: 'bases', label: 'The legal reason for each use', found: bases.some((b) => b.found) },
    { id: 'recipients', label: 'Who else receives your data', ...has(RECIPIENTS) },
    { id: 'transfers', label: 'Whether data leaves the EU, and how it’s protected', ...has(TRANSFERS) },
    { id: 'retention', label: 'How long data is kept', ...has(RETENTION) },
    { id: 'rights', label: 'Your rights (at least access, deletion and objection)', found: ['access', 'erase', 'object'].every((id) => rights.find((r) => r.id === id).found) },
    { id: 'withdraw', label: 'That you can withdraw consent', found: rights.find((r) => r.id === 'withdraw').found },
    { id: 'complain', label: 'That you can complain to a regulator', found: rights.find((r) => r.id === 'complain').found },
    { id: 'dpo', label: 'How to reach a data protection officer', optional: true, ...has(DPO) }
  ];
  const required = checklist.filter((c) => !c.optional);
  const covered = required.filter((c) => c.found).length;

  const named = companiesNamed(text || '');

  // ---- Compare with what the page actually did
  const gaps = [];
  for (const c of observed.companies || []) {
    if (!c.categories?.some((k) => TRACKING_CATEGORIES.has(k))) continue;
    if (!named.includes(c.name)) {
      const label = c.categories.map((k) => CATEGORIES[k]?.label).filter(Boolean)[0] || '';
      gaps.push({ type: 'company', name: c.name, text: `${c.name} is on this page${label ? ` for ${label.toLowerCase()}` : ''}, but the policy doesn’t name it.` });
    }
  }
  const seenKinds = new Set((observed.kinds || []).filter((k) => k.status === 'seen' || k.id === 'interactions').map((k) => k.id));
  const dataById = Object.fromEntries(data.map((d) => [d.id, d]));
  const KIND_GAPS = {
    interactions: 'This page uses session recording, but the policy doesn’t mention recording clicks, mouse movements or typing.',
    device: 'This page read details to fingerprint your device, but the policy doesn’t mention device or browser details.',
    location: 'This page asked for your location, but the policy doesn’t mention location data.'
  };
  for (const [kind, msg] of Object.entries(KIND_GAPS)) {
    if (seenKinds.has(kind) && !dataById[kind]?.found) gaps.push({ type: 'data', name: kind, text: msg });
  }

  return {
    words,
    minutes: Math.max(1, Math.round(words / 230)),
    updated: lastUpdated(text),
    language: detectLanguage(text),
    tooShort: words < 250,
    looksLikePolicy: sents.some((s) => /personal data|personenbezogene|kişisel veri|privacy|datenschutz|gizlilik/iu.test(s)),
    covered,
    total: required.length,
    rating: covered >= 8 ? 'good' : covered >= 5 ? 'partial' : 'poor',
    data,
    purposes,
    bases,
    rights,
    rightsFound,
    checklist,
    named,
    gaps
  };
}

function detectLanguage(text) {
  const t = String(text || '').slice(0, 5000).toLowerCase();
  const score = {
    en: (t.match(/\b(the|and|your|data|we)\b/g) || []).length,
    de: (t.match(/\b(der|die|und|ihre|daten|wir)\b/g) || []).length,
    tr: (t.match(/\b(ve|veri|kişisel|bir|için|olarak)\b/g) || []).length
  };
  return Object.entries(score).sort((a, b) => b[1] - a[1])[0][1] > 5 ? Object.entries(score).sort((a, b) => b[1] - a[1])[0][0] : 'unknown';
}
