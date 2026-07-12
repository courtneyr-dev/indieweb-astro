/**
 * IndieAuth server-side primitives.
 *
 * Storage-agnostic helpers for implementing an IndieAuth authorization
 * server: opaque token/code generation, SHA-256 hashing for at-rest
 * storage, authorization-request validation, and expiry checks.
 *
 * The HTTP layer and persistence live in the consuming application;
 * everything here is pure logic over WebCrypto.
 *
 * @see https://indieauth.spec.indieweb.org/
 */
import { validateClientId, validateRedirectUri } from "./validation.js";

/** Authorization code lifetime: 5 minutes (spec maximum is 10). */
export const CODE_TTL_MS = 5 * 60 * 1000;

/** Access token lifetime: 90 days. */
export const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Pending authorization transaction lifetime: 10 minutes. */
export const TXN_TTL_MS = 10 * 60 * 1000;

/**
 * A validated, normalized authorization request.
 */
export interface ValidatedAuthorizationRequest {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scopes: string[];
  me?: string;
}

/**
 * Stored record for an issued authorization code.
 * The storage key is the SHA-256 hash of the code itself.
 */
export interface AuthorizationCodeRecord {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scopes: string[];
  me: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Stored record for an issued access token.
 * The storage key is the SHA-256 hash of the token itself.
 */
export interface AccessTokenRecord {
  clientId: string;
  scopes: string[];
  me: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Validation failure with an OAuth-style error code.
 */
export interface AuthorizationServerError {
  error: "invalid_request" | "unsupported_response_type";
  error_description: string;
}

/**
 * Type guard for {@link AuthorizationServerError}.
 *
 * @example
 * ```ts
 * const result = validateAuthorizationRequest(params);
 * if (isAuthorizationServerError(result)) throw new Error(result.error_description);
 * ```
 */
export function isAuthorizationServerError(
  value: ValidatedAuthorizationRequest | AuthorizationServerError,
): value is AuthorizationServerError {
  return "error" in value;
}

/**
 * Validate an incoming IndieAuth authorization request.
 *
 * Enforces:
 * - `response_type=code` (or absent, treated as code for legacy clients)
 * - `client_id` is a valid http(s) URL (via {@link validateClientId})
 * - `redirect_uri` shares scheme+host+port with `client_id` (no client
 *   metadata fetch is performed, so cross-origin redirect URIs are rejected)
 * - `state` present
 * - PKCE required, `code_challenge_method` must be `S256` (plain rejected)
 *
 * @example
 * ```ts
 * const result = validateAuthorizationRequest(Object.fromEntries(url.searchParams));
 * if (!isAuthorizationServerError(result)) {
 *   // render consent screen for result.clientId
 * }
 * ```
 */
export function validateAuthorizationRequest(
  params: Record<string, string | undefined>,
): ValidatedAuthorizationRequest | AuthorizationServerError {
  const responseType = params.response_type ?? "code";
  if (responseType !== "code") {
    return {
      error: "unsupported_response_type",
      error_description: `response_type must be "code", got "${responseType}"`,
    };
  }

  const clientId = params.client_id;
  if (!clientId) {
    return { error: "invalid_request", error_description: "client_id is required" };
  }
  const clientValidation = validateClientId(clientId);
  if (!clientValidation.valid) {
    return {
      error: "invalid_request",
      error_description: clientValidation.error ?? "invalid client_id",
    };
  }

  const redirectUri = params.redirect_uri;
  if (!redirectUri) {
    return { error: "invalid_request", error_description: "redirect_uri is required" };
  }
  const redirectValidation = validateRedirectUri(redirectUri, clientId);
  if (!redirectValidation.valid) {
    return {
      error: "invalid_request",
      error_description: redirectValidation.error ?? "invalid redirect_uri",
    };
  }

  const state = params.state;
  if (!state) {
    return { error: "invalid_request", error_description: "state is required" };
  }

  const codeChallenge = params.code_challenge;
  if (!codeChallenge) {
    return {
      error: "invalid_request",
      error_description: "code_challenge is required (PKCE)",
    };
  }
  const method = params.code_challenge_method ?? "S256";
  if (method !== "S256") {
    return {
      error: "invalid_request",
      error_description: `code_challenge_method must be "S256", got "${method}"`,
    };
  }

  const scopes = (params.scope ?? "")
    .split(/[\s+]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    clientId,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod: "S256",
    scopes,
    me: params.me,
  };
}

/**
 * Generate an opaque, URL-safe secret with 256 bits of entropy.
 * Used for authorization codes, access tokens, and transaction ids.
 *
 * @example
 * ```ts
 * const code = generateSecret(); // "xK3f..." (43 chars, base64url)
 * ```
 */
export function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * SHA-256 hash of a secret, hex-encoded. Use as the storage key so
 * plaintext codes/tokens are never persisted.
 *
 * @example
 * ```ts
 * const key = await hashSecret(token);
 * await store.put(key, record);
 * ```
 */
export async function hashSecret(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * True when a record with an ISO `expiresAt` timestamp has expired.
 *
 * @example
 * ```ts
 * if (isExpired(record.expiresAt)) return null;
 * ```
 */
export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  const t = Date.parse(expiresAt);
  return Number.isNaN(t) || t <= now.getTime();
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
