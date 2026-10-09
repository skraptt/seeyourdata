"""Visit many websites and record which outside servers each one contacts.

The output feeds tools/rank.js, which ranks those servers by how many sites
use them and flags the ones missing from src/lib/trackers.js.

Setup (once):
    pip install playwright
    playwright install chromium

Examples:
    # The 500 most popular sites from the Tranco list (downloaded automatically)
    python tools/crawl.py --tranco 500

    # Your own list: one domain or URL per line
    python tools/crawl.py --sites my-sites.txt

    # Many trackers only load after the cookie banner is accepted.
    # This clicks common "Accept all" buttons in the crawler's own throwaway browser.
    python tools/crawl.py --tranco 500 --accept-consent

Then:
    node tools/rank.js crawl-out/crawl.jsonl

Each site is opened in a fresh, empty browser profile; nothing is logged in.
"""

import argparse
import asyncio
import csv
import io
import json
import os
import sys
import time
import urllib.request
import zipfile
from urllib.parse import urlsplit

from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INJECT_JS = open(os.path.join(ROOT, 'src', 'inject.js'), encoding='utf-8').read()
TRANCO_URL = 'https://tranco-list.eu/top-1m.csv.zip'

# Collects the events inject.js fires, so we learn which scripts fingerprint.
COLLECTOR_JS = """
(() => {
  const found = [];
  Object.defineProperty(window, '__sydCrawl', { value: found });
  document.addEventListener('seeyourdata:api', (e) => {
    try { found.push(JSON.parse(e.detail)); } catch {}
  });
})();
"""

# Button labels that accept all cookies, in several languages. Lowercase.
ACCEPT_LABELS = [
    'accept all', 'accept all cookies', 'accept cookies', 'allow all', 'allow all cookies', 'i accept', 'agree', 'i agree',
    'accept', 'got it', 'alle akzeptieren', 'alle cookies akzeptieren', 'akzeptieren', 'zustimmen', 'einverstanden',
    'tout accepter', 'accepter', "j'accepte", 'aceptar todo', 'aceptar', 'aceitar', 'accetta tutto', 'accetta',
    'alles accepteren', 'accepteren', 'tümünü kabul et', 'kabul et', 'kabul ediyorum', 'zaakceptuj', 'godkänn alla',
]

SAMPLE_PATHS = 3


def load_sites(args):
    sites = []
    if args.sites:
        with open(args.sites, encoding='utf-8') as f:
            sites += [line.strip() for line in f if line.strip() and not line.startswith('#')]
    if args.tranco:
        print(f'Downloading the Tranco top list from {TRANCO_URL} ...', file=sys.stderr)
        data = urllib.request.urlopen(TRANCO_URL, timeout=60).read()
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            name = z.namelist()[0]
            reader = csv.reader(io.TextIOWrapper(z.open(name), encoding='utf-8'))
            for i, row in enumerate(reader):
                if i >= args.tranco:
                    break
                sites.append(row[1])
    urls = []
    for s in sites:
        urls.append(s if '://' in s else f'https://{s}/')
    return urls


async def accept_consent(page):
    """Click the first visible button whose text is an "accept all" label, in any frame."""
    for frame in page.frames:
        try:
            buttons = await frame.query_selector_all('button, [role=button], a[role=button], input[type=submit]')
            for b in buttons[:200]:
                text = ((await b.inner_text()) if await b.evaluate('e => e.tagName !== "INPUT"') else (await b.get_attribute('value') or ''))
                text = ' '.join(text.lower().split())
                if text in ACCEPT_LABELS and await b.is_visible():
                    await b.click(timeout=2000)
                    return True
        except Exception:
            continue
    return False


async def crawl_one(browser, url, args):
    started = time.time()
    hosts = {}
    record = {'url': url, 'ok': False, 'hosts': hosts, 'apis': {}, 'consentClicked': False}
    context = await browser.new_context(
        viewport={'width': 1366, 'height': 900},
        locale=args.locale,
        ignore_https_errors=True,
    )
    await context.add_init_script(COLLECTOR_JS)
    await context.add_init_script(INJECT_JS)
    page = await context.new_page()

    def on_request(req):
        try:
            u = urlsplit(req.url)
            if u.scheme not in ('http', 'https') or not u.hostname:
                return
            h = hosts.setdefault(u.hostname, {'count': 0, 'types': {}, 'cookies': 0, 'paths': []})
            h['count'] += 1
            h['types'][req.resource_type] = h['types'].get(req.resource_type, 0) + 1
            if len(h['paths']) < SAMPLE_PATHS and u.path not in h['paths']:
                h['paths'].append(u.path[:120])
        except Exception:
            pass

    async def on_response(resp):
        try:
            if 'set-cookie' in await resp.all_headers():
                host = urlsplit(resp.url).hostname
                if host in hosts:
                    hosts[host]['cookies'] += 1
        except Exception:
            pass

    page.on('request', on_request)
    page.on('response', lambda r: asyncio.ensure_future(on_response(r)))
    page.on('popup', lambda p: asyncio.ensure_future(p.close()))

    try:
        resp = await page.goto(url, wait_until='domcontentloaded', timeout=args.timeout * 1000)
        record['finalUrl'] = page.url
        record['status'] = resp.status if resp else None
        await page.wait_for_timeout(args.wait * 1000)
        # Scroll to trigger lazy-loaded ads and widgets.
        for _ in range(3):
            await page.mouse.wheel(0, 1200)
            await page.wait_for_timeout(500)
        if args.accept_consent and await accept_consent(page):
            record['consentClicked'] = True
            await page.wait_for_timeout(args.wait * 1000)
        for ev in await page.evaluate('window.__sydCrawl || []'):
            api, source = ev.get('api'), ev.get('source', '')
            lst = record['apis'].setdefault(api, [])
            if source not in lst:
                lst.append(source)
        record['ok'] = True
    except Exception as e:
        record['error'] = str(e).splitlines()[0][:200]
        record['finalUrl'] = page.url
    finally:
        record['seconds'] = round(time.time() - started, 1)
        await context.close()
    return record


async def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sites', help='file with one domain or URL per line')
    ap.add_argument('--tranco', type=int, help='crawl the top N sites of the Tranco list')
    ap.add_argument('--out', default='crawl-out', help='output folder (default: crawl-out)')
    ap.add_argument('--concurrency', type=int, default=4)
    ap.add_argument('--wait', type=int, default=6, help='seconds to wait after the page loads')
    ap.add_argument('--timeout', type=int, default=30, help='page load timeout in seconds')
    ap.add_argument('--accept-consent', action='store_true', help='click "Accept all" on cookie banners')
    ap.add_argument('--locale', default='en-US')
    ap.add_argument('--headed', action='store_true', help='show the browser window')
    ap.add_argument('--chromium-arg', action='append', default=[], help=argparse.SUPPRESS)
    args = ap.parse_args()

    urls = load_sites(args)
    if not urls:
        ap.error('give --sites FILE or --tranco N')
    os.makedirs(args.out, exist_ok=True)
    out_path = os.path.join(args.out, 'crawl.jsonl')

    # Resume: skip URLs already in the output file.
    done = set()
    if os.path.exists(out_path):
        with open(out_path, encoding='utf-8') as f:
            for line in f:
                try:
                    done.add(json.loads(line)['url'])
                except Exception:
                    pass
    todo = [u for u in urls if u not in done]
    print(f'{len(todo)} sites to crawl ({len(done)} already done) -> {out_path}', file=sys.stderr)

    sem = asyncio.Semaphore(args.concurrency)
    lock = asyncio.Lock()
    counter = {'n': 0}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not args.headed, args=args.chromium_arg)

        async def worker(url):
            async with sem:
                rec = await crawl_one(browser, url, args)
            async with lock:
                with open(out_path, 'a', encoding='utf-8') as f:
                    f.write(json.dumps(rec) + '\n')
                counter['n'] += 1
                status = 'ok' if rec['ok'] else 'failed: ' + rec.get('error', '')
                print(f"[{counter['n']}/{len(todo)}] {url} {len(rec['hosts'])} hosts, {status}", file=sys.stderr)

        await asyncio.gather(*(worker(u) for u in todo))
        await browser.close()

    print(f'\nDone. Next: node tools/rank.js {out_path}', file=sys.stderr)


if __name__ == '__main__':
    asyncio.run(main())
