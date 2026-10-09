// The email draft page. Opened in a new tab from the popup's Policy tab.
// It only prepares text: sending always happens in the person's own email app.
//
// Two languages are in play here: the page itself follows the language chosen
// in the popup, while the email starts in the language of the site's privacy
// policy (and can be switched separately).

import { buildEmail, mailtoUrl, gmailUrl, LANGUAGES } from '../src/lib/complaint.js';
import { t, setLang, getLang, detectLang, joinList } from '../src/lib/i18n.js';

const app = document.getElementById('app');
const id = new URLSearchParams(location.search).get('id');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAILTO_SAFE_LENGTH = 1800; // some email apps cut longer mailto links
const NAME_PLACEHOLDER = { en: '[Your name]', de: '[Ihr Name]', tr: '[Adınız]' };

let evidence = null;
let emailLang = 'en';
let accessRequest = false;
let edited = false;

async function start() {
  let saved;
  try { saved = (await chrome.storage.local.get('uiLang')).uiLang; } catch { /* no storage */ }
  setLang(saved || detectLang(chrome.i18n?.getUILanguage?.() || navigator.language));
  document.documentElement.lang = getLang();
  app.innerHTML = `<p class="loading">${esc(t('c.preparing'))}</p>`;

  try {
    evidence = (await chrome.storage.session.get('draft:' + id))['draft:' + id];
  } catch { /* storage unavailable */ }
  if (!evidence) {
    app.innerHTML = `<section class="empty"><h1>${esc(t('c.expired.title'))}</h1><p>${esc(t('c.expired.text'))}</p></section>`;
    return;
  }
  emailLang = evidence.language || 'en';
  document.title = t('c.docTitle', { site: evidence.site });
  render();
}

function render() {
  const mail = buildEmail(evidence, { lang: emailLang, accessRequest });
  const companies = evidence.items.filter((i) => i.kind === 'company').length;
  const behaviours = evidence.items.length - companies;
  const summary = joinList([
    companies ? t('c.sum.companies', { n: companies }) : '',
    behaviours ? t('c.sum.behaviours', { n: behaviours }) : ''
  ].filter(Boolean));

  app.innerHTML = `
    <section class="c-head">
      <h1>${esc(t('c.h1', { site: evidence.site }))}</h1>
      <p>${esc(capitalise(t('c.found', { summary })))}</p>
    </section>

    <section class="c-card">
      <div class="c-row">
        <label for="to">${esc(t('c.to'))}</label>
        <input id="to" type="email" value="${esc(mail.to)}" placeholder="privacy@${esc(evidence.site)}" autocomplete="off" spellcheck="false">
      </div>
      ${mail.to ? '' : `<p class="c-hint warn">${esc(t('c.noContact'))}</p>`}
      <div class="c-row">
        <label for="subject">${esc(t('c.subject'))}</label>
        <input id="subject" type="text" value="${esc(mail.subject)}">
      </div>
      <div class="c-options">
        <label class="c-select">${esc(t('c.emailLanguage'))}
          <select id="lang">${Object.entries(LANGUAGES).map(([k, v]) => `<option value="${k}" ${k === emailLang ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <label class="c-check"><input id="access" type="checkbox" ${accessRequest ? 'checked' : ''}> ${esc(t('c.access'))}</label>
      </div>
      <textarea id="body" rows="22" spellcheck="true" lang="${emailLang}" aria-label="${esc(t('c.bodyAria'))}">${esc(mail.body)}</textarea>
      <p class="c-hint">${esc(t('c.replaceName', { ph: NAME_PLACEHOLDER[emailLang] || NAME_PLACEHOLDER.en }))}</p>
    </section>

    <section class="c-actions">
      <button type="button" class="btn primary" id="open-mail">${esc(t('c.openMail'))}</button>
      <button type="button" class="btn" id="open-gmail">${esc(t('c.openGmail'))}</button>
      <button type="button" class="btn" id="copy">${esc(t('c.copy'))}</button>
      <span class="c-status" id="status" role="status" aria-live="polite"></span>
    </section>
    <p class="c-hint" id="length-hint" hidden>${esc(t('c.long'))}</p>

    <section class="c-note">
      <h2>${esc(t('c.beforeTitle'))}</h2>
      <ul>
        <li>${esc(t('c.before1'))}</li>
        <li>${esc(t('c.before2'))}</li>
        <li>${esc(t('c.before3'))}</li>
      </ul>
    </section>
  `;
  wire();
  updateLengthHint();
}

function capitalise(text) {
  return text.charAt(0).toLocaleUpperCase(getLang()) + text.slice(1);
}

function current() {
  return {
    to: document.getElementById('to').value.trim(),
    subject: document.getElementById('subject').value,
    body: document.getElementById('body').value
  };
}

function updateLengthHint() {
  document.getElementById('length-hint').hidden = mailtoUrl(current()).length <= MAILTO_SAFE_LENGTH;
}

function rebuild(change) {
  if (edited && !confirm(t('c.confirmRebuild'))) {
    render(); // put the controls back the way they were
    return;
  }
  change();
  edited = false;
  render();
}

function status(text) {
  const el = document.getElementById('status');
  el.textContent = text;
  setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 2500);
}

function wire() {
  for (const fieldId of ['body', 'subject']) {
    document.getElementById(fieldId).addEventListener('input', () => { edited = true; updateLengthHint(); });
  }
  document.getElementById('to').addEventListener('input', updateLengthHint);
  document.getElementById('lang').addEventListener('change', (e) => rebuild(() => { emailLang = e.target.value; }));
  document.getElementById('access').addEventListener('change', (e) => rebuild(() => { accessRequest = e.target.checked; }));
  document.getElementById('open-mail').addEventListener('click', () => {
    location.href = mailtoUrl(current());
    status(t('c.opening'));
  });
  document.getElementById('open-gmail').addEventListener('click', () => {
    window.open(gmailUrl(current()), '_blank', 'noopener');
  });
  document.getElementById('copy').addEventListener('click', async () => {
    const m = current();
    const text = `${m.to ? `To: ${m.to}\n` : ''}Subject: ${m.subject}\n\n${m.body}`;
    try {
      await navigator.clipboard.writeText(text);
      status(t('c.copied'));
    } catch {
      status(t('c.copyFail'));
    }
  });
}

start();
