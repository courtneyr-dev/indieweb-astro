/**
 * IndieAuth client helpers.
 *
 * Build authorization URLs, parse callbacks, and construct
 * token exchange request bodies.
 *
 * @see https://indieauth.spec.indieweb.org/
 */
import type {
  AuthorizationRequest,
  AuthorizationResponse,
  TokenRequest,
  RefreshTokenRequest,
  TokenResponse,
  ProfileResponse,
  IndieAuthError,
} from "./types.js";

/**
 * Build the full authorization URL to redirect the user to.
 *
 * @example
 * ```ts
 * const url = buildAuthorizationUrl("https://auth.example.com/auth", {
 *   response_type: "code",
 *   client_id: "https://app.example.com/",
 *   redirect_uri: "https://app.example.com/callback",
 *   state: "random-state",
 *   code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
 *   code_challenge_method: "S256",
 *   scope: "profile create",
 * });
 * ```
 */
export function buildAuthorizationUrl(
  endpoint: string,
  params: AuthorizationRequest,
): string {
  const url = new URL(endpoint);
  url.searchParams.set("response_type", params.response_type);
  url.searchParams.set("client_id", params.client_id);
  url.searchParams.set("redirect_uri", params.redirect_uri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.code_challenge);
  url.searchParams.set("code_challenge_method", params.code_challenge_method);
  if (params.scope) {
    url.searchParams.set("scope", params.scope);
  }
  if (params.me) {
    url.searchParams.set("me", params.me);
  }
  return url.toString();
}

/**
 * Parse the authorization response from a callback URL.
 *
 * Extracts `code`, `state`, and `iss` parameters.
 * Returns an error if any required parameter is missing.
 *
 * @example
 * ```ts
 * const result = parseAuthorizationResponse(
 *   "https://app.example.com/callback?code=xxx&state=abc&iss=https://auth.example.com"
 * );
 * if ("error" in result) {
 *   console.error(result.error_description);
 * } else {
 *   console.log(result.code);
 * }
 * ```
 */
export function parseAuthorizationResponse(
  callbackUrl: string,
): AuthorizationResponse | IndieAuthError {
  const url = new URL(callbackUrl);

  // Check for error response first
  const error = url.searchParams.get("error");
  if (error) {
    return {
      error: error as IndieAuthError["error"],
      error_description: url.searchParams.get("error_description") || undefined,
    };
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const iss = url.searchParams.get("iss");

  if (!code) {
    return {
      error: "invalid_request",
      error_description: "Missing required parameter: code",
    };
  }
  if (!state) {
    return {
      error: "invalid_request",
      error_description: "Missing required parameter: state",
    };
  }
  if (!iss) {
    return {
      error: "invalid_request",
      error_description: "Missing required parameter: iss",
    };
  }

  return { code, state, iss };
}

/**
 * Build a URL-encoded body for the token exchange request.
 *
 * @example
 * ```ts
 * const body = buildTokenRequestBody({
 *   grant_type: "authorization_code",
 *   code: "auth-code",
 *   client_id: "https://app.example.com/",
 *   redirect_uri: "https://app.example.com/callback",
 *   code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
 * });
 * // "grant_type=authorization_code&code=auth-code&..."
 * ```
 */
export function buildTokenRequestBody(params: TokenRequest): string {
  const body = new URLSearchParams();
  body.set("grant_type", params.grant_type);
  body.set("code", params.code);
  body.set("client_id", params.client_id);
  body.set("redirect_uri", params.redirect_uri);
  body.set("code_verifier", params.code_verifier);
  return body.toString();
}

/**
 * Build a URL-encoded body for a refresh token request.
 *
 * @example
 * ```ts
 * const body = buildRefreshTokenRequestBody({
 *   grant_type: "refresh_token",
 *   refresh_token: "XXXXXX",
 *   client_id: "https://app.example.com/",
 *   scope: "create update",
 * });
 * ```
 */
export function buildRefreshTokenRequestBody(
  params: RefreshTokenRequest,
): string {
  const body = new URLSearchParams();
  body.set("grant_type", params.grant_type);
  body.set("refresh_token", params.refresh_token);
  body.set("client_id", params.client_id);
  if (params.scope) {
    body.set("scope", params.scope);
  }
  return body.toString();
}

/**
 * Build a URL-encoded body for a token revocation request.
 *
 * @example
 * ```ts
 * const body = buildRevocationRequestBody("access-token-value");
 * // "token=access-token-value"
 * ```
 */
export function buildRevocationRequestBody(token: string): string {
  const body = new URLSearchParams();
  body.set("token", token);
  return body.toString();
}

/**
 * Parse and validate a token endpoint response.
 *
 * @example
 * ```ts
 * const result = parseTokenResponse({
 *   access_token: "XXXXXX",
 *   token_type: "Bearer",
 *   scope: "create",
 *   me: "https://user.example.net/",
 * });
 * if ("error" in result) {
 *   console.error(result.error_description);
 * } else {
 *   console.log(result.access_token);
 * }
 * ```
 */
export function parseTokenResponse(
  json: unknown,
): TokenResponse | IndieAuthError {
  if (!json || typeof json !== "object") {
    return {
      error: "invalid_request",
      error_description: "Token response is not a valid JSON object",
    };
  }

  const data = json as Record<string, unknown>;

  // Check for error response
  if (typeof data.error === "string") {
    return {
      error: data.error as IndieAuthError["error"],
      error_description:
        typeof data.error_description === "string"
          ? data.error_description
          : undefined,
    };
  }

  if (typeof data.access_token !== "string") {
    return {
      error: "invalid_request",
      error_description: "Missing access_token in response",
    };
  }
  if (typeof data.me !== "string") {
    return {
      error: "invalid_request",
      error_description: "Missing me in response",
    };
  }

  return {
    access_token: data.access_token,
    token_type: (data.token_type as "Bearer") || "Bearer",
    scope: typeof data.scope === "string" ? data.scope : "",
    me: data.me,
    expires_in:
      typeof data.expires_in === "number" ? data.expires_in : undefined,
    refresh_token:
      typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    profile:
      data.profile && typeof data.profile === "object"
        ? (data.profile as TokenResponse["profile"])
        : undefined,
  };
}

/**
 * Parse a profile-only response from the authorization endpoint.
 *
 * @example
 * ```ts
 * const result = parseProfileResponse({ me: "https://user.example.net/" });
 * if ("error" in result) {
 *   console.error(result.error_description);
 * } else {
 *   console.log(result.me);
 * }
 * ```
 */
export function parseProfileResponse(
  json: unknown,
): ProfileResponse | IndieAuthError {
  if (!json || typeof json !== "object") {
    return {
      error: "invalid_request",
      error_description: "Profile response is not a valid JSON object",
    };
  }

  const data = json as Record<string, unknown>;

  if (typeof data.error === "string") {
    return {
      error: data.error as IndieAuthError["error"],
      error_description:
        typeof data.error_description === "string"
          ? data.error_description
          : undefined,
    };
  }

  if (typeof data.me !== "string") {
    return {
      error: "invalid_request",
      error_description: "Missing me in response",
    };
  }

  return {
    me: data.me,
    profile:
      data.profile && typeof data.profile === "object"
        ? (data.profile as ProfileResponse["profile"])
        : undefined,
  };
}

/**
 * Generate a cryptographically random state parameter.
 *
 * @example
 * ```ts
 * const state = generateState();
 * // "a1b2c3d4e5f6..." (32-char hex string)
 * ```
 */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
