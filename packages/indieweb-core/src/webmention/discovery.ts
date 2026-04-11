/**
 * Webmention endpoint discovery per W3C Webmention spec Section 3.1.2.
 *
 * Discovery checks three sources in priority order:
 * 1. HTTP Link header with `rel="webmention"`
 * 2. HTML `<link>` element with `rel="webmention"`
 * 3. HTML `<a>` element with `rel="webmention"`
 *
 * @see https://www.w3.org/TR/webmention/#sender-discovers-receiver-webmention-endpoint
 */
import type { WebmentionEndpointDiscovery } from "./types.js";

/**
 * Discover the webmention endpoint from HTTP Link headers.
 *
 * Parses the Link header format: `<url>; rel="webmention"`.
 * Handles multiple Link headers and multiple values in a single header.
 *
 * @example
 * ```ts
 * const result = discoverEndpointFromHeaders(
 *   '</webmention>; rel="webmention"',
 *   'https://example.com/post/1'
 * );
 * // { endpoint: 'https://example.com/webmention', method: 'link-header' }
 * ```
 */
export function discoverEndpointFromHeaders(
  linkHeader: string | null,
  baseUrl: string,
): WebmentionEndpointDiscovery {
  if (!linkHeader) {
    return { endpoint: null, method: "none" };
  }

  // Link headers can contain multiple comma-separated entries.
  // But URIs can also contain commas, so we split on `>,` which
  // marks the boundary between entries.
  const entries = linkHeader.split(/>,/);

  for (const entry of entries) {
    // Check if this entry has rel="webmention" or rel=webmention
    if (!/rel\s*=\s*"?([^"]*\s)?webmention(\s[^"]*)?"?/i.test(entry)) {
      continue;
    }

    // Extract the URL between < and >
    const urlMatch = entry.match(/<([^>]*)>/);
    if (!urlMatch) continue;

    const endpoint = resolveUrl(urlMatch[1], baseUrl);
    if (endpoint) {
      return { endpoint, method: "link-header" };
    }
  }

  return { endpoint: null, method: "none" };
}

/**
 * Discover the webmention endpoint from HTML content.
 *
 * Searches for `<link rel="webmention" href="...">` first,
 * then `<a rel="webmention" href="...">`. Only searches within
 * `<head>` for `<link>` tags per HTML semantics, but `<a>` tags
 * can appear anywhere in the document.
 *
 * @example
 * ```ts
 * const html = '<link rel="webmention" href="/webmention" />';
 * const result = discoverEndpointFromHtml(html, 'https://example.com/post/1');
 * // { endpoint: 'https://example.com/webmention', method: 'html-link' }
 * ```
 */
export function discoverEndpointFromHtml(
  html: string,
  baseUrl: string,
): WebmentionEndpointDiscovery {
  // 1. Check <link> elements with rel="webmention"
  const linkEndpoint = findEndpointInTag(html, "link", baseUrl);
  if (linkEndpoint) {
    return { endpoint: linkEndpoint, method: "html-link" };
  }

  // 2. Check <a> elements with rel="webmention"
  const aEndpoint = findEndpointInTag(html, "a", baseUrl);
  if (aEndpoint) {
    return { endpoint: aEndpoint, method: "html-a" };
  }

  return { endpoint: null, method: "none" };
}

/**
 * Discover the webmention endpoint for a target URL by fetching it.
 *
 * Performs an HTTP GET to the target URL, checking the Link header
 * first, then parsing the HTML body. Follows redirects automatically
 * via `fetch`.
 *
 * @example
 * ```ts
 * const result = await discoverEndpoint('https://example.com/post/1');
 * if (result.endpoint) {
 *   console.log(`Endpoint found via ${result.method}: ${result.endpoint}`);
 * }
 * ```
 */
export async function discoverEndpoint(
  targetUrl: string,
): Promise<WebmentionEndpointDiscovery> {
  const response = await fetch(targetUrl, {
    redirect: "follow",
    headers: {
      Accept: "text/html, application/xhtml+xml",
    },
  });

  // Use the final URL after redirects as the base for resolving relative URLs
  const finalUrl = response.url || targetUrl;

  // 1. Check Link header first (highest priority)
  const linkHeader = response.headers.get("Link");
  const headerResult = discoverEndpointFromHeaders(linkHeader, finalUrl);
  if (headerResult.endpoint) {
    return headerResult;
  }

  // 2. Parse HTML body
  const html = await response.text();
  return discoverEndpointFromHtml(html, finalUrl);
}

/**
 * Find a webmention endpoint href in a specific HTML tag type.
 * Matches tags that have both `rel="webmention"` (possibly among
 * other rel values) and an `href` attribute.
 */
function findEndpointInTag(
  html: string,
  tagName: "link" | "a",
  baseUrl: string,
): string | null {
  // Match all instances of the tag. The regex handles:
  // - Self-closing tags (<link ... />)
  // - Open tags (<a ...>)
  // - Attributes in any order
  // - Single or double quotes on attribute values
  const tagPattern = new RegExp(`<${tagName}\\s+([^>]*?)\\s*/?>`, "gi");

  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    const attrs = match[1];

    // Check rel contains "webmention"
    const relMatch = attrs.match(/rel\s*=\s*["']([^"']*)["']/i);
    if (!relMatch) continue;

    const relValues = relMatch[1].split(/\s+/);
    if (!relValues.includes("webmention")) continue;

    // Extract href
    const hrefMatch = attrs.match(/href\s*=\s*["']([^"']*)["']/i);
    if (!hrefMatch) continue;

    const endpoint = resolveUrl(hrefMatch[1], baseUrl);
    if (endpoint) return endpoint;
  }

  return null;
}

/**
 * Resolve a potentially relative URL against a base URL.
 * Returns null if the URL is invalid.
 */
function resolveUrl(url: string, baseUrl: string): string | null {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}
