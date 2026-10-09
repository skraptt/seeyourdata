# Contributing to SeeYourData

Thanks for helping people see who collects their data. Issues and pull requests of every size are welcome.

## Adding or fixing a tracker

1. Open `src/lib/trackers.js`.
2. Add an entry, or add domains to an existing company:

   ```js
   { company: 'Example Analytics', category: 'analytics', domains: ['example-analytics.com', 'cdn.exa.io'] },
   ```

   - `company`: the name people know. Mention the parent company in brackets if it helps, e.g. `Drift (Salesloft)`.
   - `category`: one of the keys in `CATEGORIES` at the top of the file. Pick what the service *does with visitor data*, not what the company sells overall.
   - `domains`: lowercase, no protocol or path. A domain covers all its subdomains.
3. Run `npm test`. It checks for typos, unknown categories and duplicate domains.
4. In the pull request, link a source: the vendor's documentation, a public blocklist entry, or a network capture showing the domain on a real site.

## Adding a pattern for tracker code hidden in a site

Some sites serve a tracker's code from their own domain. Those are matched by URL path with `SCRIPT_PATTERNS` in `src/lib/trackers.js`:

```js
{ id: 'example', company: 'Example Analytics', category: 'analytics', pattern: /\/example-analytics(?:[-.][\w.-]*)?\.js$/i },
```

Patterns see only the path (no query string). Make them specific: a pattern that also matches ordinary files would wrongly accuse a site, so add both a matching and a non-matching example to the tests in `test/analyze.test.js`.

## Finding new trackers with the crawler

1. `python tools/crawl.py --tranco 500 --accept-consent` (or `--sites your-list.txt`).
2. `node tools/rank.js crawl-out/crawl.jsonl`
3. Open `crawl-out/candidates.md`. For each server, find out who runs it (its homepage, privacy policy or WHOIS), correct the company and category, and paste the line into `TRACKERS`. Skip servers that are a website's own infrastructure.
4. Run `npm test` and mention the crawl (date, number of sites, coverage before and after) in your pull request.

## Handling issues from the popup's Report button

Issues labelled `tracker-list` come from the popup. Check the domain the same way as above. If it's a tracker, add it and close the issue with the commit. If it's a site's own server, close it with a short note.

## Improving the privacy-policy reader

`src/lib/policy.js` finds things by wording. When it misses something in a real policy, add the phrase to the matching rule and add the sentence to a test in `test/policy.test.js`. Adding a new language means adding its wording to every rule and a sample policy in `test/fixtures/`. Keep patterns specific enough that ordinary text doesn't match.

## Changing detection or the popup

- Keep `src/lib/analyze.js` free of browser APIs so it stays unit-testable. Add a test in `test/analyze.test.js` for new behaviour.
- `src/inject.js` runs inside every web page. It must never change what a browser API returns, never throw, and stay small.
- Never send anything off the user's machine. No analytics, no remote fonts, no remote config.
- Write popup copy for someone who isn't technical: plain verbs, sentence case, say what happens.
- Check the popup in light and dark mode. `python test/e2e.py shots/` takes screenshots of both.

## Reporting a wrong result

Open an issue with the page URL, what the popup showed, and what you expected. A screenshot of the "Who gets it" tab helps.

## Code of conduct

Be kind and assume good intent. Harassment of any kind isn't tolerated.
