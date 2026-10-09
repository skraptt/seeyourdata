import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSite, getHost, isThirdParty } from '../src/lib/domain.js';
import { lookupTracker, TRACKERS, CATEGORIES } from '../src/lib/trackers.js';
import { analyze } from '../src/lib/analyze.js';

test('getSite handles common and multi-part suffixes', () => {
  assert.equal(getSite('www.example.com'), 'example.com');
  assert.equal(getSite('a.b.example.co.uk'), 'example.co.uk');
  assert.equal(getSite('shop.example.com.tr'), 'example.com.tr');
  assert.equal(getSite('me.github.io'), 'me.github.io');
  assert.equal(getSite('localhost'), 'localhost');
  assert.equal(getSite('192.168.0.1'), '192.168.0.1');
  assert.equal(getHost('https://Sub.Example.com:8080/x'), 'sub.example.com');
  assert.equal(isThirdParty('cdn.example.com', 'example.com'), false);
  assert.equal(isThirdParty('www.google-analytics.com', 'example.com'), true);
});

test('lookupTracker matches subdomains by suffix', () => {
  assert.equal(lookupTracker('stats.g.doubleclick.net').company, 'Google');
  assert.equal(lookupTracker('static.hotjar.com').category, 'session-replay');
  assert.equal(lookupTracker('connect.facebook.net').category, 'social');
  assert.equal(lookupTracker('notdoubleclick.net'), null);
  assert.equal(lookupTracker('example.com'), null);
});

test('tracker database is well-formed', () => {
  const seen = new Map();
  for (const t of TRACKERS) {
    assert.ok(CATEGORIES[t.category], `unknown category ${t.category} for ${t.company}`);
    for (const d of t.domains) {
      assert.match(d, /^[a-z0-9.-]+\.[a-z0-9-]+$/, `bad domain ${d}`);
      assert.ok(!seen.has(d), `${d} listed twice (${seen.get(d)} and ${t.company})`);
      seen.set(d, t.company);
    }
  }
});

test('a clean page gets an A', () => {
  const r = analyze({ url: 'https://example.com/', hosts: { 'example.com': { count: 5 }, 'static.example.com': { count: 10 } } });
  assert.equal(r.grade, 'A');
  assert.equal(r.score, 100);
  assert.equal(r.kinds.length, 0);
  assert.equal(r.stats.thirdPartySites, 0);
});

test('a heavily tracked page grades low and explains why', () => {
  const r = analyze({
    url: 'https://shop.example.com/cart',
    hosts: {
      'shop.example.com': { count: 20 },
      'www.google-analytics.com': { count: 3 },
      'stats.g.doubleclick.net': { count: 2, cookies: 1 },
      'connect.facebook.net': { count: 1 },
      'static.hotjar.com': { count: 4 },
      'bat.bing.com': { count: 1 },
      'cdn.mystery-cdn.io': { count: 2 }
    },
    apis: { canvas: { sources: ['static.hotjar.com'] }, geolocation: { sources: ['shop.example.com'] } },
    fields: { email: 1, card: 1, password: 1 },
    storage: { local: 4, session: 1 }
  });

  assert.ok(r.score < 50, `score ${r.score} should be below 50`);
  assert.ok(['D', 'F'].includes(r.grade));
  assert.equal(r.level, 'high');

  const ids = r.kinds.map((k) => k.id);
  for (const id of ['interactions', 'device', 'location', 'identifiers', 'browsing', 'contact', 'payment', 'ip']) {
    assert.ok(ids.includes(id), `missing kind ${id}`);
  }
  assert.equal(r.kinds.find((k) => k.id === 'device').status, 'seen');
  assert.equal(r.kinds.find((k) => k.id === 'interactions').status, 'likely');
  assert.equal(r.kinds.find((k) => k.id === 'contact').status, 'asked');
  assert.match(r.kinds.find((k) => k.id === 'device').evidence[0], /by Hotjar/);
  assert.match(r.kinds.find((k) => k.id === 'location').evidence[0], /by this site/);

  // Google's two domains collapse into one company; Microsoft too.
  assert.equal(r.companies.filter((c) => c.name === 'Google').length, 1);
  assert.equal(r.companies[0].name, 'Hotjar'); // heaviest weight first
  assert.deepEqual(r.unknown.map((u) => u.host), ['cdn.mystery-cdn.io']);
  assert.equal(r.stats.trackingCompanies, 4);
  assert.equal(r.stats.cookieSetters, 1);
});

test('first-party fingerprinting counts less than third-party', () => {
  const base = { url: 'https://example.com/', hosts: {} };
  const first = analyze({ ...base, apis: { canvas: { sources: ['example.com'] } } });
  const third = analyze({ ...base, apis: { canvas: { sources: ['fp.tracker.net'] } } });
  assert.ok(first.score > third.score);
});

test('report never contains raw HTML from hostnames', () => {
  // The popup escapes all values, but make sure analyze passes hosts through untouched (no eval, no parsing).
  const r = analyze({ url: 'https://example.com/', hosts: { '<img>.evil.net': { count: 1 } } });
  assert.equal(r.unknown[0].host, '<img>.evil.net');
});

test('self-hosted tracker code is recognised by its path', async () => {
  const { matchScriptPattern } = await import('../src/lib/trackers.js');
  assert.equal(matchScriptPattern('/static/vendor/@amplitude/analytics-browser.min.js').id, 'amplitude');
  assert.equal(matchScriptPattern('/akam/13/pixel_5e6a6164').id, 'akamai-bot');
  assert.equal(matchScriptPattern('/images/amplitude-graph.png'), null);
  assert.equal(matchScriptPattern('/blog/ss/notes'), null);
  assert.equal(matchScriptPattern('/static/js/main.js'), null);
});

test('self-hosted trackers show up as companies on first-party hosts', () => {
  const r = analyze({
    url: 'https://weather.example/',
    hosts: {
      'weather.example': { count: 50, sdks: { amplitude: 1, mparticle: 1, 'akamai-bot': 2 } },
      'cdn.weather.example': { count: 10 }
    }
  });
  const names = r.companies.map((c) => c.name);
  assert.ok(names.includes('Amplitude'));
  assert.ok(names.includes('mParticle (Rokt)'));
  assert.ok(names.includes('Akamai (Bot Manager)'));
  const amp = r.companies.find((c) => c.name === 'Amplitude');
  assert.deepEqual(amp.selfHosted, ['weather.example']);
  assert.deepEqual(amp.domains, []);
  assert.equal(r.unknown.length, 0);
  assert.equal(r.stats.trackingCompanies, 2); // bot protection isn't counted as tracking
  assert.ok(r.kinds.some((k) => k.id === 'browsing' && k.recipients.includes('Amplitude')));
  assert.ok(r.score < 100 && r.score >= 85);
});

test('an unknown CDN serving tracker code is not listed as unknown', () => {
  const r = analyze({ url: 'https://shop.example/', hosts: { 'cdn.somecdn.net': { count: 1, sdks: { 'meta-pixel': 1 } } } });
  assert.equal(r.unknown.length, 0);
  assert.equal(r.companies[0].name, 'Meta (Facebook)');
});
