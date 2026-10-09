import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../src/lib/analyze.js';
import { analyzePolicy } from '../src/lib/policy.js';
import { findContactEmail, cleanUrl, collectEvidence, buildEmail, mailtoUrl, gmailUrl } from '../src/lib/complaint.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, 'fixtures', f), 'utf8');

function scenario(policyFile = 'policy-en.txt') {
  const report = analyze({
    url: 'https://shop.example-shop.test/checkout?session=SECRET123#pay',
    hosts: {
      'shop.example-shop.test': { count: 20, sdks: { amplitude: 1 } },
      'static.hotjar.com': { count: 4, cookies: 1 },
      'www.google-analytics.com': { count: 2 },
      'connect.facebook.net': { count: 1 }
    },
    apis: { canvas: { sources: ['static.hotjar.com'] }, geolocation: { sources: ['shop.example-shop.test'] } }
  });
  const policyText = read(policyFile);
  const analysis = analyzePolicy(policyText, { companies: report.companies, kinds: report.kinds });
  const evidence = collectEvidence({ report, analysis, policyText, policyUrl: 'https://shop.example-shop.test/privacy?ref=footer', observedAt: Date.UTC(2026, 9, 9, 12, 0) });
  return { report, analysis, evidence };
}

test('finds the privacy contact address and skips marketing addresses', () => {
  assert.equal(findContactEmail('Write to sales@shop.test. Our data protection officer: dpo@shop.test.'), 'dpo@shop.test');
  assert.equal(findContactEmail('Datenschutzbeauftragter: Max Muster, datenschutz@beispiel.de'), 'datenschutz@beispiel.de');
  assert.equal(findContactEmail('Questions? info@shop.test'), 'info@shop.test');
  assert.equal(findContactEmail('newsletter@shop.test'), '');
  assert.equal(findContactEmail('no address here'), '');
  assert.equal(findContactEmail(read('policy-en.txt')), 'dpo@example-shop.test');
});

test('URLs in the email never include query strings or fragments', () => {
  assert.equal(cleanUrl('https://a.test/x/y?token=abc#frag'), 'https://a.test/x/y');
  const { evidence } = scenario();
  assert.equal(evidence.pageUrl, 'https://shop.example-shop.test/checkout');
  assert.equal(evidence.policyUrl, 'https://shop.example-shop.test/privacy');
  const { body } = buildEmail(evidence);
  assert.ok(!body.includes('SECRET123'));
});

test('evidence lists unnamed companies and unmentioned behaviour', () => {
  const { evidence } = scenario();
  const companies = evidence.items.filter((i) => i.kind === 'company').map((i) => i.company);
  assert.deepEqual(companies.sort(), ['Amplitude', 'Hotjar']); // Google and Meta are named in the policy
  const hotjar = evidence.items.find((i) => i.company === 'Hotjar');
  assert.deepEqual(hotjar.servers, ['static.hotjar.com']);
  assert.equal(hotjar.requests, 4);
  assert.equal(hotjar.setsCookies, true);
  const amp = evidence.items.find((i) => i.company === 'Amplitude');
  assert.deepEqual(amp.hiddenIn, ['shop.example-shop.test']);
  const data = evidence.items.filter((i) => i.kind === 'data').map((i) => i.data).sort();
  assert.deepEqual(data, ['interactions', 'location']);
  assert.equal(evidence.contactEmail, 'dpo@example-shop.test');
  assert.equal(evidence.language, 'en');
});

test('English email reads well and contains the evidence', () => {
  const { evidence } = scenario();
  const mail = buildEmail(evidence);
  assert.equal(mail.to, 'dpo@example-shop.test');
  assert.match(mail.subject, /example-shop\.test/);
  assert.match(mail.body, /My browser contacted static\.hotjar\.com \(4 requests\) and received a cookie\./);
  assert.match(mail.body, /Your privacy policy does not name Hotjar\./);
  assert.match(mail.body, /Code from Amplitude was loaded through shop\.example-shop\.test\./);
  assert.match(mail.body, /This website itself: asked for the precise GPS location\./);
  assert.match(mail.body, /Art\. 13 GDPR/);
  assert.match(mail.body, /last updated 12 March 2026/);
  assert.doesNotMatch(mail.body, /Art\. 15/);
  assert.match(buildEmail(evidence, { accessRequest: true }).body, /Art\. 15 GDPR/);
});

test('German and Turkish emails', () => {
  const de = buildEmail(scenario('policy-de.txt').evidence);
  assert.equal(scenario('policy-de.txt').evidence.language, 'de');
  assert.match(de.body, /^Sehr geehrte Damen und Herren,/);
  assert.match(de.body, /Art\. 13 DSGVO/);
  assert.match(de.body, /Stand 01\.02\.2026/);
  const tr = buildEmail(scenario('policy-tr.txt').evidence);
  assert.match(tr.body, /^Merhaba,/);
  assert.match(tr.body, /KVKK m\. 10/);
  assert.match(tr.body, /Sitenin kendisi: tam GPS konumunu istedi\./);
  // Language can be chosen regardless of the policy's language.
  assert.match(buildEmail(scenario('policy-de.txt').evidence, { lang: 'en' }).body, /^Hello,/);
});

test('mail links carry the draft', () => {
  const m = { to: 'dpo@shop.test', subject: 'Hi & bye', body: 'Line 1\nLine 2' };
  assert.equal(mailtoUrl(m), 'mailto:dpo@shop.test?subject=Hi%20%26%20bye&body=Line%201%0ALine%202');
  const g = new URL(gmailUrl(m));
  assert.equal(g.searchParams.get('to'), 'dpo@shop.test');
  assert.equal(g.searchParams.get('body'), 'Line 1\nLine 2');
});
