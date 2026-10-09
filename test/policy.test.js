import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzePolicy, companiesNamed, sentences } from '../src/lib/policy.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, 'fixtures', f), 'utf8');
const ids = (list) => list.filter((x) => x.found).map((x) => x.id);

test('English policy: data, purposes, bases, rights and checklist', () => {
  const r = analyzePolicy(read('policy-en.txt'));
  assert.deepEqual(ids(r.data).sort(), ['browsing', 'contact', 'device', 'identifiers', 'payment'].sort());
  assert.ok(ids(r.purposes).includes('advertising'));
  assert.ok(ids(r.purposes).includes('analytics'));
  assert.deepEqual(ids(r.bases).sort(), ['consent', 'contract', 'legal', 'legitimate'].sort());
  assert.equal(r.rightsFound, 8);
  assert.equal(r.covered, 9);
  assert.equal(r.total, 9);
  assert.equal(r.rating, 'good');
  assert.equal(r.updated, '12 March 2026');
  assert.equal(r.language, 'en');
  // "We do not sell" is recognised as a denial, not as selling.
  const sale = r.purposes.find((p) => p.id === 'sale');
  assert.equal(sale.found, false);
  assert.equal(sale.denied, true);
  assert.ok(r.data.find((d) => d.id === 'contact').quote.includes('email address'));
});

test('German policy', () => {
  const r = analyzePolicy(read('policy-de.txt'));
  for (const id of ['identifiers', 'device', 'browsing', 'interactions']) assert.ok(ids(r.data).includes(id), id);
  assert.deepEqual(ids(r.bases).sort(), ['consent', 'legitimate']);
  for (const id of ['access', 'rectify', 'erase', 'restrict', 'withdraw', 'complain']) assert.ok(ids(r.rights).includes(id), id);
  assert.equal(r.checklist.find((c) => c.id === 'transfers').found, false);
  assert.equal(r.checklist.find((c) => c.id === 'controller').found, true);
  assert.equal(r.checklist.find((c) => c.id === 'retention').found, true);
  assert.equal(r.updated, '01.02.2026');
  assert.equal(r.language, 'de');
  assert.ok(r.named.includes('Hotjar'));
});

test('Turkish (KVKK) notice', () => {
  const r = analyzePolicy(read('policy-tr.txt'));
  for (const id of ['contact', 'identifiers']) assert.ok(ids(r.data).includes(id), id);
  assert.ok(ids(r.purposes).includes('advertising'));
  assert.deepEqual(ids(r.bases).sort(), ['consent', 'legitimate']);
  for (const id of ['access', 'rectify', 'erase', 'object', 'complain']) assert.ok(ids(r.rights).includes(id), id);
  assert.equal(r.checklist.find((c) => c.id === 'controller').found, true);
  assert.equal(r.checklist.find((c) => c.id === 'transfers').found, true);
  assert.equal(r.language, 'tr');
});

test('gaps: trackers and behaviour seen on the page but missing from the policy', () => {
  const r = analyzePolicy(read('policy-en.txt'), {
    companies: [
      { name: 'Google', categories: ['analytics', 'advertising'] },
      { name: 'Meta (Facebook)', categories: ['social'] },
      { name: 'Hotjar', categories: ['session-replay'] },
      { name: 'Cloudflare', categories: ['content'] }
    ],
    kinds: [{ id: 'interactions', status: 'likely' }, { id: 'device', status: 'seen' }, { id: 'location', status: 'seen' }]
  });
  const names = r.gaps.filter((g) => g.type === 'company').map((g) => g.name);
  assert.deepEqual(names, ['Hotjar']); // Google and Meta are named; Cloudflare is just content
  const kinds = r.gaps.filter((g) => g.type === 'data').map((g) => g.name).sort();
  assert.deepEqual(kinds, ['interactions', 'location']); // device details are mentioned
});

test('ambiguous company names need their domain', () => {
  assert.ok(!companiesNamed('We convert your data and keep a heap of records.').includes('Heap'));
  assert.ok(companiesNamed('We use Heap (heap.io) for analytics.').includes('Heap'));
  assert.ok(companiesNamed('We use Facebook Custom Audiences.').includes('Meta (Facebook)'));
  assert.ok(!companiesNamed('Our metadata is safe.').includes('Meta (Facebook)'));
});

test('sentences splits on punctuation and bullet points', () => {
  assert.equal(sentences('First sentence here. Second one is here too. • Bullet item text here').length, 3);
});

test('a parent company name does not count as naming its products', () => {
  const named = companiesNamed('We use Google Analytics and Microsoft Clarity.');
  assert.ok(named.includes('Google'));
  assert.ok(!named.includes('Google (YouTube)'));
  assert.ok(named.includes('Microsoft'));
  assert.ok(!named.includes('LinkedIn (Microsoft)'));
  assert.ok(!named.includes('Xandr (Microsoft)'));
  assert.ok(companiesNamed('Videos are embedded from YouTube.').includes('Google (YouTube)'));
});

test('wording from a large real-world policy', () => {
  const r = analyzePolicy(read('policy-real-style.txt'));
  assert.equal(r.updated, 'October 6, 2025'); // the current version, not an older one listed below it
  for (const id of ['contact', 'identifiers', 'device', 'location']) assert.ok(ids(r.data).includes(id), id);
  for (const id of ['service', 'analytics', 'personalisation', 'security']) assert.ok(ids(r.purposes).includes(id), id);
  const adv = r.purposes.find((p) => p.id === 'advertising');
  assert.equal(adv.found, false); // "never ... for marketing purposes" is a denial
  assert.equal(adv.denied, true);
  assert.equal(r.purposes.find((p) => p.id === 'sale').denied, true);
  for (const id of ['access', 'rectify', 'erase', 'restrict', 'portability', 'object', 'complain']) assert.ok(ids(r.rights).includes(id), id);
  assert.equal(r.checklist.find((c) => c.id === 'transfers').found, true);
  assert.equal(r.checklist.find((c) => c.id === 'retention').found, true);
});
