/**
 * IndieAuth endpoint discovery.
 *
 * Discovers authorization_endpoint, token_endpoint, and metadata
 * from a user's profile URL via Link headers and HTML link tags.
 *
 * @see https://indieauth.spec.indieweb.org/#discovery
 */
import type { IndieAuthEndpoints, IndieAuthMetadata } from "./types.js";

/**
 * Parse IndieAuth-related link relations from an HTTP Link header.
 *
 * Looks for `indieauth-metadata`, `authorization_endpoint`,
 * and `token_endpoint` relations.
 *
 * @example
 * ```ts
 * const header = '<https://auth.example.com/.well-known/oauth-authorization-server>; rel="indieauth-metadata"';
 * const result = discoverEndpointsFromHeaders(header, "https://example.com");
 * // result.metadata_url === "https://auth.example.com/.well-known/oauth-authorization-server"
 * ```
 */
export function discoverEndpointsFromHeaders(
  linkHeader: string,
  baseUrl: string,
): { metadata_url?: string } & Omit<IndieAuthEndpoints, "metadata"> {
  const result: {
    metadata_url?: string;
    authorization_endpoint?: string;
    token_endpoint?: string;
  } = {};

  const links = linkHeader.split(",");
  for (const link of links) {
    const urlMatch = link.trim().match(/<([^>]+)>/);
    if (!urlMatch) continue;

    const url = urlMatch[1];

    if (/rel\s*=\s*"([^"]*\s)?indieauth-metadata(\s[^"]*)?"/i.test(link)) {
      result.metadata_url = resolveUrl(url, baseUrl);
    }
    if (/rel\s*=\s*"([^"]*\s)?authorization_endpoint(\s[^"]*)?"/i.test(link)) {
      result.authorization_endpoint = resolveUrl(url, baseUrl);
    }
    if (/rel\s*=\s*"([^"]*\s)?token_endpoint(\s[^"]*)?"/i.test(link)) {
      result.token_endpoint = resolveUrl(url, baseUrl);
    }
  }

  return result;
}

/**
 * Parse IndieAuth endpoints from HTML content.
 *
 * Searches for `<link>` and `<a>` tags with `rel="indieauth-metadata"`,
 * `rel="authorization_endpoint"`, or `rel="token_endpoint"`.
 *
 * @example
 * ```ts
 * const html = '<link rel="authorization_endpoint" href="/auth">';
 * const result = discoverEndpointsFromHtml(html, "https://example.com");
 * // result.authorization_endpoint === "https://example.com/auth"
 * ```
 */
export function discoverEndpointsFromHtml(
  html: string,
  baseUrl: string,
): { metadata_url?: string } & Omit<IndieAuthEndpoints, "metadata"> {
  const result: {
    metadata_url?: string;
    authorization_endpoint?: string;
    token_endpoint?: string;
  } = {};

  const tags = html.match(/<(?:link|a)\s[^>]*>/gi) || [];

  for (const tag of tags) {
    const href = findAttrValue(tag, "href");
    const rel = findAttrValue(tag, "rel");
    if (!href || !rel) continue;

    const rels = rel.toLowerCase().split(/\s+/);

    if (rels.includes("indieauth-metadata") && !result.metadata_url) {
      result.metadata_url = resolveUrl(href, baseUrl);
    }
    if (
      rels.includes("authorization_endpoint") &&
      !result.authorization_endpoint
    ) {
      result.authorization_endpoint = resolveUrl(href, baseUrl);
    }
    if (rels.includes("token_endpoint") && !result.token_endpoint) {
      result.token_endpoint = resolveUrl(href, baseUrl);
    }
  }

  return result;
}

/**
 * Discover IndieAuth endpoints from a profile URL.
 *
 * Follows the spec discovery algorithm:
 * 1. Fetch the profile URL
 * 2. Check Link headers and HTML for `indieauth-metadata`
 * 3. If metadata found, fetch it for full endpoint list
 * 4. Fall back to individual endpoint link relations
 *
 * @example
 * ```ts
 * const endpoints = await discoverIndieAuth("https://user.example.net/");
 * if (endpoints.authorization_endpoint) {
 *   console.log("Auth endpoint:", endpoints.authorization_endpoint);
 * }
 * ```
 */
export async function discoverIndieAuth(
  profileUrl: string,
): Promise<IndieAuthEndpoints> {
  const response = await fetch(profileUrl, { redirect: "follow" });
  const html = await response.text();
  const finalUrl = response.url || profileUrl;

  // Check both Link headers and HTML
  const linkHeader = response.headers.get("Link") || "";
  const fromHeaders = discoverEndpointsFromHeaders(linkHeader, finalUrl);
  const fromHtml = discoverEndpointsFromHtml(html, finalUrl);

  // Metadata URL: headers take precedence over HTML
  const metadataUrl = fromHeaders.metadata_url || fromHtml.metadata_url;

  // If we have a metadata URL, fetch the full metadata
  if (metadataUrl) {
    try {
      const metaResponse = await fetch(metadataUrl);
      if (metaResponse.ok) {
        const metadata = (await metaResponse.json()) as IndieAuthMetadata;
        return {
          metadata,
          authorization_endpoint: metadata.authorization_endpoint,
          token_endpoint: metadata.token_endpoint,
        };
      }
    } catch {
      // Fall through to individual endpoints
    }
  }

  // Fall back to individual link relations (headers take precedence)
  return {
    authorization_endpoint:
      fromHeaders.authorization_endpoint || fromHtml.authorization_endpoint,
    token_endpoint: fromHeaders.token_endpoint || fromHtml.token_endpoint,
  };
}

/**
 * Extract an attribute value from an HTML tag string.
 * @internal
 */
function findAttrValue(tag: string, attr: string): string | null {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1] : null;
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
