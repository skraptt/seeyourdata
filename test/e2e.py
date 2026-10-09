"""End-to-end check: loads the extension in Chromium, opens a demo page with fake
trackers (all served locally), and saves popup screenshots.

    pip install playwright && playwright install chromium
    python test/e2e.py /tmp/shots
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
</head><body><h1>Checkout</h1>
<form><label>Email <input type=email name=email></label>
<input name=phone placeholder="Phone number"><input autocomplete="cc-number" name=cc>
<input type=password name=pw><input name=street placeholder="Street address"></form>
<img src="http://stats.g.doubleclick.net/pixel.gif">
<script>localStorage.setItem('a','1');document.cookie='sid=1';
const c=document.createElement('canvas');c.width=200;c.height=50;c.getContext('2d').fillText('hi',2,2);c.toDataURL();
navigator.geolocation && navigator.geolocation.getCurrentPosition(()=>{},()=>{});</script>
<footer><a href="/privacy">Privacy Policy</a></footer></body></html>"""
TRACKER_JS=b"(function(){var c=document.createElement('canvas');c.width=300;c.height=60;var x=c.getContext('2d');x.fillText('fp',1,1);c.toDataURL();})();"

class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        host=self.headers.get('Host','')
        if self.server.server_address[1]==8100:
            body,ct=PAGE,'text/html'
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
    for scheme in ('light','dark'):
        pop=ctx.new_page(); pop.emulate_media(color_scheme=scheme); perr=[]
        pop.on('pageerror',lambda e: perr.append(str(e)))
        pop.set_viewport_size({'width':380,'height':600})
        pop.goto(f'chrome-extension://{extid}/popup/popup.html?tabId={tab["id"]}'); time.sleep(1.2)
        pop.evaluate("document.body.classList.remove('page')")
        if scheme=='light':
            pop.click('details.sev-3 summary')  # expand first row
        pop.screenshot(path=f'{OUT}/popup-{scheme}.png',full_page=True)
        pop.click('[data-tab=companies]'); time.sleep(0.2); pop.click('details.unknown summary'); pop.click('details.company summary')
        pop.screenshot(path=f'{OUT}/companies-{scheme}.png',full_page=True)
        pop.click('[data-tab=details]'); pop.screenshot(path=f'{OUT}/details-{scheme}.png',full_page=True)
        print(scheme,'POPUP ERRORS',perr)
    ctx.close()
