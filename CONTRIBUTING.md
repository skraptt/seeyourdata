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
