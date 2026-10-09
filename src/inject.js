// Runs inside the page (MAIN world) before the page's own scripts.
//
// It watches a handful of browser features that are commonly used to
// fingerprint or locate visitors. It never changes what those features
// return; it only notes that they were used and by which script, then tells
// the extension's content script through a DOM event.

(() => {
  // No global marker on purpose: leaving one would let sites detect the extension.
  const EVENT = 'seeyourdata:api';
  const reported = new Set();
  const dispatch = EventTarget.prototype.dispatchEvent;
  const CustomEventCtor = window.CustomEvent;

  // Find the first script URL in the call stack that isn't this extension.
  function callerHost() {
    const stack = new Error().stack || '';
    const re = /(https?:\/\/[^\s)]+?):\d+:\d+/g;
    let m;
    while ((m = re.exec(stack))) {
      try { return new URL(m[1]).hostname; } catch { /* keep looking */ }
    }
    return location.hostname;
  }

  function report(api) {
    try {
      const source = callerHost();
      const key = api + '|' + source;
      if (reported.has(key)) return;
      reported.add(key);
      dispatch.call(document, new CustomEventCtor(EVENT, { detail: JSON.stringify({ api, source }) }));
    } catch { /* never break the page */ }
  }

  // Wrap a method with a Proxy so it still looks native to the page.
  function watch(target, prop, api, condition) {
    try {
      const original = target?.[prop];
      if (typeof original !== 'function') return;
      const proxy = new Proxy(original, {
        apply(fn, thisArg, args) {
          try { if (!condition || condition(thisArg, args)) report(api); } catch { /* ignore */ }
          return Reflect.apply(fn, thisArg, args);
        }
      });
      Object.defineProperty(target, prop, { ...Object.getOwnPropertyDescriptor(target, prop), value: proxy });
    } catch { /* ignore */ }
  }

  function watchCtor(owner, name, api) {
    try {
      const Original = owner[name];
      if (typeof Original !== 'function') return;
      const proxy = new Proxy(Original, {
        construct(target, args, newTarget) {
          report(api);
          return Reflect.construct(target, args, newTarget);
        }
      });
      Object.defineProperty(owner, name, { ...Object.getOwnPropertyDescriptor(owner, name), value: proxy });
    } catch { /* ignore */ }
  }

  // Canvas fingerprinting: reading pixels back out of a canvas the page drew on.
  const bigEnough = (canvas) => canvas && canvas.width * canvas.height >= 16 * 16;
  watch(HTMLCanvasElement.prototype, 'toDataURL', 'canvas', (c) => bigEnough(c));
  watch(HTMLCanvasElement.prototype, 'toBlob', 'canvas', (c) => bigEnough(c));
  watch(CanvasRenderingContext2D.prototype, 'getImageData', 'canvas', (ctx) => bigEnough(ctx?.canvas));
  if (window.OffscreenCanvas) watch(OffscreenCanvas.prototype, 'convertToBlob', 'canvas');

  // WebGL: asking for the unmasked GPU vendor/renderer.
  const UNMASKED = new Set([0x9245, 0x9246]); // UNMASKED_VENDOR_WEBGL, UNMASKED_RENDERER_WEBGL
  for (const ctx of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (ctx) watch(ctx.prototype, 'getParameter', 'webgl', (_, args) => UNMASKED.has(args[0]));
  }

  // Audio fingerprinting usually renders silence through an OfflineAudioContext.
  watchCtor(window, 'OfflineAudioContext', 'audio');
  if (window.webkitOfflineAudioContext) watchCtor(window, 'webkitOfflineAudioContext', 'audio');

  // Font probing: many document.fonts.check() calls in a row.
  if (window.FontFaceSet) {
    let fontChecks = 0;
    watch(FontFaceSet.prototype, 'check', 'fonts', () => ++fontChecks >= 20);
  }

  // High-entropy client hints (exact OS version, device model, CPU architecture).
  if (window.NavigatorUAData) watch(NavigatorUAData.prototype, 'getHighEntropyValues', 'uaHints');

  // Battery, devices, location, camera/microphone, clipboard.
  watch(Navigator.prototype, 'getBattery', 'battery');
  if (window.MediaDevices) {
    watch(MediaDevices.prototype, 'enumerateDevices', 'devices');
    watch(MediaDevices.prototype, 'getUserMedia', 'camera');
  }
  if (window.Geolocation) {
    watch(Geolocation.prototype, 'getCurrentPosition', 'geolocation');
    watch(Geolocation.prototype, 'watchPosition', 'geolocation');
  }
  if (window.Clipboard) {
    watch(Clipboard.prototype, 'readText', 'clipboard');
    watch(Clipboard.prototype, 'read', 'clipboard');
  }
})();
