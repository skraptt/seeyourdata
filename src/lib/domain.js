// Helpers for turning URLs into hosts and "sites" (registrable domains).
//
// A full Public Suffix List is ~200 KB. We ship a compact list of the
// multi-part suffixes that cover the vast majority of real traffic; anything
// else falls back to "last two labels". Contributions that swap this for a
// generated PSL subset are welcome.

const MULTI_PART_SUFFIXES = new Set([
  // Generic second-level registries
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk', 'me.uk', 'net.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'org.nz', 'govt.nz', 'ac.nz',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'co.kr', 'or.kr', 'go.kr',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'com.mx', 'org.mx', 'gob.mx',
  'com.ar', 'com.co', 'com.pe', 'com.ve', 'com.ec', 'com.uy',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn',
  'com.hk', 'com.tw', 'com.sg', 'com.my', 'com.ph', 'com.vn', 'co.th', 'co.id',
  'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in',
  'co.za', 'org.za', 'gov.za',
  'com.tr', 'gov.tr', 'org.tr', 'net.tr', 'edu.tr', 'k12.tr', 'gen.tr', 'bel.tr', 'av.tr',
  'com.eg', 'com.sa', 'com.pk', 'com.ng', 'co.ke', 'co.il', 'org.il', 'ac.il',
  'com.ua', 'co.at', 'or.at', 'gv.at', 'com.pl', 'net.pl', 'org.pl',
  'com.es', 'com.pt', 'com.gr', 'com.ru', 'co.it',
  // Platforms where every subdomain belongs to a different owner
  'github.io', 'gitlab.io', 'pages.dev', 'workers.dev', 'netlify.app', 'vercel.app',
  'herokuapp.com', 'firebaseapp.com', 'web.app', 'appspot.com', 'blogspot.com',
  'wordpress.com', 'tumblr.com', 'substack.com', 'myshopify.com', 'azurewebsites.net',
  'cloudfront.net', 's3.amazonaws.com', 'glitch.me', 'onrender.com', 'fly.dev'
]);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Returns the lowercase hostname of a URL, or '' if it has none. */
export function getHost(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Returns the registrable domain ("site") for a hostname, e.g. a.b.example.co.uk -> example.co.uk */
export function getSite(host) {
  if (!host) return '';
  host = host.toLowerCase().replace(/\.$/, '');
  if (IPV4.test(host) || host.includes(':') || !host.includes('.')) return host;
  const labels = host.split('.');
  for (let take = Math.min(labels.length - 1, 3); take >= 2; take--) {
    const suffix = labels.slice(-take).join('.');
    if (MULTI_PART_SUFFIXES.has(suffix)) {
      return labels.slice(-(take + 1)).join('.');
    }
  }
  return labels.slice(-2).join('.');
}

/** True when the URL points to a regular website we can analyse. */
export function isWebUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

/** True when `host` belongs to a different site than `firstPartySite`. */
export function isThirdParty(host, firstPartySite) {
  if (!host || !firstPartySite) return false;
  return getSite(host) !== firstPartySite;
}
