/**
 * Webmention receiver per W3C Webmention spec Sections 3.2.1–3.2.4.
 *
 * Handles two phases:
 * 1. **Validation** — synchronous check of source/target URLs
 * 2. **Verification** — async fetch of source to confirm it links to target
 *
 * @see https://www.w3.org/TR/webmention/#receiving-webmentions
 */
import type { WebmentionValidation, WebmentionVerification } from "./types.js";

/** Maximum response size to fetch during verification (1 MB per spec) */
const MAX_SOURCE_SIZE = 1_048_576;

/** Maximum time to wait for source fetch (5 seconds per spec) */
const FETCH_TIMEOUT_MS = 5_000;

/**
 * Validate an incoming webmention request synchronously.
 *
 * Checks that source and target are valid HTTP(S) URLs, that they
 * differ, and that the target belongs to the receiver's accepted
 * domains. This runs before any network I/O.
 *
 * @param source - The source URL from the POST body
 * @param target - The target URL from the POST body
 * @param acceptedDomains - Domains this receiver accepts webmentions for
 *
 * @example
 * ```ts
 * const result = validateWebmention(
 *   'https://alice.example/post/1',
 *   'https://bob.example/post/2',
 *   ['bob.example']
 * );
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateWebmention(
  source: string,
  target: string,
  acceptedDomains?: string[],
): WebmentionValidation {
  // Both must be present
  if (!source || !target) {
    return {
      valid: false,
      source: source || "",
      target: target || "",
      error: "Source and target URLs are required",
    };
  }

  // Validate source URL
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return {
      valid: false,
      source,
      target,
      error: `Invalid source URL: ${source}`,
    };
  }

  // Validate target URL
  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return {
      valid: false,
      source,
      target,
      error: `Invalid target URL: ${target}`,
    };
  }

  // Must be http or https
  if (!["http:", "https:"].includes(sourceUrl.protocol)) {
    return {
      valid: false,
      source,
      target,
      error: `Unsupported source URL scheme: ${sourceUrl.protocol}`,
    };
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return {
      valid: false,
      source,
      target,
      error: `Unsupported target URL scheme: ${targetUrl.protocol}`,
    };
  }

  // Source and target must differ (ignoring fragment)
  const sourceNoFrag = source.split("#")[0];
  const targetNoFrag = target.split("#")[0];
  if (sourceNoFrag === targetNoFrag) {
    return {
      valid: false,
      source,
      target,
      error: "Source and target URLs must be different",
    };
  }

  // Target must belong to an accepted domain (if domains are specified)
  if (acceptedDomains && acceptedDomains.length > 0) {
    const targetHost = targetUrl.hostname.toLowerCase();
    const accepted = acceptedDomains.some(
      (d) =>
        targetHost === d.toLowerCase() ||
        targetHost.endsWith(`.${d.toLowerCase()}`),
    );
    if (!accepted) {
      return {
        valid: false,
        source,
        target,
        error: `Target domain ${targetHost} is not accepted`,
      };
    }
  }

  return { valid: true, source, target };
}

/**
 * Verify a webmention by fetching the source and checking
 * that it contains a link to the target URL.
 *
 * Per the spec: "The receiver MUST perform an HTTP GET request on
 * source, following any HTTP redirects, to confirm that it actually
 * mentions the target."
 *
 * @example
 * ```ts
 * const result = await verifyWebmention(
 *   'https://alice.example/post/1',
 *   'https://bob.example/post/2'
 * );
 * if (result.verified) {
 *   console.log('Webmention verified!');
 * } else if (result.gone) {
 *   console.log('Source was deleted (410 Gone)');
 * }
 * ```
 */
export async function verifyWebmention(
  source: string,
  target: string,
): Promise<WebmentionVerification> {
  // One timeout budget covers the whole fetch INCLUDING the body read —
  // a slow-drip source can otherwise hold the request open indefinitely
  // after the headers arrive.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  let sourceContent: string;
  try {
    try {
      response = await fetch(source, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          Accept:
            "text/html, application/xhtml+xml, application/json, text/plain",
        },
      });
    } catch (err) {
      return {
        verified: false,
        source,
        target,
        error: `Failed to fetch source: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // HTTP 410 Gone means the source was deleted
    if (response.status === 410) {
      return {
        verified: false,
        source,
        target,
        gone: true,
      };
    }

    // Non-2xx means verification fails
    if (response.status < 200 || response.status >= 300) {
      return {
        verified: false,
        source,
        target,
        error: `Source returned HTTP ${response.status}`,
      };
    }

    // Read response body, limited to MAX_SOURCE_SIZE
    try {
      const reader = response.body?.getReader();
      if (!reader) {
        sourceContent = await response.text();
      } else {
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        while (totalBytes < MAX_SOURCE_SIZE) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalBytes += value.byteLength;
        }
        reader.cancel();

        const decoder = new TextDecoder();
        sourceContent = chunks
          .map((chunk) => decoder.decode(chunk, { stream: true }))
          .join("");
      }
    } catch {
      sourceContent = "";
    }
  } finally {
    clearTimeout(timeout);
  }

  // Check if source contains a link to target
  const contentType = response.headers.get("Content-Type") || "";
  const containsTarget = sourceLinksToTarget(
    sourceContent,
    target,
    contentType,
  );

  return {
    verified: containsTarget,
    source,
    target,
    sourceContent: containsTarget ? sourceContent : undefined,
    error: containsTarget
      ? undefined
      : "Source does not contain a link to target",
  };
}

/**
 * Check whether HTML/JSON/text content contains a reference to
 * the target URL. Per the spec, this must be an exact match.
 *
 * For HTML: checks `href`, `src`, and `srcset` attribute values.
 * For JSON: searches for the exact URL string as a property value.
 * For plain text: searches for the URL string.
 *
 * @example
 * ```ts
 * const html = '<a href="https://bob.example/post/2">Link</a>';
 * sourceLinksToTarget(html, 'https://bob.example/post/2', 'text/html');
 * // true
 * ```
 */
export function sourceLinksToTarget(
  content: string,
  target: string,
  contentType: string,
): boolean {
  // Normalize target: strip fragment identifier per spec
  const normalizedTarget = target.split("#")[0];

  if (contentType.includes("html") || contentType.includes("xhtml")) {
    return htmlLinksToTarget(content, normalizedTarget);
  }

  if (contentType.includes("json")) {
    return content.includes(normalizedTarget);
  }

  // Plain text or unknown: simple string search
  return content.includes(normalizedTarget);
}

/**
 * Check if HTML content contains a link (href, src, srcset)
 * to the target URL. Per the spec, the URL must be an exact match.
 */
function htmlLinksToTarget(html: string, target: string): boolean {
  // Check href and src attributes. The lookbehind rejects attributes
  // that merely END in href/src (data-href, formsrc, …) so an attacker
  // cannot fake a "link" with a custom attribute.
  const attrPattern = /(?<![\w-])(?:href|src)\s*=\s*["']([^"']*)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(html)) !== null) {
    if (match[1] === target) return true;
  }

  // Check srcset attribute (contains comma-separated URL + descriptor pairs)
  const srcsetPattern = /(?<![\w-])srcset\s*=\s*["']([^"']*)["']/gi;
  while ((match = srcsetPattern.exec(html)) !== null) {
    const entries = match[1].split(",");
    for (const entry of entries) {
      const url = entry.trim().split(/\s+/)[0];
      if (url === target) return true;
    }
  }

  return false;
}
