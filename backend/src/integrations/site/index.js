// @ts-check

/**
 * The website, asked to drop its cached content after staff change it in the back office
 * (owner, 8 Oct 2026: no code changes to update the site). The site's POST /revalidate expires the
 * named cache tags when the secret matches, so the next visit shows the change.
 *
 * @typedef {'content' | 'catalogue'} SiteTag
 * @typedef {object} SiteClient
 * @property {(tags: SiteTag[]) => Promise<void>} refresh Throws when the site doesn't answer, so the job retries.
 */

/**
 * @param {{ internalUrl: string; revalidateSecret: string }} o
 * @returns {SiteClient}
 */
export function createSite({ internalUrl, revalidateSecret }) {
  return {
    async refresh(tags) {
      const res = await fetch(`${internalUrl}/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': revalidateSecret },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`The site answered ${res.status} to /revalidate`);
    },
  };
}
