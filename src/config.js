// Project settings. Change REPO to your GitHub "owner/name" after forking,
// so the popup's report links open issues in your repository.
export const REPO = 'seeyourdata/seeyourdata';

/**
 * Link to a pre-filled GitHub issue suggesting a tracker. Nothing is sent
 * until the user reviews the form on GitHub and submits it themselves.
 * Only domains are included, never full page URLs (they can contain personal data).
 */
export function reportUrl({ domain, seenOn, company = '', notes = '' }) {
  const params = new URLSearchParams({
    template: 'tracker.yml',
    title: company ? `Correction: ${company} (${domain})` : `New tracker: ${domain}`,
    domain,
    'seen-on': seenOn || '',
    company,
    notes
  });
  return `https://github.com/${REPO}/issues/new?${params}`;
}
