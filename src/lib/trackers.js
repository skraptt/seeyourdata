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
  'bot-protection': {
    label: 'Bot protection',
    weight: 3,
    data: ['device'],
    about: 'Checks that you are a person, not a bot, by examining your browser and device. Usually for security, but it reads many of the same details as fingerprinting.'
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
  { company: 'Google', category: 'advertising', domains: ['imasdk.googleapis.com', 'admob.com', 'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com', 'googletagservices.com', 'pagead2.googlesyndication.com'] },
  { company: 'Google', category: 'analytics', domains: ['app-measurement.com', 'google-analytics.com', 'analytics.google.com', 'googletagmanager.com'] },
  { company: 'Google', category: 'content', domains: ['fonts.googleapis.com', 'fonts.gstatic.com', 'ajax.googleapis.com', 'maps.googleapis.com', 'gstatic.com'] },
  { company: 'Google (YouTube)', category: 'social', domains: ['youtube.com', 'youtube-nocookie.com', 'ytimg.com', 'googlevideo.com'] },

  // ---- Meta
  { company: 'Meta (Facebook)', category: 'social', domains: ['threads.net', 'facebook.net', 'facebook.com', 'fbcdn.net', 'instagram.com', 'cdninstagram.com'] },

  // ---- Microsoft
  { company: 'Microsoft', category: 'session-replay', domains: ['clarity.ms'] },
  { company: 'Microsoft', category: 'advertising', domains: ['bat.bing.com', 'bing.com'] },
  { company: 'LinkedIn (Microsoft)', category: 'social', domains: ['licdn.com', 'linkedin.com', 'ads.linkedin.com'] },

  // ---- Other social
  { company: 'X (Twitter)', category: 'social', domains: ['ads-twitter.com', 'twitter.com', 'twimg.com', 'x.com', 't.co'] },
  { company: 'TikTok (ByteDance)', category: 'social', domains: ['tiktokcdn.com', 'tiktok.com', 'tiktokw.us', 'ttwstatic.com', 'byteoversea.com'] },
  { company: 'Pinterest', category: 'social', domains: ['pinterest.com', 'pinimg.com'] },
  { company: 'Snap', category: 'social', domains: ['snapchat.com', 'sc-static.net'] },
  { company: 'Reddit', category: 'social', domains: ['redditstatic.com', 'reddit.com', 'redditmedia.com'] },
  { company: 'Oracle (AddThis)', category: 'social', domains: ['addthis.com', 'addthisedge.com'] },
  { company: 'ShareThis', category: 'social', domains: ['sharethis.com'] },
  { company: 'Disqus', category: 'social', domains: ['disqus.com', 'disquscdn.com'] },

  // ---- Advertising & data brokers
  { company: 'Amazon Ads', category: 'advertising', domains: ['serving-sys.com', 'amazon-adsystem.com', 'assoc-amazon.com'] },
  { company: 'Criteo', category: 'advertising', domains: ['criteo.com', 'criteo.net'] },
  { company: 'Taboola', category: 'advertising', domains: ['taboola.com', 'taboolasyndication.com'] },
  { company: 'Outbrain', category: 'advertising', domains: ['zemanta.com', 'outbrain.com', 'outbrainimg.com'] },
  { company: 'The Trade Desk', category: 'advertising', domains: ['uidapi.com', 'adsrvr.org'] },
  { company: 'Index Exchange', category: 'advertising', domains: ['casalemedia.com', 'indexww.com'] },
  { company: 'PubMatic', category: 'advertising', domains: ['pubmatic.com'] },
  { company: 'Magnite', category: 'advertising', domains: ['spotxchange.com', 'springserve.com', 'rubiconproject.com'] },
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
  { company: 'Adobe', category: 'analytics', domains: ['adobedc.net', 'omtrdc.net', 'adobedtm.com', '2o7.net'] },
  { company: 'Yahoo', category: 'advertising', domains: ['gemini.yahoo.com', 'ads.yahoo.com', 'analytics.yahoo.com', 'yahooinc.com'] },
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
  { company: 'Contentsquare', category: 'session-replay', domains: ['clicktale.net', 'contentsquare.net', 'contentsquare.com'] },

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
  { company: 'HUMAN (PerimeterX)', category: 'bot-protection', domains: ['px-cdn.net', 'perimeterx.net', 'px-cloud.net'] },
  { company: 'DataDome', category: 'bot-protection', domains: ['datadome.co'] },
  { company: 'hCaptcha', category: 'bot-protection', domains: ['hcaptcha.com'] },

  // ---- Consent management
  { company: 'OneTrust', category: 'consent', domains: ['onetrust.com', 'cookielaw.org'] },
  { company: 'Cookiebot (Usercentrics)', category: 'consent', domains: ['cookiebot.com'] },
  { company: 'Usercentrics', category: 'consent', domains: ['usercentrics.eu'] },
  { company: 'Didomi', category: 'consent', domains: ['privacy-center.org', 'didomi.io'] },
  { company: 'TrustArc', category: 'consent', domains: ['trustarc.com', 'truste.com'] },

  // ---- Payments
  { company: 'Stripe', category: 'payments', domains: ['stripe.com', 'stripe.network'] },
  { company: 'PayPal', category: 'payments', domains: ['braintreegateway.com', 'paypal.com', 'paypalobjects.com'] },
  { company: 'Adyen', category: 'payments', domains: ['adyen.com'] },
  { company: 'Klarna', category: 'payments', domains: ['klarna.com', 'klarnacdn.net'] },

  // ---- Content delivery & embeds
  { company: 'Cloudflare', category: 'content', domains: ['cdnjs.cloudflare.com', 'cloudflareinsights.com'] },
  { company: 'jsDelivr', category: 'content', domains: ['jsdelivr.net'] },
  { company: 'unpkg', category: 'content', domains: ['unpkg.com'] },
  { company: 'Vimeo', category: 'content', domains: ['vimeo.com', 'vimeocdn.com'] },
  { company: 'Adobe Fonts', category: 'content', domains: ['typekit.net', 'use.typekit.net'] },
  { company: 'Font Awesome', category: 'content', domains: ['fontawesome.com'] },

  // ---- Added October 2026: ad exchanges, DSPs and data brokers
  { company: 'Yieldmo', category: 'advertising', domains: ['yieldmo.com'] },
  { company: 'TripleLift', category: 'advertising', domains: ['triplelift.com'] },
  { company: 'GumGum', category: 'advertising', domains: ['gumgum.com'] },
  { company: 'Kargo', category: 'advertising', domains: ['kargo.com'] },
  { company: 'Sonobi', category: 'advertising', domains: ['sonobi.com'] },
  { company: 'StackAdapt', category: 'advertising', domains: ['stackadapt.com'] },
  { company: 'MediaMath', category: 'advertising', domains: ['mediamath.com', 'mathtag.com'] },
  { company: 'AdRoll (NextRoll)', category: 'advertising', domains: ['adroll.com'] },
  { company: 'MGID', category: 'advertising', domains: ['mgid.com'] },
  { company: 'Revcontent', category: 'advertising', domains: ['revcontent.com'] },
  { company: 'Nativo', category: 'advertising', domains: ['nativo.com', 'ntv.io'] },
  { company: 'Connatix', category: 'advertising', domains: ['connatix.com'] },
  { company: 'Primis', category: 'advertising', domains: ['primis.tech'] },
  { company: 'PulsePoint', category: 'advertising', domains: ['contextweb.com'] },
  { company: 'Admixer', category: 'advertising', domains: ['admixer.net'] },
  { company: 'TransUnion (Neustar)', category: 'advertising', domains: ['agkn.com'] },
  { company: 'Nielsen (eXelate)', category: 'advertising', domains: ['exelator.com'] },
  { company: 'Salesforce (Krux)', category: 'advertising', domains: ['krxd.net'] },
  { company: 'Beeswax (Comcast)', category: 'advertising', domains: ['bidr.io'] },
  { company: 'Flashtalking', category: 'advertising', domains: ['flashtalking.com'] },
  { company: 'Innovid', category: 'advertising', domains: ['innovid.com'] },
  { company: 'DoubleVerify', category: 'advertising', domains: ['doubleverify.com'] },
  { company: 'Integral Ad Science', category: 'advertising', domains: ['adsafeprotected.com'] },
  { company: 'Oracle (Moat)', category: 'advertising', domains: ['moatads.com'] },
  { company: 'Eyeota', category: 'advertising', domains: ['eyeota.net'] },
  { company: 'Semasio', category: 'advertising', domains: ['semasio.net'] },
  { company: 'Zeotap', category: 'advertising', domains: ['zeotap.com'] },
  { company: 'Permutive', category: 'advertising', domains: ['permutive.com', 'permutive.app'] },
  { company: 'AdKernel', category: 'advertising', domains: ['adkernel.com'] },
  { company: 'e-planning', category: 'advertising', domains: ['e-planning.net'] },
  { company: 'Azerion (Improve Digital)', category: 'advertising', domains: ['improvedigital.com', '360yield.com', 'justpremium.com'] },
  { company: 'OneTag', category: 'advertising', domains: ['onetag-sys.com'] },
  { company: 'Smaato', category: 'advertising', domains: ['smaato.net'] },
  { company: 'LoopMe', category: 'advertising', domains: ['loopme.me'] },
  { company: 'Seedtag', category: 'advertising', domains: ['seedtag.com'] },
  { company: 'Rich Audience', category: 'advertising', domains: ['richaudience.com'] },
  { company: 'SmileWanted', category: 'advertising', domains: ['smilewanted.com'] },
  { company: 'Adyoulike', category: 'advertising', domains: ['adyoulike.com'] },
  { company: 'GetIntent', category: 'advertising', domains: ['getintent.com'] },
  { company: 'Between Digital', category: 'advertising', domains: ['betweendigital.com'] },
  { company: 'AdRiver', category: 'advertising', domains: ['adriver.ru'] },
  { company: 'LiveIntent', category: 'advertising', domains: ['liadm.com', 'liveintent.com'] },
  { company: 'Nexxen (Unruly, Tremor)', category: 'advertising', domains: ['unrulymedia.com', 'tremorhub.com'] },
  { company: 'Epsilon (Conversant)', category: 'advertising', domains: ['dotomi.com', 'conversantmedia.com'] },
  { company: 'EMX Digital', category: 'advertising', domains: ['emxdgt.com'] },
  { company: 'Roku (DataXu)', category: 'advertising', domains: ['w55c.net'] },
  { company: 'Samsung Ads (AdGear)', category: 'advertising', domains: ['adgrx.com'] },
  { company: 'Dianomi', category: 'advertising', domains: ['dianomi.com'] },
  { company: 'ZergNet', category: 'advertising', domains: ['zergnet.com'] },
  { company: 'Sirdata', category: 'advertising', domains: ['sirdata.com'] },
  { company: 'Spotify Ad Analytics', category: 'advertising', domains: ['byspotify.com'] },

  // ---- Germany and Europe
  { company: 'INFOnline', category: 'analytics', domains: ['ioam.de'] },
  { company: 'Gemius', category: 'analytics', domains: ['gemius.pl'] },
  { company: 'Yieldlab', category: 'advertising', domains: ['yieldlab.net'] },
  { company: 'Virtual Minds (ADITION)', category: 'advertising', domains: ['adition.com'] },
  { company: 'The ADEX', category: 'advertising', domains: ['theadex.com'] },
  { company: 'emetriq', category: 'advertising', domains: ['emetriq.de'] },
  { company: 'Ströer (adscale)', category: 'advertising', domains: ['adscale.de'] },
  { company: 'United Internet Media', category: 'advertising', domains: ['uimserv.net'] },
  { company: 'plista', category: 'advertising', domains: ['plista.com'] },
  { company: 'Ligatus', category: 'advertising', domains: ['ligatus.com'] },
  { company: 'Yieldlove', category: 'advertising', domains: ['yieldlove.com'] },

  // ---- Turkey and other regions
  { company: 'Insider', category: 'customer', domains: ['useinsider.com'] },
  { company: 'Segmentify', category: 'analytics', domains: ['segmentify.com'] },
  { company: 'VK', category: 'social', domains: ['vk.com', 'ok.ru'] },
  { company: 'VK', category: 'analytics', domains: ['mail.ru'] },
  { company: 'Baidu', category: 'analytics', domains: ['hm.baidu.com'] },
  { company: 'Weibo', category: 'social', domains: ['weibo.com'] },

  // ---- Affiliate networks (track which ad or link brought you, and what you bought)
  { company: 'Awin', category: 'advertising', domains: ['awin1.com', 'zenaps.com'] },
  { company: 'CJ Affiliate', category: 'advertising', domains: ['emjcd.com', 'anrdoezrs.net', 'dpbolvw.net', 'jdoqocy.com', 'kqzyfj.com', 'tkqlhce.com'] },
  { company: 'Impact', category: 'advertising', domains: ['impactradius-event.com'] },
  { company: 'ShareASale', category: 'advertising', domains: ['shareasale-analytics.com', 'shareasale.com'] },
  { company: 'Rakuten Advertising', category: 'advertising', domains: ['linksynergy.com'] },
  { company: 'Skimlinks', category: 'advertising', domains: ['skimresources.com', 'skimlinks.com'] },
  { company: 'Sovrn Commerce', category: 'advertising', domains: ['viglink.com'] },
  { company: 'Tradedoubler', category: 'advertising', domains: ['tradedoubler.com'] },
  { company: 'Admitad', category: 'advertising', domains: ['admitad.com'] },
  { company: 'AvantLink', category: 'advertising', domains: ['avantlink.com'] },

  // ---- More analytics, tag managers and testing tools
  { company: 'StatCounter', category: 'analytics', domains: ['statcounter.com'] },
  { company: 'Clicky', category: 'analytics', domains: ['getclicky.com'] },
  { company: 'Woopra', category: 'analytics', domains: ['woopra.com'] },
  { company: 'Kissmetrics', category: 'analytics', domains: ['kissmetrics.io', 'kissmetrics.com'] },
  { company: 'Pendo', category: 'analytics', domains: ['pendo.io'] },
  { company: 'mParticle (Rokt)', category: 'analytics', domains: ['mparticle.com'] },
  { company: 'RudderStack', category: 'analytics', domains: ['rudderstack.com'] },
  { company: 'Tealium', category: 'analytics', domains: ['tealiumiq.com', 'tiqcdn.com'] },
  { company: 'Ensighten', category: 'analytics', domains: ['ensighten.com'] },
  { company: 'Parse.ly (Automattic)', category: 'analytics', domains: ['parsely.com'] },
  { company: 'Automattic', category: 'analytics', domains: ['stats.wp.com', 'pixel.wp.com'] },
  { company: 'Piano', category: 'analytics', domains: ['piano.io', 'cxense.com', 'tinypass.com', 'npttech.com', 'xiti.com'] },
  { company: 'Kameleoon', category: 'analytics', domains: ['kameleoon.com', 'kameleoon.eu'] },
  { company: 'AB Tasty', category: 'analytics', domains: ['abtasty.com'] },
  { company: 'Convert', category: 'analytics', domains: ['convertexperiments.com'] },
  { company: 'Dynamic Yield (Mastercard)', category: 'analytics', domains: ['dynamicyield.com'] },
  { company: 'Monetate', category: 'analytics', domains: ['monetate.net'] },

  // ---- More session recording
  { company: 'Medallia', category: 'session-replay', domains: ['decibelinsight.net'] },
  { company: 'SessionCam', category: 'session-replay', domains: ['sessioncam.com'] },

  // ---- More chat, CRM, push and marketing
  { company: 'Wunderkind (BounceX)', category: 'customer', domains: ['bounceexchange.com', 'bouncex.net'] },
  { company: 'Listrak', category: 'customer', domains: ['listrakbi.com'] },
  { company: 'Braze', category: 'customer', domains: ['braze.com', 'appboy.com'] },
  { company: 'OneSignal', category: 'customer', domains: ['onesignal.com'] },
  { company: 'Iterable', category: 'customer', domains: ['iterable.com'] },
  { company: 'Customer.io', category: 'customer', domains: ['customer.io'] },
  { company: 'MailerLite', category: 'customer', domains: ['mailerlite.com'] },
  { company: 'Brevo (Sendinblue)', category: 'customer', domains: ['brevo.com', 'sendinblue.com'] },
  { company: 'Adobe', category: 'customer', domains: ['marketo.net', 'mktoresp.com'] },
  { company: 'Oracle (Eloqua)', category: 'customer', domains: ['eloqua.com'] },
  { company: 'Qualtrics', category: 'customer', domains: ['qualtrics.com'] },
  { company: 'Medallia', category: 'customer', domains: ['medallia.com', 'kampyle.com'] },
  { company: 'Usabilla (SurveyMonkey)', category: 'customer', domains: ['usabilla.com'] },
  { company: 'LiveChat', category: 'customer', domains: ['livechatinc.com'] },
  { company: 'Crisp', category: 'customer', domains: ['crisp.chat'] },
  { company: 'Tidio', category: 'customer', domains: ['tidio.co'] },
  { company: 'Olark', category: 'customer', domains: ['olark.com'] },
  { company: 'Freshworks', category: 'customer', domains: ['freshchat.com', 'freshworks.com'] },
  { company: 'Gorgias', category: 'customer', domains: ['gorgias.chat'] },
  { company: 'Help Scout', category: 'customer', domains: ['helpscout.net'] },
  { company: 'Userlike', category: 'customer', domains: ['userlike.com'] },
  { company: 'Smartsupp', category: 'customer', domains: ['smartsupp.com'] },
  { company: 'Typeform', category: 'customer', domains: ['typeform.com'] },
  { company: 'Jotform', category: 'customer', domains: ['jotform.com'] },
  { company: 'Yotpo', category: 'customer', domains: ['yotpo.com'] },
  { company: 'Bazaarvoice', category: 'customer', domains: ['bazaarvoice.com'] },
  { company: 'PowerReviews', category: 'customer', domains: ['powerreviews.com'] },

  // ---- More social sharing
  { company: 'Quora', category: 'social', domains: ['quora.com'] },
  { company: 'AddToAny', category: 'social', domains: ['addtoany.com'] },
  { company: 'Shareaholic', category: 'social', domains: ['shareaholic.com'] },

  // ---- More performance monitoring
  { company: 'Bugsnag (SmartBear)', category: 'performance', domains: ['bugsnag.com'] },
  { company: 'Rollbar', category: 'performance', domains: ['rollbar.com'] },
  { company: 'TrackJS', category: 'performance', domains: ['trackjs.com'] },
  { company: 'Raygun', category: 'performance', domains: ['raygun.io'] },
  { company: 'SpeedCurve', category: 'performance', domains: ['speedcurve.com'] },
  { company: 'Akamai (mPulse)', category: 'performance', domains: ['akstat.io', 'go-mpulse.net'] },
  { company: 'Dynatrace', category: 'performance', domains: ['dynatrace.com'] },
  { company: 'Cisco (AppDynamics)', category: 'performance', domains: ['eum-appdynamics.com'] },

  // ---- Fraud prevention, bot detection and CAPTCHAs (these fingerprint your device)
  { company: 'Google', category: 'bot-protection', domains: ['recaptcha.net'] },
  { company: 'Cloudflare', category: 'bot-protection', domains: ['challenges.cloudflare.com'] },
  { company: 'TransUnion (iovation)', category: 'fingerprinting', domains: ['iovation.com', 'iesnare.com'] },
  { company: 'Forter', category: 'fingerprinting', domains: ['forter.com'] },
  { company: 'Riskified', category: 'fingerprinting', domains: ['riskified.com'] },
  { company: 'Signifyd', category: 'fingerprinting', domains: ['signifyd.com'] },
  { company: 'Kount (Equifax)', category: 'fingerprinting', domains: ['kount.net', 'kaxsdc.com'] },
  { company: 'Mastercard (NuData)', category: 'fingerprinting', domains: ['nudatasecurity.com'] },
  { company: 'Arkose Labs', category: 'bot-protection', domains: ['arkoselabs.com', 'funcaptcha.com'] },
  { company: 'BioCatch', category: 'fingerprinting', domains: ['biocatch.com'] },
  { company: 'SEON', category: 'fingerprinting', domains: ['seon.io'] },
  { company: 'Castle', category: 'fingerprinting', domains: ['castle.io'] },
  { company: 'CHEQ', category: 'fingerprinting', domains: ['cheq.ai', 'cheqzone.com'] },

  // ---- More cookie-consent tools
  { company: 'IAB Europe (TCF)', category: 'consent', domains: ['consensu.org'] },
  { company: 'Sourcepoint', category: 'consent', domains: ['sp-prod.net', 'privacy-mgmt.com'] },
  { company: 'consentmanager', category: 'consent', domains: ['consentmanager.net'] },
  { company: 'CookieYes', category: 'consent', domains: ['cookieyes.com'] },
  { company: 'Termly', category: 'consent', domains: ['termly.io'] },
  { company: 'iubenda', category: 'consent', domains: ['iubenda.com'] },
  { company: 'Osano', category: 'consent', domains: ['osano.com'] },
  { company: 'Cookie Script', category: 'consent', domains: ['cookie-script.com'] },
  { company: 'CookieFirst', category: 'consent', domains: ['cookiefirst.com'] },
  { company: 'Axeptio', category: 'consent', domains: ['axept.io'] },
  { company: 'Ketch', category: 'consent', domains: ['ketchcdn.com'] },

  // ---- More payments
  { company: 'Square (Block)', category: 'payments', domains: ['squareup.com', 'squarecdn.com'] },
  { company: 'Mollie', category: 'payments', domains: ['mollie.com'] },
  { company: 'Afterpay (Block)', category: 'payments', domains: ['afterpay.com'] },
  { company: 'Affirm', category: 'payments', domains: ['affirm.com'] },
  { company: 'Paddle', category: 'payments', domains: ['paddle.com'] },
  { company: 'Amazon Pay', category: 'payments', domains: ['payments-amazon.com'] },

  // ---- More content delivery, video, maps and search
  { company: 'Akamai', category: 'content', domains: ['akamaihd.net', 'akamaized.net'] },
  { company: 'Fastly', category: 'content', domains: ['fastly.net'] },
  { company: 'BootstrapCDN', category: 'content', domains: ['bootstrapcdn.com'] },
  { company: 'jQuery CDN', category: 'content', domains: ['code.jquery.com'] },
  { company: 'Cloudinary', category: 'content', domains: ['cloudinary.com'] },
  { company: 'imgix', category: 'content', domains: ['imgix.net'] },
  { company: 'Automattic', category: 'content', domains: ['wp.com', 'gravatar.com'] },
  { company: 'Twitch (Amazon)', category: 'content', domains: ['twitch.tv'] },
  { company: 'SoundCloud', category: 'content', domains: ['soundcloud.com'] },
  { company: 'Dailymotion', category: 'content', domains: ['dailymotion.com', 'dmcdn.net'] },
  { company: 'Wistia', category: 'content', domains: ['wistia.com', 'wistia.net'] },
  { company: 'Brightcove', category: 'content', domains: ['brightcove.net', 'brightcove.com'] },
  { company: 'JW Player', category: 'content', domains: ['jwplayer.com', 'jwpcdn.com', 'jwpltx.com'] },
  { company: 'Mapbox', category: 'content', domains: ['mapbox.com'] },
  { company: 'Giphy', category: 'content', domains: ['giphy.com'] },
  { company: 'Imgur', category: 'content', domains: ['imgur.com'] },
  { company: 'Trustpilot', category: 'content', domains: ['trustpilot.com'] },
  { company: 'Algolia', category: 'content', domains: ['algolia.net', 'algolianet.com'] }
];

// Tracker code a website serves from its own domain, recognised by file name
// or data path instead of server address. Many sites do this to make tracking
// look first-party (and to get past ad blockers). Patterns are matched against
// the URL path only, never the query string. Keep them specific: a pattern
// that matches ordinary files would wrongly accuse a site.
export const SCRIPT_PATTERNS = [
  { id: 'amplitude', company: 'Amplitude', category: 'analytics', pattern: /@amplitude\/|\/amplitude(?:[-.][\w.-]*)?\.js$|\/2\/httpapi$/i },
  { id: 'mparticle', company: 'mParticle (Rokt)', category: 'analytics', pattern: /@mparticle\/|\/mparticle(?:[-.][\w.-]*)?\.js$/i },
  { id: 'segment', company: 'Segment (Twilio)', category: 'analytics', pattern: /\/analytics\.js\/v1\/|\/analytics-next\//i },
  { id: 'rudderstack', company: 'RudderStack', category: 'analytics', pattern: /\/rudder-analytics(?:[-.][\w.-]*)?\.js$/i },
  { id: 'mixpanel', company: 'Mixpanel', category: 'analytics', pattern: /\/mixpanel(?:[-.][\w.-]*)?\.js$/i },
  { id: 'heap', company: 'Heap', category: 'analytics', pattern: /\/heap-\d+\.js$/i },
  { id: 'posthog', company: 'PostHog', category: 'analytics', pattern: /\/posthog-js\/|\/posthog(?:[-.][\w.-]*)?\.js$/i },
  { id: 'snowplow', company: 'Snowplow', category: 'analytics', pattern: /\/com\.snowplowanalytics\.snowplow\/tp2$|\/snowplow(?:[-.][\w.-]*)?\.js$/i },
  { id: 'google-tag', company: 'Google', category: 'analytics', pattern: /\/gtag\/js$|\/gtm\.js$|\/g\/collect$/i },
  { id: 'meta-pixel', company: 'Meta (Facebook)', category: 'social', pattern: /\/fbevents\.js$/i },
  { id: 'hotjar', company: 'Hotjar', category: 'session-replay', pattern: /\/hotjar-\d+\.js$/i },
  { id: 'adobe', company: 'Adobe', category: 'analytics', pattern: /\/AppMeasurement[\w.-]*\.js$|\/b\/ss\/[^/]+\/\d/i },
  { id: 'tealium', company: 'Tealium', category: 'analytics', pattern: /\/utag(?:\.sync)?\.js$/i },
  { id: 'optimizely', company: 'Optimizely', category: 'analytics', pattern: /\/optimizely[\w.-]*\.js$/i },
  { id: 'matomo', company: 'Matomo (run by the site itself)', category: 'analytics', pattern: /\/(?:matomo|piwik)\.(?:js|php)$/i },
  { id: 'shopify', company: 'Shopify', category: 'analytics', pattern: /\/\.well-known\/shopify\/monorail\/|\/trekkie[\w.-]*\.js$/i },
  { id: 'prebid', company: 'Prebid (ad auctions)', category: 'advertising', pattern: /\/prebid[\w.-]*\.js$/i },
  { id: 'akamai-bot', company: 'Akamai (Bot Manager)', category: 'bot-protection', pattern: /^\/akam\/\d+\//i },
  { id: 'cloudflare-bot', company: 'Cloudflare', category: 'bot-protection', pattern: /^\/cdn-cgi\/challenge-platform\//i },
  { id: 'vercel', company: 'Vercel', category: 'performance', pattern: /^\/_vercel\/(?:speed-)?insights\//i },
  { id: 'sentry', company: 'Sentry', category: 'performance', pattern: /@sentry\/|\/sentry[\w.-]*\.js$/i },
  { id: 'plausible', company: 'Plausible', category: 'performance', pattern: /\/plausible(?:\.[\w.-]+)?\.js$/i }
];

/** Finds a self-hosted tracker by URL path. Returns null for ordinary files. */
export function matchScriptPattern(path) {
  if (!path) return null;
  for (const p of SCRIPT_PATTERNS) if (p.pattern.test(path)) return p;
  return null;
}

const PATTERNS_BY_ID = new Map(SCRIPT_PATTERNS.map((p) => [p.id, p]));
export function scriptPatternById(id) {
  return PATTERNS_BY_ID.get(id) || null;
}

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
