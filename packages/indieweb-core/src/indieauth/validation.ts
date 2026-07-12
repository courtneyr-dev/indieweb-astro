/**
 * IndieAuth URL validation.
 *
 * Validates client_id and redirect_uri per the IndieAuth spec rules.
 *
 * @see https://indieauth.spec.indieweb.org/#client-identifier
 * @see https://indieauth.spec.indieweb.org/#redirect-url
 */
import type { ValidationResult } from "./types.js";

/** IPv4 loopback */
const LOOPBACK_V4 = "127.0.0.1";
/** IPv6 loopback */
const LOOPBACK_V6 = "[::1]";

/**
 * Validate a client_id URL per the IndieAuth spec.
 *
 * Rules:
 * - Must be http or https scheme
 * - Must have a path component (bare domain gets "/" appended)
 * - No fragment
 * - No username or password
 * - Host must be a domain name or loopback IP
 * - No single-dot or double-dot path segments
 *
 * Unlike profile URLs, client identifier URLs MAY contain a port.
 *
 * @example
 * ```ts
 * validateClientId("https://app.example.com/");
 * // { valid: true }
 *
 * validateClientId("ftp://example.com");
 * // { valid: false, error: "client_id must use http or https scheme" }
 * ```
 */
export function validateClientId(url: string): ValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "client_id is not a valid URL" };
  }

  // Must be http or https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "client_id must use http or https scheme" };
  }

  // No fragment
  if (parsed.hash) {
    return { valid: false, error: "client_id must not contain a fragment" };
  }

  // No username or password
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: "client_id must not contain username or password",
    };
  }

  const isLoopback =
    parsed.hostname === LOOPBACK_V4 ||
    parsed.hostname === LOOPBACK_V6 ||
    parsed.hostname === "localhost";

  // Host must be a domain or loopback, not an arbitrary IP
  if (!isLoopback && isIpAddress(parsed.hostname)) {
    return {
      valid: false,
      error: "client_id host must be a domain name, not an IP address",
    };
  }

  // No single-dot or double-dot path segments (check raw input since URL() resolves them)
  if (/\/\.\.?(\/|$)/.test(url)) {
    return {
      valid: false,
      error: "client_id path must not contain dot segments",
    };
  }

  return { valid: true };
}

/**
 * Validate a redirect_uri against a client_id.
 *
 * If the redirect_uri host matches the client_id host, it's allowed.
 * If they differ, the redirect_uri must appear in the registeredUris list
 * (discovered from the client_id's published metadata).
 *
 * @example
 * ```ts
 * // Same host — always allowed
 * validateRedirectUri("https://app.example.com/callback", "https://app.example.com/");
 * // { valid: true }
 *
 * // Different host — must be registered
 * validateRedirectUri(
 *   "https://other.example.com/callback",
 *   "https://app.example.com/",
 *   ["https://other.example.com/callback"]
 * );
 * // { valid: true }
 * ```
 */
export function validateRedirectUri(
  redirectUri: string,
  clientId: string,
  registeredUris?: string[],
): ValidationResult {
  let parsedRedirect: URL;
  let parsedClient: URL;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch {
    return { valid: false, error: "redirect_uri is not a valid URL" };
  }
  try {
    parsedClient = new URL(clientId);
  } catch {
    return { valid: false, error: "client_id is not a valid URL" };
  }

  // Must be http or https
  if (
    parsedRedirect.protocol !== "http:" &&
    parsedRedirect.protocol !== "https:"
  ) {
    return {
      valid: false,
      error: "redirect_uri must use http or https scheme",
    };
  }

  // Same origin (scheme + host + port) — always allowed. Comparing the
  // full origin prevents an https client_id from redirecting to an
  // http URI (downgrade) or to a different port on the same host.
  if (parsedRedirect.origin === parsedClient.origin) {
    return { valid: true };
  }

  // Different origin — must match a registered URI exactly
  if (!registeredUris || registeredUris.length === 0) {
    return {
      valid: false,
      error:
        "redirect_uri host differs from client_id and no registered redirect URIs found",
    };
  }

  const exactMatch = registeredUris.some((uri) => uri === redirectUri);
  if (!exactMatch) {
    return {
      valid: false,
      error:
        "redirect_uri does not match any registered redirect URI (exact match required)",
    };
  }

  return { valid: true };
}

/**
 * Canonicalize a profile URL per IndieAuth rules.
 *
 * - Adds trailing slash if no path component
 * - Lowercases the host
 *
 * @example
 * ```ts
 * canonicalizeUrl("https://Example.Com");
 * // "https://example.com/"
 * ```
 */
export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // URL constructor already lowercases the host
    // and adds a trailing slash to bare domains
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * Check if two profile URLs refer to the same identity.
 *
 * Compares after canonicalization (case-insensitive host,
 * path normalization).
 *
 * @example
 * ```ts
 * profileUrlsMatch("https://Example.Com", "https://example.com/");
 * // true
 * ```
 */
export function profileUrlsMatch(a: string, b: string): boolean {
  return canonicalizeUrl(a) === canonicalizeUrl(b);
}

/**
 * Check if a hostname is an IP address (v4 or v6).
 * @internal
 */
function isIpAddress(hostname: string): boolean {
  // IPv6 in brackets
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return true;
  }
  // IPv4: all digits and dots
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return true;
  }
  return false;
}
