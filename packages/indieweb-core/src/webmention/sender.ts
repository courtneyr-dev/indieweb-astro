/**
 * Webmention sender per W3C Webmention spec Section 3.1.3.
 *
 * Discovers the target's webmention endpoint, then POSTs the
 * source/target pair as `application/x-www-form-urlencoded`.
 *
 * @see https://www.w3.org/TR/webmention/#sending-webmentions
 */
import { discoverEndpoint } from "./discovery.js";
import type { WebmentionSendResult } from "./types.js";

/**
 * Send a webmention from source to target.
 *
 * Discovers the target's webmention endpoint, then POSTs the
 * source and target URLs. Returns a result indicating success
 * or failure.
 *
 * @example
 * ```ts
 * const result = await sendWebmention(
 *   'https://mysite.com/post/1',
 *   'https://other.com/post/2'
 * );
 * if (result.success) {
 *   console.log(`Sent to ${result.endpoint}`);
 * }
 * ```
 */
export async function sendWebmention(
  source: string,
  target: string,
): Promise<WebmentionSendResult> {
  // Validate URLs
  try {
    new URL(source);
  } catch {
    return {
      success: false,
      status: 0,
      endpoint: "",
      error: `Invalid source URL: ${source}`,
    };
  }

  try {
    new URL(target);
  } catch {
    return {
      success: false,
      status: 0,
      endpoint: "",
      error: `Invalid target URL: ${target}`,
    };
  }

  // Source and target must differ
  if (source === target) {
    return {
      success: false,
      status: 0,
      endpoint: "",
      error: "Source and target URLs must be different",
    };
  }

  // Discover endpoint
  const discovery = await discoverEndpoint(target);
  if (!discovery.endpoint) {
    return {
      success: false,
      status: 0,
      endpoint: "",
      error: "No webmention endpoint found on target",
    };
  }

  // POST source and target as x-www-form-urlencoded (spec requirement)
  const body = new URLSearchParams({ source, target });

  const response = await fetch(discovery.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const result: WebmentionSendResult = {
    success: response.status >= 200 && response.status < 300,
    status: response.status,
    endpoint: discovery.endpoint,
  };

  // 201 Created may include a Location header for status monitoring
  if (response.status === 201) {
    const location = response.headers.get("Location");
    if (location) {
      result.location = location;
    }
  }

  if (!result.success) {
    try {
      result.error = await response.text();
    } catch {
      result.error = `HTTP ${response.status}`;
    }
  }

  return result;
}

/**
 * Extract all linkable URLs from an HTML string.
 *
 * Finds URLs in `href` and `src` attributes, which are the
 * attributes the Webmention spec says receivers should check
 * for target links.
 *
 * Useful for finding all URLs in a post that might need
 * webmentions sent to them.
 *
 * @example
 * ```ts
 * const html = '<p>Check out <a href="https://example.com">this</a></p>';
 * const urls = extractLinkedUrls(html, 'https://mysite.com/post/1');
 * // ['https://example.com']
 * ```
 */
export function extractLinkedUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const attrPattern = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;

  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], baseUrl).href;
      // Only external http(s) URLs — skip mailto:, tel:, javascript:, etc.
      if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
        urls.add(resolved);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return Array.from(urls);
}

/**
 * Send webmentions to all linked URLs in an HTML post.
 *
 * Extracts all `href` and `src` URLs from the HTML, then sends
 * a webmention to each unique URL. Returns results for all
 * attempted sends.
 *
 * @example
 * ```ts
 * const html = '<p>Reply to <a href="https://other.com/post">this</a></p>';
 * const results = await sendWebmentionsForPost(
 *   'https://mysite.com/reply/1',
 *   html
 * );
 * for (const r of results) {
 *   console.log(`${r.endpoint}: ${r.success}`);
 * }
 * ```
 */
export async function sendWebmentionsForPost(
  sourceUrl: string,
  html: string,
): Promise<WebmentionSendResult[]> {
  const targetUrls = extractLinkedUrls(html, sourceUrl);
  const results: WebmentionSendResult[] = [];

  for (const target of targetUrls) {
    // Skip sending webmentions to yourself
    try {
      const sourceHost = new URL(sourceUrl).hostname;
      const targetHost = new URL(target).hostname;
      if (sourceHost === targetHost) continue;
    } catch {
      continue;
    }

    const result = await sendWebmention(sourceUrl, target);
    results.push(result);
  }

  return results;
}
