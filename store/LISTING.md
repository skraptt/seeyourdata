# Chrome Web Store listing

Everything to paste into the Chrome Web Store Developer Dashboard. Images are in this folder.

## Package

Upload `seeyourdata-store.zip` (built with `npm run package`). It contains only the extension files, with `manifest.json` at the top level.

## Store listing tab

**Name:** taken from the extension (SeeYourData)

**Summary** (shown in search results, max 132 characters; taken from the extension in each language):

> See which personal data the website you're on can collect, and which companies receive it.

**Description:**

```
SeeYourData shows you, in plain language, what the website you're on can learn about you and who it shares it with.

Click the eye icon on any website to see:

• A grade from A to F for how exposed you are on that page
• Your data: what the page can collect, such as a fingerprint of your device, your location, your clicks and typing, IDs that follow you across websites, and the details its forms ask for
• Who gets it: every company the page sends data to (Google, Meta, Hotjar, ad exchanges and more), what each one does, and which servers your browser contacted, including trackers hidden inside the site's own domain
• Policy: SeeYourData reads the site's privacy policy for you and shows what it says it collects, why, on which legal basis, and which of your rights it explains. It then lists what the page actually does that the policy leaves out.
• Email the site: one click drafts a polite GDPR email to the site's privacy contact with the evidence. You review it and send it from your own email. SeeYourData never sends anything.

Available in English, Deutsch and Türkçe.

Private by design
• Everything happens in your browser. SeeYourData has no servers, no analytics and no accounts.
• Findings are kept in memory only and deleted when you close the tab.
• It never reads what you type into forms, and never blocks or changes pages.
• The privacy policy is only downloaded when you ask, without your cookies.

Free and open source (MIT): https://github.com/skraptt/seeyourdata
Found a tracker we don't know? Use the Report button in the popup.
```

**Category:** Privacy & Security (if not offered, choose Tools)

**Language:** English (German and Turkish are included in the extension)

**Images:**
- Store icon: comes from the extension (`icons/icon-128.png`)
- Screenshots (1280×800): `screenshot-1.png` to `screenshot-4.png`, in that order
- Small promo tile (440×280): `promo-small-440x280.png`
- Marquee promo tile (1400×560, optional): `promo-marquee-1400x560.png`
- Promo video: leave empty

**Homepage URL:** https://github.com/skraptt/seeyourdata
**Support URL:** https://github.com/skraptt/seeyourdata/issues

## Privacy practices tab

**Single purpose:**

> SeeYourData shows people which personal data the website they are visiting can collect, which companies receive it, and how that compares with the site's privacy policy.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| webRequest | Observes (never blocks or modifies) which servers the current page contacts, so the extension can show which companies receive data from that page. |
| Host permission `<all_urls>` | Needed to observe requests on any website the user visits, to run the content script that detects fingerprinting and personal-data form fields, and to download a site's privacy policy when the user clicks "Read the privacy policy". |
| cookies | Counts the cookies the current site keeps, shown in the Details tab. Cookie values are never read out or stored. |
| tabs | Identifies the active tab the popup reports on, reloads it when the user asks, and briefly opens a privacy policy in a background tab when the page needs JavaScript to show it. |
| storage | Keeps each tab's findings in session memory (cleared when the browser closes) and remembers the chosen interface language. |

**Remote code:** No, I am not using remote code. (All JavaScript is included in the package.)

**Data usage — what to tick:**
- ☑ Web history (the extension notes which sites and servers a tab contacts, processed locally only)
- ☑ Website content (the extension reads form field types and, when asked, the privacy policy text, processed locally only)
- Leave every other category unticked.

**Certify all three statements:**
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://github.com/skraptt/seeyourdata/blob/main/PRIVACY.md

## Test instructions for reviewers (optional field)

```
1. Open any news or shopping website, for example https://www.theguardian.com.
2. Click the SeeYourData icon. The popup shows a grade, "Your data" and "Who gets it".
3. Open the "Policy" tab and click "Read the privacy policy".
4. If the box "On this page, but not in the policy" appears, click the email button to see the draft page. Nothing is sent by the extension.
No account or login is needed.
```
