// The tracker database.
//
// Each entry maps one company's domains to what they do on websites.
// `category` decides which kinds of personal data we say the company is likely
// to receive (see CATEGORIES). Matching is by domain suffix, so listing
// "doubleclick.net" also covers "stats.g.doubleclick.net".
//
// To add a tracker: append an entry, keep domains lowercase and without
// protocol, and run `npm test`. Please cite a source (company docs, a
// blocklist entry, or a network capture) in your pull request.

export const CATEGORIES = {
  advertising: {
    label: 'Advertising',
    weight: 10,
    data: ['browsing', 'identifiers'],
    about: 'Builds a profile of your interests to target ads, often across many websites.'
  },
  'session-replay': {
    label: 'Session recording',
    weight: 15,
    data: ['interactions', 'browsing', 'device'],
    about: 'Records how you move, click, scroll and type on the page so it can be replayed later.'
  },
  fingerprinting: {
    label: 'Device fingerprinting',
    weight: 12,
    data: ['device', 'identifiers'],
    about: 'Identifies your browser from its technical traits, which works even when you clear cookies.'
  },
  social: {
    label: 'Social network',
    weight: 8,
    data: ['browsing', 'identifiers'],
    about: 'Lets a social network see that you visited this page, and link it to your account if you are logged in.'
  },
  analytics: {
    label: 'Analytics',
    weight: 5,
    data: ['browsing', 'device'],
    about: 'Measures which pages you view, for how long, and on what device.'
  },
  customer: {
    label: 'Chat & marketing',
    weight: 4,
    data: ['browsing', 'contact'],
    about: 'Chat widgets, email marketing and CRM tools that can link your visit to your name or email.'
  },
  performance: {
    label: 'Performance monitoring',
    weight: 1,
    data: ['device'],
    about: 'Collects errors and load times, along with details about your browser.'
  },
  consent: {
    label: 'Cookie consent',
    weight: 0,
    data: [],
    about: 'Shows the cookie banner and stores your choice.'
  },
  payments: {
    label: 'Payments',
    weight: 0,
    data: ['payment'],
    about: 'Processes card payments. Receives payment details when you check out.'
  },
  content: {
    label: 'Fonts, media & embeds',
    weight: 1,
    data: [],
    about: 'Serves fonts, videos or other content. Sees your IP address and which page you are on.'
  }
};

/** @type {{company: string, category: keyof typeof CATEGORIES, domains: string[]}[]} */
export const TRACKERS = [
  // ---- Google
  { company: 'Google', category: 'advertising', domains: ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com', 'googletagservices.com', 'pagead2.googlesyndication.com'] },
  { company: 'Google', category: 'analytics', domains: ['google-analytics.com', 'analytics.google.com', 'googletagmanager.com'] },
  { company: 'Google', category: 'content', domains: ['fonts.googleapis.com', 'fonts.gstatic.com', 'ajax.googleapis.com', 'maps.googleapis.com', 'gstatic.com'] },
  { company: 'Google (YouTube)', category: 'social', domains: ['youtube.com', 'youtube-nocookie.com', 'ytimg.com', 'googlevideo.com'] },

  // ---- Meta
  { company: 'Meta (Facebook)', category: 'social', domains: ['facebook.net', 'facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com'] },

  // ---- Microsoft
  { company: 'Microsoft', category: 'session-replay', domains: ['clarity.ms'] },
  { company: 'Microsoft', category: 'advertising', domains: ['bat.bing.com', 'bing.com'] },
  { company: 'LinkedIn (Microsoft)', category: 'social', domains: ['licdn.com', 'linkedin.com', 'ads.linkedin.com'] },

  // ---- Other social
  { company: 'X (Twitter)', category: 'social', domains: ['ads-twitter.com', 'twitter.com', 'twimg.com', 'x.com', 't.co'] },
  { company: 'TikTok (ByteDance)', category: 'social', domains: ['tiktok.com', 'tiktokw.us', 'ttwstatic.com', 'byteoversea.com'] },
  { company: 'Pinterest', category: 'social', domains: ['pinterest.com', 'pinimg.com'] },
  { company: 'Snap', category: 'social', domains: ['snapchat.com', 'sc-static.net'] },
  { company: 'Reddit', category: 'social', domains: ['redditstatic.com', 'reddit.com', 'redditmedia.com'] },
  { company: 'Oracle (AddThis)', category: 'social', domains: ['addthis.com', 'addthisedge.com'] },
  { company: 'ShareThis', category: 'social', domains: ['sharethis.com'] },
  { company: 'Disqus', category: 'social', domains: ['disqus.com', 'disquscdn.com'] },

  // ---- Advertising & data brokers
  { company: 'Amazon Ads', category: 'advertising', domains: ['amazon-adsystem.com', 'assoc-amazon.com'] },
  { company: 'Criteo', category: 'advertising', domains: ['criteo.com', 'criteo.net'] },
  { company: 'Taboola', category: 'advertising', domains: ['taboola.com', 'taboolasyndication.com'] },
  { company: 'Outbrain', category: 'advertising', domains: ['outbrain.com', 'outbrainimg.com'] },
  { company: 'The Trade Desk', category: 'advertising', domains: ['adsrvr.org'] },
  { company: 'Index Exchange', category: 'advertising', domains: ['casalemedia.com', 'indexww.com'] },
  { company: 'PubMatic', category: 'advertising', domains: ['pubmatic.com'] },
  { company: 'Magnite', category: 'advertising', domains: ['rubiconproject.com'] },
  { company: 'OpenX', category: 'advertising', domains: ['openx.net'] },
  { company: 'Xandr (Microsoft)', category: 'advertising', domains: ['adnxs.com'] },
  { company: 'Quantcast', category: 'advertising', domains: ['quantserve.com', 'quantcount.com', 'quantcast.com'] },
  { company: 'Lotame', category: 'advertising', domains: ['crwdcntrl.net'] },
  { company: 'LiveRamp', category: 'advertising', domains: ['rlcdn.com', 'pippio.com'] },
  { company: 'ID5', category: 'advertising', domains: ['id5-sync.com'] },
  { company: 'Media.net', category: 'advertising', domains: ['media.net'] },
  { company: 'Sovrn', category: 'advertising', domains: ['lijit.com', 'sovrn.com'] },
  { company: 'Equativ', category: 'advertising', domains: ['smartadserver.com'] },
  { company: 'Teads', category: 'advertising', domains: ['teads.tv'] },
  { company: 'Adform', category: 'advertising', domains: ['adform.net', 'adformdsp.net'] },
  { company: 'Bidswitch', category: 'advertising', domains: ['bidswitch.net'] },
  { company: 'Sharethrough', category: 'advertising', domains: ['sharethrough.com'] },
  { company: '33Across', category: 'advertising', domains: ['33across.com'] },
  { company: 'Tapad', category: 'advertising', domains: ['tapad.com'] },
  { company: 'Oracle (BlueKai)', category: 'advertising', domains: ['bluekai.com'] },
  { company: 'Adobe', category: 'advertising', domains: ['demdex.net', 'everesttech.net'] },
  { company: 'Adobe', category: 'analytics', domains: ['omtrdc.net', 'adobedtm.com', '2o7.net'] },
  { company: 'Yahoo', category: 'advertising', domains: ['ads.yahoo.com', 'analytics.yahoo.com', 'yahooinc.com'] },
  { company: 'Yandex', category: 'analytics', domains: ['mc.yandex.ru', 'yandex.ru', 'yandex.com'] },
  { company: 'comScore', category: 'analytics', domains: ['scorecardresearch.com'] },
  { company: 'Nielsen', category: 'analytics', domains: ['imrworldwide.com'] },

  // ---- Session recording
  { company: 'Hotjar', category: 'session-replay', domains: ['hotjar.com', 'hotjar.io'] },
  { company: 'FullStory', category: 'session-replay', domains: ['fullstory.com'] },
  { company: 'Mouseflow', category: 'session-replay', domains: ['mouseflow.com'] },
  { company: 'Smartlook', category: 'session-replay', domains: ['smartlook.com', 'smartlook.cloud'] },
  { company: 'LogRocket', category: 'session-replay', domains: ['logrocket.io', 'lr-ingest.io', 'lr-in.com', 'logrocket.com'] },
  { company: 'Lucky Orange', category: 'session-replay', domains: ['luckyorange.com', 'luckyorange.net'] },
  { company: 'Crazy Egg', category: 'session-replay', domains: ['crazyegg.com'] },
  { company: 'Inspectlet', category: 'session-replay', domains: ['inspectlet.com'] },
  { company: 'Quantum Metric', category: 'session-replay', domains: ['quantummetric.com'] },
  { company: 'Contentsquare', category: 'session-replay', domains: ['contentsquare.net', 'contentsquare.com'] },

  // ---- Product analytics
  { company: 'Mixpanel', category: 'analytics', domains: ['mixpanel.com', 'mxpnl.com'] },
  { company: 'Amplitude', category: 'analytics', domains: ['amplitude.com'] },
  { company: 'Segment (Twilio)', category: 'analytics', domains: ['segment.com', 'segment.io'] },
  { company: 'Heap', category: 'analytics', domains: ['heap.io', 'heapanalytics.com'] },
  { company: 'PostHog', category: 'analytics', domains: ['posthog.com', 'i.posthog.com'] },
  { company: 'Matomo Cloud', category: 'analytics', domains: ['matomo.cloud'] },
  { company: 'Chartbeat', category: 'analytics', domains: ['chartbeat.com', 'chartbeat.net'] },
  { company: 'Optimizely', category: 'analytics', domains: ['optimizely.com'] },
  { company: 'VWO', category: 'analytics', domains: ['visualwebsiteoptimizer.com', 'wingify.com'] },
  { company: 'Plausible', category: 'performance', domains: ['plausible.io'] },
  { company: 'Fathom', category: 'performance', domains: ['usefathom.com'] },

  // ---- Performance monitoring
  { company: 'New Relic', category: 'performance', domains: ['nr-data.net', 'newrelic.com'] },
  { company: 'Datadog', category: 'performance', domains: ['datadoghq.com', 'datadoghq.eu', 'browser-intake-datadoghq.com'] },
  { company: 'Sentry', category: 'performance', domains: ['sentry.io', 'sentry-cdn.com'] },

  // ---- Chat, CRM & marketing
  { company: 'Intercom', category: 'customer', domains: ['intercom.io', 'intercomcdn.com', 'intercomassets.com'] },
  { company: 'Zendesk', category: 'customer', domains: ['zdassets.com', 'zendesk.com', 'zopim.com'] },
  { company: 'Drift (Salesloft)', category: 'customer', domains: ['drift.com', 'driftt.com'] },
  { company: 'HubSpot', category: 'customer', domains: ['hubspot.com', 'hs-scripts.com', 'hs-analytics.net', 'hsforms.net', 'hscollectedforms.net', 'hs-banner.com', 'usemessages.com'] },
  { company: 'Klaviyo', category: 'customer', domains: ['klaviyo.com'] },
  { company: 'Mailchimp (Intuit)', category: 'customer', domains: ['chimpstatic.com', 'list-manage.com'] },
  { company: 'tawk.to', category: 'customer', domains: ['tawk.to'] },
  { company: 'Salesforce', category: 'customer', domains: ['exacttarget.com', 'pardot.com', 'salesforceliveagent.com'] },

  // ---- Fingerprinting & bot detection
  { company: 'FingerprintJS', category: 'fingerprinting', domains: ['fpjs.io', 'fpcdn.io', 'fingerprint.com', 'fpapi.io'] },
  { company: 'LexisNexis (ThreatMetrix)', category: 'fingerprinting', domains: ['online-metrix.net'] },
  { company: 'Sift', category: 'fingerprinting', domains: ['sift.com', 'siftscience.com'] },
  { company: 'HUMAN (PerimeterX)', category: 'fingerprinting', domains: ['px-cdn.net', 'perimeterx.net', 'px-cloud.net'] },
  { company: 'DataDome', category: 'fingerprinting', domains: ['datadome.co'] },
  { company: 'hCaptcha', category: 'fingerprinting', domains: ['hcaptcha.com'] },

  // ---- Consent management
  { company: 'OneTrust', category: 'consent', domains: ['onetrust.com', 'cookielaw.org'] },
  { company: 'Cookiebot (Usercentrics)', category: 'consent', domains: ['cookiebot.com'] },
  { company: 'Usercentrics', category: 'consent', domains: ['usercentrics.eu'] },
  { company: 'Didomi', category: 'consent', domains: ['privacy-center.org', 'didomi.io'] },
  { company: 'TrustArc', category: 'consent', domains: ['trustarc.com', 'truste.com'] },

  // ---- Payments
  { company: 'Stripe', category: 'payments', domains: ['stripe.com', 'stripe.network'] },
  { company: 'PayPal', category: 'payments', domains: ['paypal.com', 'paypalobjects.com'] },
  { company: 'Adyen', category: 'payments', domains: ['adyen.com'] },
  { company: 'Klarna', category: 'payments', domains: ['klarna.com', 'klarnacdn.net'] },

  // ---- Content delivery & embeds
  { company: 'Cloudflare', category: 'content', domains: ['cdnjs.cloudflare.com', 'cloudflareinsights.com'] },
  { company: 'jsDelivr', category: 'content', domains: ['jsdelivr.net'] },
  { company: 'unpkg', category: 'content', domains: ['unpkg.com'] },
  { company: 'Vimeo', category: 'content', domains: ['vimeo.com', 'vimeocdn.com'] },
  { company: 'Adobe Fonts', category: 'content', domains: ['typekit.net', 'use.typekit.net'] },
  { company: 'Font Awesome', category: 'content', domains: ['fontawesome.com'] }
];

// Build a suffix index once: "doubleclick.net" -> entry
const INDEX = new Map();
for (const entry of TRACKERS) {
  for (const d of entry.domains) INDEX.set(d, entry);
}

/** Finds the tracker entry for a hostname by walking up its labels. */
export function lookupTracker(host) {
  if (!host) return null;
  let h = host.toLowerCase();
  while (h) {
    const hit = INDEX.get(h);
    if (hit) return hit;
    const dot = h.indexOf('.');
    if (dot === -1) break;
    h = h.slice(dot + 1);
  }
  return null;
}
