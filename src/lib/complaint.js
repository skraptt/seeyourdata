// Drafts an email to a website about differences between what its pages do
// and what its privacy policy says. Pure functions, no browser APIs.
//
// The draft is only ever shown to the user, who edits it and sends it from
// their own email app. Nothing here sends anything.

import { CATEGORIES } from './trackers.js';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PRIVACY_WORDS = /privacy|datenschutz|dsgvo|gdpr|dpo|dataprotection|data-protection|kvkk|kisiselveri|gizlilik|legal|compliance/i;
const NEAR_PRIVACY = /privacy|data protection|datenschutz|protection officer|beauftragte|kvkk|kişisel veri|veri sorumlusu|gizlilik/i;

/** Picks the most likely privacy contact address in the policy text, or ''. */
export function findContactEmail(text) {
  const t = String(text || '');
  const found = [];
  for (const m of t.matchAll(EMAIL)) {
    const email = m[0].replace(/[.,;:]+$/, '');
    if (/\.(png|jpe?g|gif|svg|webp)$/i.test(email) || /example\.(com|org|test)$/i.test(email)) continue;
    const around = t.slice(Math.max(0, m.index - 160), m.index + 40);
    let score = 0;
    if (PRIVACY_WORDS.test(email.split('@')[0])) score += 3;
    if (NEAR_PRIVACY.test(around)) score += 2;
    if (/^(?:no-?reply|noreply|newsletter|marketing|sales|jobs|careers|press)@/i.test(email)) score -= 5;
    found.push({ email, score, at: m.index });
  }
  found.sort((a, b) => b.score - a.score || a.at - b.at);
  return found[0] && found[0].score > -5 ? found[0].email : '';
}

/** Removes query strings and fragments, which can contain personal data. */
export function cleanUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return '';
  }
}

/**
 * Turns the popup's report and policy analysis into evidence items.
 * Each item: { kind, title, facts: string[] } in neutral English keys; the
 * email templates phrase them per language.
 */
export function collectEvidence({ report, analysis, policyText, policyUrl, observedAt }) {
  const items = [];
  const byName = new Map((report.companies || []).map((c) => [c.name, c]));
  const kinds = new Map((report.kinds || []).map((k) => [k.id, k]));

  for (const gap of analysis.gaps || []) {
    if (gap.type === 'company') {
      const c = byName.get(gap.name);
      if (!c) continue;
      const cat = c.categories.map((k) => CATEGORIES[k]?.label).filter(Boolean);
      items.push({
        kind: 'company',
        company: c.name,
        categories: c.categories,
        categoryLabel: cat.join(', '),
        servers: c.domains.slice(0, 6),
        hiddenIn: (c.selfHosted || []).slice(0, 3),
        requests: c.requests,
        setsCookies: !!c.setsCookies
      });
    } else if (gap.type === 'data') {
      const k = kinds.get(gap.name);
      const item = { kind: 'data', data: gap.name, recipients: k?.recipients || [] };
      // Which browser features were used, and by whom.
      item.apis = (report.apis || []).filter((a) => a.kind === gap.name).map((a) => ({ id: a.id, by: a.by }));
      items.push(item);
    }
  }

  return {
    site: report.site,
    pageUrl: cleanUrl(report.url),
    policyUrl: cleanUrl(policyUrl) || policyUrl || '',
    policyUpdated: analysis.updated || '',
    language: ['de', 'tr'].includes(analysis.language) ? analysis.language : 'en',
    contactEmail: findContactEmail(policyText),
    observedAt: observedAt || Date.now(),
    items
  };
}

// ---- Wording ----------------------------------------------------------------------

const T = {
  en: {
    locale: 'en-GB',
    cats: { advertising: 'advertising', 'session-replay': 'session recording', fingerprinting: 'device fingerprinting', 'bot-protection': 'bot protection', social: 'social network', analytics: 'analytics', customer: 'chat and marketing', performance: 'performance monitoring', consent: 'cookie consent', payments: 'payments', content: 'fonts, media and embeds' },
    apiNames: { canvas: 'drew a hidden image to fingerprint the graphics card (canvas)', webgl: 'read the graphics card model (WebGL)', audio: 'measured how the device processes sound (audio fingerprint)', fonts: 'checked which fonts are installed', uaHints: 'asked for the exact OS version, device model and CPU type', battery: 'read the battery level', devices: 'listed cameras, microphones and speakers', geolocation: 'asked for the precise GPS location' },
    thisSite: 'this website itself',
    and: ' and ',
    subject: (site) => `Question about your privacy policy and data collection on ${site}`,
    hello: 'Hello,',
    intro: (e, when) => `On ${when} I visited ${e.pageUrl} and checked which services the page loads, using SeeYourData, an open-source browser extension. Some of what the page did does not appear in your privacy policy (${e.policyUrl}${e.policyUpdated ? `, last updated ${e.policyUpdated}` : ''}):`,
    company: (i, t) => `${i.company}: ${i.categories.map((c) => t.cats[c] || c).join(', ')}`,
    servers: (i) => `My browser contacted ${i.servers.join(', ')} (${i.requests} request${i.requests === 1 ? '' : 's'})${i.setsCookies ? ' and received a cookie' : ''}.`,
    hidden: (i) => `Code from ${i.company} was loaded through ${i.hiddenIn.join(', ')}.`,
    notNamed: (i) => `Your privacy policy does not name ${i.company}.`,
    data: {
      interactions: 'Recording of clicks, mouse movements and typing (session recording)',
      device: 'Reading details of my device that can be used to fingerprint it',
      location: 'A request for my precise location'
    },
    dataUsedBy: (names) => `Services on the page that do this: ${names.join(', ')}.`,
    dataNotMentioned: 'Your privacy policy does not mention this.',
    law: 'Under Art. 13 GDPR, a website must tell visitors who receives their personal data, for which purposes and on which legal basis. Could you please:',
    asks: [
      'confirm whether you use the services above and, if so, for which purposes and on which legal basis (Art. 6 GDPR);',
      'tell me which recipients receive data collected on your website, and whether any of it is transferred outside the EU/EEA and with which safeguards;',
      'update your privacy policy so that it covers these services.'
    ],
    access: 'I also request a copy of the personal data you hold about me and information about how it is processed (Art. 15 GDPR). Please reply within one month, as required by Art. 12(3) GDPR.',
    caveat: 'These observations come from my own browser and may not capture everything. If I have misunderstood something, I would appreciate a correction.',
    bye: 'Kind regards,',
    name: '[Your name]'
  },
  de: {
    locale: 'de-DE',
    cats: { advertising: 'Werbung', 'session-replay': 'Sitzungsaufzeichnung', fingerprinting: 'Geräte-Fingerprinting', 'bot-protection': 'Bot-Erkennung', social: 'soziales Netzwerk', analytics: 'Webanalyse', customer: 'Chat und Marketing', performance: 'Leistungsüberwachung', consent: 'Cookie-Einwilligung', payments: 'Zahlungen', content: 'Schriftarten, Medien und eingebettete Inhalte' },
    apiNames: { canvas: 'hat ein unsichtbares Bild gezeichnet, um die Grafikkarte wiederzuerkennen (Canvas)', webgl: 'hat das Grafikkartenmodell ausgelesen (WebGL)', audio: 'hat gemessen, wie das Gerät Töne verarbeitet (Audio-Fingerprint)', fonts: 'hat geprüft, welche Schriftarten installiert sind', uaHints: 'hat genaue Betriebssystemversion, Gerätemodell und Prozessortyp abgefragt', battery: 'hat den Akkustand ausgelesen', devices: 'hat Kameras, Mikrofone und Lautsprecher aufgelistet', geolocation: 'hat den genauen GPS-Standort abgefragt' },
    thisSite: 'die Website selbst',
    and: ' und ',
    subject: (site) => `Frage zu Ihrer Datenschutzerklärung und zur Datenverarbeitung auf ${site}`,
    hello: 'Sehr geehrte Damen und Herren,',
    intro: (e, when) => `am ${when} habe ich ${e.pageUrl} besucht und mit SeeYourData, einer quelloffenen Browser-Erweiterung, geprüft, welche Dienste die Seite lädt. Einiges davon taucht in Ihrer Datenschutzerklärung (${e.policyUrl}${e.policyUpdated ? `, Stand ${e.policyUpdated}` : ''}) nicht auf:`,
    company: (i, t) => `${i.company}: ${i.categories.map((c) => t.cats[c] || c).join(', ')}`,
    servers: (i) => `Mein Browser hat ${i.servers.join(', ')} kontaktiert (${i.requests} Anfrage${i.requests === 1 ? '' : 'n'})${i.setsCookies ? ' und dabei ein Cookie erhalten' : ''}.`,
    hidden: (i) => `Der Code von ${i.company} wurde über ${i.hiddenIn.join(', ')} geladen.`,
    notNamed: (i) => `${i.company} wird in Ihrer Datenschutzerklärung nicht genannt.`,
    data: {
      interactions: 'Aufzeichnung von Klicks, Mausbewegungen und Eingaben (Sitzungsaufzeichnung)',
      device: 'Auslesen von Geräteeigenschaften, mit denen sich mein Gerät wiedererkennen lässt (Fingerprinting)',
      location: 'Eine Abfrage meines genauen Standorts'
    },
    dataUsedBy: (names) => `Dienste auf der Seite, die das tun: ${names.join(', ')}.`,
    dataNotMentioned: 'Ihre Datenschutzerklärung erwähnt dies nicht.',
    law: 'Nach Art. 13 DSGVO müssen Websites angeben, wer personenbezogene Daten erhält, zu welchen Zwecken und auf welcher Rechtsgrundlage. Ich bitte Sie daher,',
    asks: [
      'zu bestätigen, ob Sie die genannten Dienste einsetzen, und falls ja, zu welchen Zwecken und auf welcher Rechtsgrundlage (Art. 6 DSGVO);',
      'mir mitzuteilen, welche Empfänger die auf Ihrer Website erhobenen Daten erhalten und ob Daten in Länder außerhalb der EU/des EWR übermittelt werden und mit welchen Garantien;',
      'Ihre Datenschutzerklärung so zu ergänzen, dass sie diese Dienste abdeckt.'
    ],
    access: 'Außerdem beantrage ich Auskunft über die zu meiner Person gespeicherten Daten und deren Verarbeitung nach Art. 15 DSGVO. Bitte antworten Sie gemäß Art. 12 Abs. 3 DSGVO innerhalb eines Monats.',
    caveat: 'Diese Beobachtungen stammen aus meinem eigenen Browser und sind möglicherweise nicht vollständig. Sollte ich etwas missverstanden haben, freue ich mich über eine Richtigstellung.',
    bye: 'Mit freundlichen Grüßen',
    name: '[Ihr Name]'
  },
  tr: {
    locale: 'tr-TR',
    cats: { advertising: 'reklam', 'session-replay': 'oturum kaydı', fingerprinting: 'cihaz parmak izi', 'bot-protection': 'bot koruması', social: 'sosyal ağ', analytics: 'analiz', customer: 'sohbet ve pazarlama', performance: 'performans izleme', consent: 'çerez onayı', payments: 'ödeme', content: 'yazı tipi, medya ve gömülü içerik' },
    apiNames: { canvas: 'grafik kartını tanımak için gizli bir görsel çizdi (canvas)', webgl: 'grafik kartı modelini okudu (WebGL)', audio: 'cihazın sesi nasıl işlediğini ölçtü (ses parmak izi)', fonts: 'yüklü yazı tiplerini kontrol etti', uaHints: 'tam işletim sistemi sürümünü, cihaz modelini ve işlemci türünü sordu', battery: 'pil seviyesini okudu', devices: 'kameraları, mikrofonları ve hoparlörleri listeledi', geolocation: 'tam GPS konumunu istedi' },
    thisSite: 'sitenin kendisi',
    and: ' ve ',
    subject: (site) => `${site} üzerindeki veri toplama ve gizlilik politikanız hakkında`,
    hello: 'Merhaba,',
    intro: (e, when) => `${when} tarihinde ${e.pageUrl} adresini ziyaret ettim ve açık kaynaklı bir tarayıcı eklentisi olan SeeYourData ile sayfanın hangi hizmetleri yüklediğini kontrol ettim. Sayfanın yaptıklarının bir kısmı gizlilik politikanızda (${e.policyUrl}${e.policyUpdated ? `, son güncelleme ${e.policyUpdated}` : ''}) yer almıyor:`,
    company: (i, t) => `${i.company}: ${i.categories.map((c) => t.cats[c] || c).join(', ')}`,
    servers: (i) => `Tarayıcım ${i.servers.join(', ')} adreslerine bağlandı (${i.requests} istek)${i.setsCookies ? ' ve bir çerez aldı' : ''}.`,
    hidden: (i) => `${i.company} hizmetine ait kod ${i.hiddenIn.join(', ')} üzerinden yüklendi.`,
    notNamed: (i) => `Gizlilik politikanızda ${i.company} adı geçmiyor.`,
    data: {
      interactions: 'Tıklamaların, fare hareketlerinin ve yazılanların kaydedilmesi (oturum kaydı)',
      device: 'Cihazımı tanımlamak için kullanılabilecek cihaz bilgilerinin okunması (parmak izi)',
      location: 'Tam konumumun istenmesi'
    },
    dataUsedBy: (names) => `Sayfada bunu yapan hizmetler: ${names.join(', ')}.`,
    dataNotMentioned: 'Gizlilik politikanız bundan bahsetmiyor.',
    law: 'KVKK m. 10 ve uygulandığı durumlarda GDPR m. 13 uyarınca, internet sitelerinin kişisel verileri kimlerin aldığını, hangi amaçlarla ve hangi hukuki sebebe dayanarak işlendiğini bildirmesi gerekir. Bu nedenle sizden:',
    asks: [
      'yukarıdaki hizmetleri kullanıp kullanmadığınızı, kullanıyorsanız hangi amaçlarla ve hangi hukuki sebebe dayanarak kullandığınızı teyit etmenizi;',
      'sitenizde toplanan verilerin hangi alıcılara aktarıldığını ve yurt dışına aktarılıp aktarılmadığını bildirmenizi;',
      'gizlilik politikanızı bu hizmetleri kapsayacak şekilde güncellemenizi rica ediyorum.'
    ],
    access: 'Ayrıca KVKK m. 11 ve GDPR m. 15 kapsamında, hakkımda işlediğiniz kişisel verilerin bir kopyasını ve işlenmesine ilişkin bilgileri talep ediyorum. Lütfen yasal süre içinde (KVKK: 30 gün, GDPR: bir ay) yanıt veriniz.',
    caveat: 'Bu gözlemler kendi tarayıcımdan elde edilmiştir ve her şeyi kapsamıyor olabilir. Yanlış anladığım bir nokta varsa düzeltmenizi memnuniyetle karşılarım.',
    bye: 'Saygılarımla,',
    name: '[Adınız]'
  }
};

export const LANGUAGES = { en: 'English', de: 'Deutsch', tr: 'Türkçe' };

/** Builds { to, subject, body } from collected evidence. */
export function buildEmail(evidence, { lang = evidence.language, accessRequest = false } = {}) {
  const t = T[lang] || T.en;
  const when = new Date(evidence.observedAt).toLocaleString(t.locale, { dateStyle: 'long', timeStyle: 'short' });
  const lines = [t.hello, '', t.intro(evidence, when), ''];

  evidence.items.forEach((i, n) => {
    const num = `${n + 1}. `;
    if (i.kind === 'company') {
      lines.push(num + t.company(i, t));
      if (i.servers.length) lines.push(`   - ${t.servers(i)}`);
      if (i.hiddenIn.length) lines.push(`   - ${t.hidden(i)}`);
      lines.push(`   - ${t.notNamed(i)}`);
    } else {
      lines.push(num + (t.data[i.data] || i.data));
      if (i.recipients.length) lines.push(`   - ${t.dataUsedBy(i.recipients.slice(0, 5))}`);
      for (const a of (i.apis || []).slice(0, 4)) {
        const who = a.by.map((b) => b || t.thisSite);
        const whoText = who.length > 1 ? who.slice(0, -1).join(', ') + t.and + who[who.length - 1] : who[0] || t.thisSite;
        lines.push(`   - ${whoText.charAt(0).toLocaleUpperCase(t.locale) + whoText.slice(1)}: ${t.apiNames[a.id] || a.id}.`);
      }
      lines.push(`   - ${t.dataNotMentioned}`);
    }
    lines.push('');
  });

  lines.push(t.law);
  for (const a of t.asks) lines.push(`- ${a}`);
  lines.push('');
  if (accessRequest) lines.push(t.access, '');
  lines.push(t.caveat, '', t.bye, t.name);

  return { to: evidence.contactEmail, subject: t.subject(evidence.site), body: lines.join('\n') };
}

/** Link that opens the user's email app with the draft filled in. */
export function mailtoUrl({ to, subject, body }) {
  const enc = (s) => encodeURIComponent(s).replace(/%20/g, '%20');
  return `mailto:${encodeURIComponent(to || '').replace(/%40/g, '@')}?subject=${enc(subject)}&body=${enc(body)}`;
}

/** Link that opens a Gmail draft with the same content. */
export function gmailUrl({ to, subject, body }) {
  const p = new URLSearchParams({ view: 'cm', fs: '1', to: to || '', su: subject, body });
  return `https://mail.google.com/mail/?${p}`;
}
