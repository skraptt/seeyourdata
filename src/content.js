// Runs in every frame, in the extension's isolated world.
//
// 1. Relays fingerprinting/location API use reported by inject.js.
// 2. Scans forms for fields asking for personal data.
// 3. Counts cookies and web storage this site keeps in your browser.
// 4. Looks for a link to the site's privacy policy.
//
// Only counts and field types are sent to the background worker, never
// what you type or the values stored by the site.

(() => {
  const isTop = window === window.top;

  // sendMessage throws once the extension is reloaded or updated; stay quiet.
  function post(msg) {
    try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch { /* context gone */ }
  }

  // ---- 1. API use from the page --------------------------------------------
  document.addEventListener('seeyourdata:api', (e) => {
    try {
      const { api, source } = JSON.parse(e.detail);
      if (typeof api !== 'string' || api.length > 32) return;
      post({ type: 'syd:api', api, source });
    } catch { /* malformed event, ignore */ }
  });

  // ---- 2. Personal-data form fields ------------------------------------------
  // Order matters: the first rule that matches decides the field kind.
  const AUTOCOMPLETE = [
    [/cc-number|cc-csc|cc-exp/, 'card'],
    [/^(current-|new-)?password$/, 'password'],
    [/email/, 'email'],
    [/tel/, 'phone'],
    [/bday/, 'birthday'],
    [/street-address|address-line|postal-code|address-level/, 'address'],
    [/^(name|given-name|family-name|additional-name|honorific)/, 'name'],
    [/sex|gender/, 'gender'],
    [/username/, 'username']
  ];
  const HINTS = [
    [/card.?num|credit.?card|cc.?num|\bcvv\b|\bcvc\b|security.?code/i, 'card'],
    [/e-?mail/i, 'email'],
    [/phone|mobile|\btel\b|telefon|handy/i, 'phone'],
    [/birth|\bdob\b|geburt|doğum/i, 'birthday'],
    [/\bssn\b|social.?security|passport|national.?id|tax.?id|steuer.?id|tc.?kimlik|\biban\b/i, 'govid'],
    [/street|address|\bzip\b|postal|postcode|plz|stra(ss|ß)e|adres/i, 'address'],
    [/gender|geschlecht|cinsiyet/i, 'gender'],
    [/first.?name|last.?name|full.?name|surname|vorname|nachname|^name$|\bad\b.?soyad/i, 'name'],
    [/user.?name|login/i, 'username']
  ];
  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio', 'file', 'range', 'color']);

  function classify(el) {
    if (el.type === 'password') return 'password';
    if (el.type === 'email') return 'email';
    if (el.type === 'tel') return 'phone';
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    for (const [re, kind] of AUTOCOMPLETE) if (re.test(ac)) return kind;
    const label = el.labels?.[0]?.textContent || '';
    const hint = [el.name, el.id, el.getAttribute('placeholder'), el.getAttribute('aria-label'), label].filter(Boolean).join(' ');
    if (!hint) return null;
    for (const [re, kind] of HINTS) if (re.test(hint)) return kind;
    return null;
  }

  function scanFields() {
    const fields = {};
    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (el.tagName === 'INPUT' && SKIP_TYPES.has(el.type)) continue;
      const kind = classify(el);
      if (kind) fields[kind] = (fields[kind] || 0) + 1;
    }
    return fields;
  }

  // ---- 3. Storage this site keeps -------------------------------------------
  function countStorage() {
    const count = (fn) => { try { return fn(); } catch { return 0; } };
    return {
      cookies: count(() => (document.cookie ? document.cookie.split(';').filter((c) => c.trim()).length : 0)),
      local: count(() => localStorage.length),
      session: count(() => sessionStorage.length)
    };
  }

  // ---- 4. Privacy policy link -----------------------------------------------
  const POLICY = /privacy|datenschutz|confidentialit|privacidad|privacidade|privacy.?policy|gizlilik|kvkk|aydınlatma|integritet|tietosuoja|prywatno/i;
  function findPolicyUrl() {
    const links = document.querySelectorAll('a[href]');
    for (let i = links.length - 1; i >= 0; i--) { // footers are usually at the end
      const a = links[i];
      const text = (a.textContent || '') + ' ' + (a.getAttribute('aria-label') || '');
      if (POLICY.test(text) || /privacy|datenschutz/i.test(a.pathname)) {
        if (/^https?:/.test(a.href)) return a.href;
      }
    }
    return null;
  }

  // ---- Reporting ------------------------------------------------------------
  let last = '';
  function send() {
    const payload = { type: 'syd:page', fields: scanFields() };
    if (isTop) {
      payload.storage = countStorage();
      payload.policyUrl = findPolicyUrl();
    }
    const json = JSON.stringify(payload);
    if (json === last) return;
    last = json;
    post(payload);
  }

  let timer = null;
  function schedule(delay = 800) {
    clearTimeout(timer);
    timer = setTimeout(send, delay);
  }

  function start() {
    schedule(300);
    new MutationObserver(() => schedule()).observe(document.documentElement, { childList: true, subtree: true });
    // Storage keeps changing after load; re-check a few times.
    for (const t of [3000, 8000, 20000]) setTimeout(send, t);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
