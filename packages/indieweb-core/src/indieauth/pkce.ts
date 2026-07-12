/**
 * PKCE (Proof Key for Code Exchange) for IndieAuth.
 *
 * Uses the Web Crypto API (available in browsers, Workers, and Node 19+).
 * IndieAuth requires S256 — plain is supported only for backwards compat.
 *
 * @see https://indieauth.spec.indieweb.org/#pkce
 */
import type { PKCEPair } from "./types.js";

/**
 * Generate a PKCE code verifier and challenge pair.
 *
 * Creates a cryptographically random code verifier (43 chars)
 * and its SHA-256 challenge for use in authorization requests.
 *
 * @example
 * ```ts
 * const pkce = await generatePKCE();
 * // pkce.code_verifier  — 43-char random string
 * // pkce.code_challenge — BASE64URL(SHA256(code_verifier))
 * // pkce.code_challenge_method — "S256"
 * ```
 */
export async function generatePKCE(): Promise<PKCEPair> {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const code_verifier = base64UrlEncode(bytes);

  const code_challenge = await computeS256Challenge(code_verifier);

  return {
    code_verifier,
    code_challenge,
    code_challenge_method: "S256",
  };
}

/**
 * Compute the S256 code challenge from a code verifier.
 *
 * @example
 * ```ts
 * const challenge = await computeS256Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
 * ```
 */
export async function computeS256Challenge(
  codeVerifier: string,
): Promise<string> {
  const encoded = new TextEncoder().encode(codeVerifier);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Verify a PKCE code verifier against a stored code challenge.
 *
 * Used server-side during token exchange to confirm the client
 * that started the flow is the same one completing it.
 *
 * @example
 * ```ts
 * const valid = await verifyCodeChallenge(
 *   "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
 *   "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
 *   "S256"
 * );
 * ```
 */
export async function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: "S256" | "plain",
): Promise<boolean> {
  if (method === "plain") {
    return timingSafeEqual(codeVerifier, codeChallenge);
  }

  const computed = await computeS256Challenge(codeVerifier);
  return timingSafeEqual(computed, codeChallenge);
}

/**
 * Constant-time string comparison — the loop always covers every
 * character so equality checks don't leak a match-prefix length
 * through timing.
 * @internal
 */
function timingSafeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Validate that a code verifier meets spec requirements.
 *
 * Must be 43-128 characters from [A-Za-z0-9\-._~].
 *
 * @example
 * ```ts
 * validateCodeVerifier("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
 * // { valid: true }
 * ```
 */
export function validateCodeVerifier(verifier: string): {
  valid: boolean;
  error?: string;
} {
  if (verifier.length < 43) {
    return {
      valid: false,
      error: "Code verifier must be at least 43 characters",
    };
  }
  if (verifier.length > 128) {
    return {
      valid: false,
      error: "Code verifier must be at most 128 characters",
    };
  }
  if (!/^[A-Za-z0-9\-._~]+$/.test(verifier)) {
    return {
      valid: false,
      error: "Code verifier must only contain [A-Za-z0-9\\-._~]",
    };
  }
  return { valid: true };
}

/**
 * Base64url-encode a byte array (no padding).
 * @internal
 */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
