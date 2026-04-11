/**
 * Micropub endpoint discovery.
 *
 * Discovers the Micropub endpoint from a user's profile URL
 * via Link headers and HTML link/a tags.
 *
 * @see https://micropub.spec.indieweb.org/#discovery
 */

/**
 * Parse the Micropub endpoint from an HTTP Link header.
 *
 * @example
 * ```ts
 * const endpoint = discoverMicropubFromHeaders(
 *   '<https://example.com/micropub>; rel="micropub"',
 *   "https://example.com"
 * );
 * // "https://example.com/micropub"
 * ```
 */
export function discoverMicropubFromHeaders(
  linkHeader: string,
  baseUrl: string,
): string | null {
  const links = linkHeader.split(",");
  for (const link of links) {
    const urlMatch = link.trim().match(/<([^>]+)>/);
    if (!urlMatch) continue;

    if (/rel\s*=\s*"([^"]*\s)?micropub(\s[^"]*)?"/i.test(link)) {
      return resolveUrl(urlMatch[1], baseUrl);
    }
  }
  return null;
}

/**
 * Parse the Micropub endpoint from HTML content.
 *
 * Searches for `<link>` or `<a>` tags with `rel="micropub"`.
 *
 * @example
 * ```ts
 * const endpoint = discoverMicropubFromHtml(
 *   '<link rel="micropub" href="/micropub">',
 *   "https://example.com"
 * );
 * // "https://example.com/micropub"
 * ```
 */
export function discoverMicropubFromHtml(
  html: string,
  baseUrl: string,
): string | null {
  const tags = html.match(/<(?:link|a)\s[^>]*>/gi) || [];

  for (const tag of tags) {
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']*)["']/i);
    const relMatch = tag.match(/rel\s*=\s*["']([^"']*)["']/i);
    if (!hrefMatch || !relMatch) continue;

    const rels = relMatch[1].toLowerCase().split(/\s+/);
    if (rels.includes("micropub")) {
      return resolveUrl(hrefMatch[1], baseUrl);
    }
  }

  return null;
}

/**
 * Discover the Micropub endpoint from a profile URL.
 *
 * Fetches the URL and checks both Link headers and HTML.
 * Headers take precedence per the Micropub spec.
 *
 * @example
 * ```ts
 * const endpoint = await discoverMicropub("https://user.example.net/");
 * if (endpoint) {
 *   console.log("Micropub endpoint:", endpoint);
 * }
 * ```
 */
export async function discoverMicropub(
  profileUrl: string,
): Promise<string | null> {
  const response = await fetch(profileUrl, { redirect: "follow" });
  const html = await response.text();
  const finalUrl = response.url || profileUrl;

  // Link header takes precedence
  const linkHeader = response.headers.get("Link") || "";
  const fromHeaders = discoverMicropubFromHeaders(linkHeader, finalUrl);
  if (fromHeaders) return fromHeaders;

  return discoverMicropubFromHtml(html, finalUrl);
}

/**
 * Resolve a potentially relative URL against a base.
 * @internal
 */
function resolveUrl(url: string, base: string): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}
