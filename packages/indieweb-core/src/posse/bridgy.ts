/**
 * Bridgy Publish helpers.
 *
 * Bridgy (https://brid.gy) syndicates posts to silos via webmention:
 * you send a webmention to Bridgy's endpoint with `target` set to a
 * `https://brid.gy/publish/<silo>` URL, and Bridgy fetches your post,
 * creates the silo copy, and returns its URL in the response JSON.
 *
 * The source page must physically link to the publish target for
 * Bridgy to accept the webmention (an empty anchor is sufficient).
 *
 * @see https://brid.gy/about#webmentions
 */

/** Webmention endpoint that handles all Bridgy Publish targets. */
export const BRIDGY_WEBMENTION_ENDPOINT = "https://brid.gy/publish/webmention";

/** Silos Bridgy Publish currently supports. */
export const BRIDGY_SILOS = ["mastodon", "bluesky", "flickr", "github"] as const;

/**
 * True when a syndication target UID is a Bridgy Publish URL
 * (e.g. `https://brid.gy/publish/mastodon`).
 *
 * @example
 * ```ts
 * isBridgyPublishTarget("https://brid.gy/publish/mastodon"); // true
 * isBridgyPublishTarget("https://mastodon.social/@me"); // false
 * ```
 */
export function isBridgyPublishTarget(uid: string): boolean {
  try {
    const url = new URL(uid);
    return (
      (url.hostname === "brid.gy" || url.hostname === "www.brid.gy") &&
      url.pathname.startsWith("/publish/")
    );
  } catch {
    return false;
  }
}

/**
 * Result of a Bridgy Publish attempt.
 */
export interface BridgyPublishResult {
  /** URL of the syndicated copy on the silo, when creation succeeded. */
  url?: string;
  /** Error description when the publish failed. */
  error?: string;
}

/**
 * Parse Bridgy's webmention response body.
 *
 * On success Bridgy returns 201 with JSON containing the silo post's
 * `url`. On failure it returns 4xx with `{"error": "..."}`.
 *
 * @example
 * ```ts
 * const result = parseBridgyResponse(201, '{"url":"https://mastodon.social/@me/1"}');
 * // { url: "https://mastodon.social/@me/1" }
 * ```
 */
export function parseBridgyResponse(
  status: number,
  body: string,
): BridgyPublishResult {
  let parsed: Record<string, unknown> | null = null;
  try {
    const value: unknown = JSON.parse(body);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      parsed = value as Record<string, unknown>;
    }
  } catch {
    // Non-JSON body — fall through to status-based handling.
  }

  if (status >= 200 && status < 300) {
    const url = parsed && typeof parsed.url === "string" ? parsed.url : undefined;
    if (url) return { url };
    return { error: "Bridgy returned success without a syndicated URL" };
  }

  const error =
    parsed && typeof parsed.error === "string"
      ? parsed.error
      : `Bridgy returned HTTP ${status}`;
  return { error };
}
