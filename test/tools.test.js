import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reportUrl } from '../src/config.js';

const here = dirname(fileURLToPath(import.meta.url));

test('rank.js lists unknown servers seen on 2+ pages, most widespread first', () => {
  const dir = mkdtempSync(join(tmpdir(), 'syd-'));
  copyFileSync(join(here, 'fixtures/crawl.jsonl'), join(dir, 'crawl.jsonl'));
  const out = execFileSync('node', [join(here, '../tools/rank.js'), join(dir, 'crawl.jsonl')], { encoding: 'utf8' });
  assert.match(out, /2 ok, 1 failed/);
  const md = readFileSync(join(dir, 'candidates.md'), 'utf8');
  assert.match(md, /## example-dsp\.net/);
  assert.match(md, /category: 'fingerprinting', domains: \['newfp\.io'\]/);
  assert.match(md, /category: 'advertising', domains: \['example-dsp\.net'\]/);
  assert.doesNotMatch(md, /hotjar/); // already known
  assert.doesNotMatch(md, /only-once/); // below --min-sites
  const csv = readFileSync(join(dir, 'candidates.csv'), 'utf8');
  assert.match(csv, /"hotjar\.com","1",.*"Hotjar"/);
});

test('report links carry only domains, never full page URLs', () => {
  const u = new URL(reportUrl({ domain: 'sync.example-dsp.net', seenOn: 'a-news.com' }));
  assert.equal(u.hostname, 'github.com');
  assert.equal(u.searchParams.get('template'), 'tracker.yml');
  assert.equal(u.searchParams.get('domain'), 'sync.example-dsp.net');
  assert.equal(u.searchParams.get('seen-on'), 'a-news.com');
  assert.equal(u.searchParams.get('title'), 'New tracker: sync.example-dsp.net');
});
