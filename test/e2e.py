"""End-to-end check: loads the extension in Chromium, opens a demo page with fake
trackers (all served locally), and saves popup screenshots.

    pip install playwright && playwright install chromium
    python test/e2e.py /tmp/shots [en de tr]
"""
import http.server, threading, socketserver, time, json, sys
from playwright.sync_api import sync_playwright
import os
EXT=os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); OUT=sys.argv[1] if len(sys.argv) > 1 else '.'

PAGE=b"""<!doctype html><html><head><title>Demo Shop</title>
<script src="http://static.hotjar.com/c/hotjar.js"></script>
<script src="http://connect.facebook.net/en_US/fbevents.js"></script>
<script src="http://www.google-analytics.com/analytics.js"></script>
<script src="http://cdn.mystery-cdn.io/lib.js"></script>
<script src="/vendor/@amplitude/analytics-browser.min.js"></script>
<img src="/akam/13/pixel_abc">
</head><body><h1>Checkout</h1>
<form><label>Email <input type=email name=email></label>
<input name=phone placeholder="Phone number"><input autocomplete="cc-number" name=cc>
<input type=password name=pw><input name=street placeholder="Street address"></form>
<img src="http://stats.g.doubleclick.net/pixel.gif">
<script>localStorage.setItem('a','1');document.cookie='sid=1';
const c=document.createElement('canvas');c.width=200;c.height=50;c.getContext('2d').fillText('hi',2,2);c.toDataURL();
navigator.geolocation && navigator.geolocation.getCurrentPosition(()=>{},()=>{});</script>
<footer><a href="/privacy">Privacy Policy</a></footer></body></html>"""
POLICY_HTML=b"""<!doctype html><html><head><title>Privacy Policy</title></head><body>
<nav><a href="/">Home</a></nav><main><h1>Privacy Policy</h1><p>Last updated: 12 March 2026</p>
<p>Demo Shop GmbH is the data controller responsible for processing your personal data.</p>
<h2>What we collect</h2><p>When you order, we collect your name, email address, postal address and payment information. We also collect your IP address and browser type.</p>
<h2>Why</h2><p>We use your data to provide our services and fulfil your orders. We use Google Analytics to measure the use of our website and, with your consent, the Meta pixel for advertising.</p>
<h2>Legal bases</h2><p>We rely on the performance of a contract and your consent.</p>
<h2>Sharing</h2><p>We share data with service providers such as payment processors.</p>
<h2>Your rights</h2><p>You have the right of access, rectification and erasure. You may withdraw your consent at any time.</p>
<p>Questions? Contact our data protection officer at privacy@demo.test.</p>
<h2>Cookies</h2><p>We use cookies that are necessary for the shopping cart and checkout to work. With your consent we also use cookies to measure how our website is used and to show you relevant offers. You can change your cookie settings at any time using the link in the footer of every page.</p>
<h2>Retention</h2><p>We keep order data for ten years because tax law requires it. Account data is deleted when you close your account. Server log files are deleted after fourteen days.</p>
<h2>Transfers</h2><p>Some of our service providers are located outside the European Economic Area. In those cases we rely on standard contractual clauses approved by the European Commission to protect your data.</p>
<h2>Complaints</h2><p>You have the right to lodge a complaint with a supervisory authority, in particular in the member state where you live or work.</p>
<h2>Changes</h2><p>We may update this privacy policy when our services or the law change. The date at the top of this page shows when it was last updated. Please check it from time to time.</p>
</main></body></html>"""
TRACKER_JS=b"(function(){var c=document.createElement('canvas');c.width=300;c.height=60;var x=c.getContext('2d');x.fillText('fp',1,1);c.toDataURL();})();"

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        host=self.headers.get('Host','')
        if self.server.server_address[1]==8100:
            body,ct=(POLICY_HTML,'text/html') if self.path.startswith('/privacy') else (PAGE,'text/html')
        else:
            body,ct=(TRACKER_JS,'text/javascript') if self.path.endswith('.js') else (b'GIF89a',"image/gif")
        self.send_response(200); self.send_header('Content-Type',ct)
        if 'doubleclick' in host or 'facebook' in host: self.send_header('Set-Cookie','id=abc; Path=/')
        self.end_headers(); self.wfile.write(body)
class Srv(socketserver.ThreadingTCPServer):
    allow_reuse_address=True
for port in (8100,8101):
    s=Srv(('127.0.0.1',port),H); s.daemon_threads=True
    threading.Thread(target=s.serve_forever,daemon=True).start()

with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context('',channel='chromium',headless=True,args=[
        f'--disable-extensions-except={EXT}',f'--load-extension={EXT}',
        '--host-resolver-rules=MAP shop.demo.test 127.0.0.1:8100, MAP * 127.0.0.1:8101, EXCLUDE localhost'])
    ctx.grant_permissions(['geolocation'])
    sw=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
    page=ctx.new_page(); errors=[]
    page.on('console',lambda m: m.type=='error' and errors.append(m.text))
    sw.evaluate('1'); time.sleep(1)
    sw.on('console', lambda m: print('SW', m.type, m.text))
    page.goto('http://shop.demo.test/checkout'); time.sleep(4)
    tab=sw.evaluate("chrome.tabs.query({}).then(t=>t.find(x=>x.url.includes('shop.demo.test')))")
    state=sw.evaluate(f"chrome.storage.session.get('tab:{tab['id']}')")
    badge=sw.evaluate(f"chrome.action.getBadgeText({{tabId:{tab['id']}}})")
    print('BADGE',badge); print(json.dumps(state,indent=1)[:2500]); print('PAGE ERRORS',errors)
    extid=sw.url.split('/')[2]
    LANGS=[a for a in sys.argv[2:]] or ['en']
    for lang in LANGS:
        sw.evaluate(f"chrome.storage.local.set({{uiLang: '{lang}'}})")
        OUTL=f'{OUT}/{lang}' if len(LANGS)>1 else OUT
        import os; os.makedirs(OUTL, exist_ok=True)
        for scheme in ('light','dark'):
            pop=ctx.new_page(); pop.emulate_media(color_scheme=scheme); perr=[]
            pop.on('pageerror',lambda e: perr.append(str(e)))
            pop.set_viewport_size({'width':380,'height':600})
            pop.goto(f'chrome-extension://{extid}/popup/popup.html?tabId={tab["id"]}'); time.sleep(1.2)
            pop.evaluate("document.body.classList.remove('page')")
            if scheme=='light':
                pop.click('details.sev-3 summary')  # expand first row
            pop.screenshot(path=f'{OUTL}/popup-{scheme}.png',full_page=True)
            pop.click('[data-tab=companies]'); time.sleep(0.2); pop.click('details.unknown summary'); pop.click('details[data-key="c:Amplitude"] summary')
            pop.screenshot(path=f'{OUTL}/companies-{scheme}.png',full_page=True)
            pop.click('[data-tab=details]'); pop.screenshot(path=f'{OUTL}/details-{scheme}.png',full_page=True)
            pop.click('[data-tab=policy]'); time.sleep(0.2)
            pop.screenshot(path=f'{OUTL}/policy-intro-{scheme}.png',full_page=True)
            if not pop.query_selector('.pol-summary'): pop.click('[data-action=read-policy]')  # second run uses the remembered result
            pop.wait_for_selector('.pol-summary', timeout=15000)
            pop.click('details[data-key="pd:contact"] summary')
            pop.screenshot(path=f'{OUTL}/policy-{scheme}.png',full_page=True)
            with ctx.expect_page() as new_page:
                pop.click('[data-action=email-site]')
            comp = new_page.value; comp.emulate_media(color_scheme=scheme); comp.set_viewport_size({'width':900,'height':1100})
            comp.wait_for_selector('#body', timeout=10000); time.sleep(0.3)
            body = comp.input_value('#body')
            print(scheme, 'EMAIL to=', comp.input_value('#to'), '| hotjar' if 'Hotjar' in body else '| NO HOTJAR', '| subject=', comp.input_value('#subject'))
            comp.screenshot(path=f'{OUTL}/compose-{scheme}.png', full_page=True)
            comp.close()
            print(scheme, 'POLICY', pop.inner_text('.pol-summary h2'), '|', (pop.inner_text('.pol-gaps') if pop.query_selector('.pol-gaps') else 'no gaps').replace(chr(10), ' / '))
            print(scheme,'POPUP ERRORS',perr)
    pop=ctx.new_page(); pop.set_viewport_size({'width':380,'height':600})
    pop.goto(f'chrome-extension://{extid}/popup/popup.html?tabId={tab["id"]}'); time.sleep(1)
    before=pop.inner_text('#tab-collects')
    pop.select_option('#lang-switch','tr'); time.sleep(0.6)
    print('SWITCH', before.split()[0:2], '->', pop.inner_text('#tab-collects').split()[0], '| saved:', sw.evaluate("chrome.storage.local.get('uiLang').then(r=>r.uiLang)"), '| html lang:', pop.evaluate('document.documentElement.lang'))
    ctx.close()
