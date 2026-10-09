import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES, setLang, t, detectLang, joinList } from '../src/lib/i18n.js';
import { analyze } from '../src/lib/analyze.js';
import { analyzePolicy } from '../src/lib/policy.js';
import { CATEGORIES } from '../src/lib/trackers.js';

afterEach(() => setLang('en'));

const SAMPLE_VARS = { n: 2, total: 9, site: 'example.com', name: 'Hotjar', label: 'Analytics', list: 'a, b', names: 'A and B', many: true, who: 'Hotjar', host: 'x.test', status: 500, date: '1 May 2026', grade: 'B', score: 80, level: 'Some exposure', summary: 'x', ph: '[Your name]' };

test('German and Turkish have every message English has, and nothing extra', () => {
  const en = Object.keys(MESSAGES.en).sort();
  for (const lang of ['de', 'tr']) {
    const keys = Object.keys(MESSAGES[lang]).sort();
    assert.deepEqual(keys.filter((k) => !en.includes(k)), [], `${lang} has unknown keys`);
    assert.deepEqual(en.filter((k) => !keys.includes(k)), [], `${lang} is missing keys`);
  }
});

test('every message renders to a non-empty string in every language', () => {
  for (const lang of Object.keys(MESSAGES)) {
    setLang(lang);
    for (const key of Object.keys(MESSAGES.en)) {
      const out = t(key, SAMPLE_VARS);
      assert.equal(typeof out, 'string', `${lang}:${key}`);
      assert.ok(out.length > 0 || key === 'partial.after', `${lang}:${key} is empty`);
      assert.doesNotMatch(out, /undefined/, `${lang}:${key}`);
    }
  }
});

test('every tracker category has a label and description', () => {
  for (const k of Object.keys(CATEGORIES)) {
    for (const lang of Object.keys(MESSAGES)) {
      assert.ok(MESSAGES[lang][`cat.${k}`], `${lang} cat.${k}`);
      assert.ok(MESSAGES[lang][`cat.${k}.about`], `${lang} cat.${k}.about`);
    }
  }
});

test('browser language detection', () => {
  assert.equal(detectLang('de-AT'), 'de');
  assert.equal(detectLang('tr'), 'tr');
  assert.equal(detectLang('en-GB'), 'en');
  assert.equal(detectLang('fr-FR'), 'en');
  assert.equal(detectLang(undefined), 'en');
});

test('reports come out in the chosen language', () => {
  const raw = {
    url: 'https://shop.test/',
    hosts: { 'shop.test': { count: 3 }, 'static.hotjar.com': { count: 2, cookies: 1 }, 'connect.facebook.net': { count: 1 } },
    apis: { canvas: { sources: ['static.hotjar.com'] } },
    fields: { email: 1, name: 1 }
  };
  setLang('de');
  let r = analyze(raw);
  assert.equal(r.headline, '2 Tracking-Firmen können Ihren Besuch auf dieser Seite sehen.');
  assert.equal(r.kinds.find((k) => k.id === 'device').title, 'Ein Fingerabdruck Ihres Geräts');
  assert.match(r.kinds.find((k) => k.id === 'contact').evidence[0], /^Diese Seite hat ein Formular für: E-Mail-Adresse und Name/);
  assert.equal(r.companies.find((c) => c.name === 'Hotjar').categoryLabels[0], 'Sitzungsaufzeichnung');
  assert.equal(joinList(['A', 'B', 'C']), 'A, B und C');

  setLang('tr');
  r = analyze(raw);
  assert.equal(r.headline, '2 izleme şirketi bu sayfayı ziyaret ettiğinizi görebiliyor.');
  assert.equal(r.levelLabel, t(`level.${r.grade}`));
  assert.match(r.kinds.find((k) => k.id === 'device').evidence[0], /Grafik kartınızı tanımak için gizli bir görsel çizdi \(canvas\) – Hotjar tarafından/);

  const p = analyzePolicy('Wir verarbeiten Ihre IP-Adresse. Verantwortlicher ist die Beispiel AG. Sie haben ein Recht auf Auskunft.', { companies: r.companies, kinds: r.kinds });
  assert.equal(p.checklist.find((c) => c.id === 'controller').label, 'Verilerinizden kimin sorumlu olduğu');
  assert.ok(p.gaps.some((g) => g.text === 'Hotjar bu sayfada kullanılıyor (oturum kaydı), ancak politikada adı geçmiyor.'));
});
