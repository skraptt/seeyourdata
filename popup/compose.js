// The email draft page. Opened in a new tab from the popup's Policy tab.
// It only prepares text: sending always happens in the person's own email app.

import { buildEmail, mailtoUrl, gmailUrl, LANGUAGES } from '../src/lib/complaint.js';

const app = document.getElementById('app');
const id = new URLSearchParams(location.search).get('id');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAILTO_SAFE_LENGTH = 1800; // some email apps cut longer mailto links

let evidence = null;
let lang = 'en';
let accessRequest = false;
let edited = false;

async function start() {
  try {
    evidence = (await chrome.storage.session.get('draft:' + id))['draft:' + id];
  } catch { /* storage unavailable */ }
  if (!evidence) {
    app.innerHTML = `<section class="empty"><h1>This draft has expired</h1><p>Open SeeYourData on the website again, go to the Policy tab and click “Email the website about this”.</p></section>`;
    return;
  }
  lang = evidence.language || 'en';
  document.title = `Email ${evidence.site} – SeeYourData`;
  render();
}

function render() {
  const mail = buildEmail(evidence, { lang, accessRequest });
  const companies = evidence.items.filter((i) => i.kind === 'company').length;
  const behaviours = evidence.items.length - companies;
  const summary = [
    companies ? `${companies} compan${companies === 1 ? 'y' : 'ies'} the policy doesn’t name` : '',
    behaviours ? `${behaviours} kind${behaviours === 1 ? '' : 's'} of data collection it doesn’t mention` : ''
  ].filter(Boolean).join(' and ');

  app.innerHTML = `
    <section class="c-head">
      <h1>Email ${esc(evidence.site)} about its privacy policy</h1>
      <p>We found ${esc(summary)}. This draft lists the evidence and asks them to explain. Check it, change anything you like, then send it from your own email.</p>
    </section>

    <section class="c-card">
      <div class="c-row">
        <label for="to">To</label>
        <input id="to" type="email" value="${esc(mail.to)}" placeholder="privacy@${esc(evidence.site)}" autocomplete="off" spellcheck="false">
      </div>
      ${mail.to ? '' : `<p class="c-hint warn">We couldn’t find a privacy contact address in the policy. Look for one on the site’s contact or imprint page${lang === 'de' ? ' (Impressum)' : ''}.</p>`}
      <div class="c-row">
        <label for="subject">Subject</label>
        <input id="subject" type="text" value="${esc(mail.subject)}">
      </div>
      <div class="c-options">
        <label class="c-select">Language
          <select id="lang">${Object.entries(LANGUAGES).map(([k, v]) => `<option value="${k}" ${k === lang ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <label class="c-check"><input id="access" type="checkbox" ${accessRequest ? 'checked' : ''}> Also ask for a copy of the data they hold about me (GDPR Art. 15)</label>
      </div>
      <textarea id="body" rows="22" spellcheck="true" aria-label="Email text">${esc(mail.body)}</textarea>
      <p class="c-hint">Replace <b>${lang === 'de' ? '[Ihr Name]' : lang === 'tr' ? '[Adınız]' : '[Your name]'}</b> at the end with your name.</p>
    </section>

    <section class="c-actions">
      <button type="button" class="btn primary" id="open-mail">Open in my email app</button>
      <button type="button" class="btn" id="open-gmail">Open in Gmail</button>
      <button type="button" class="btn" id="copy">Copy email text</button>
      <span class="c-status" id="status" role="status" aria-live="polite"></span>
    </section>
    <p class="c-hint" id="length-hint" hidden>This email is long, so some email apps may cut it off. If that happens, use “Copy email text” and paste it into a new email.</p>

    <section class="c-note">
      <h2>Before you send</h2>
      <ul>
        <li>SeeYourData doesn’t send anything. The email goes from your own account, so the website will see your name and email address.</li>
        <li>The evidence comes from your browser on this one visit. Sites can change, so keep a screenshot of the SeeYourData popup if you want a record.</li>
        <li>If you ask for a copy of your data, the GDPR gives them one month to answer (Art. 12). If they don’t reply, or you’re not satisfied with the answer, you can complain to your data protection authority.</li>
      </ul>
    </section>
  `;
  wire();
  updateLengthHint();
}

function current() {
  return {
    to: document.getElementById('to').value.trim(),
    subject: document.getElementById('subject').value,
    body: document.getElementById('body').value
  };
}

function updateLengthHint() {
  const m = current();
  document.getElementById('length-hint').hidden = mailtoUrl(m).length <= MAILTO_SAFE_LENGTH;
}

function rebuild(change) {
  if (edited && !confirm('Start a new draft? Your changes to the text will be replaced.')) {
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
  document.getElementById('lang').addEventListener('change', (e) => rebuild(() => { lang = e.target.value; }));
  document.getElementById('access').addEventListener('change', (e) => rebuild(() => { accessRequest = e.target.checked; }));
  document.getElementById('open-mail').addEventListener('click', () => {
    location.href = mailtoUrl(current());
    status('Opening your email app…');
  });
  document.getElementById('open-gmail').addEventListener('click', () => {
    window.open(gmailUrl(current()), '_blank', 'noopener');
  });
  document.getElementById('copy').addEventListener('click', async () => {
    const m = current();
    const text = `${m.to ? `To: ${m.to}\n` : ''}Subject: ${m.subject}\n\n${m.body}`;
    try {
      await navigator.clipboard.writeText(text);
      status('Copied');
    } catch {
      status('Couldn’t copy. Select the text and copy it yourself.');
    }
  });
}

start();
