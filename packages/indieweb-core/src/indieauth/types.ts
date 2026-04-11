/**
 * IndieAuth types — covers the full IndieAuth protocol.
 *
 * @see https://indieauth.spec.indieweb.org/
 */

/**
 * Server metadata from the IndieAuth metadata endpoint.
 *
 * @example
 * ```ts
 * const metadata: IndieAuthMetadata = {
 *   issuer: "https://indieauth.example.com",
 *   authorization_endpoint: "https://indieauth.example.com/auth",
 *   token_endpoint: "https://indieauth.example.com/token",
 *   code_challenge_methods_supported: ["S256"],
 * };
 * ```
 */
export interface IndieAuthMetadata {
  /** Server's issuer identifier (URL) */
  issuer: string;
  /** Authorization endpoint URL */
  authorization_endpoint: string;
  /** Token endpoint URL */
  token_endpoint: string;
  /** Token introspection endpoint */
  introspection_endpoint?: string;
  /** Token revocation endpoint */
  revocation_endpoint?: string;
  /** User profile endpoint */
  userinfo_endpoint?: string;
  /** Supported PKCE methods (must include "S256") */
  code_challenge_methods_supported?: string[];
  /** Supported scopes */
  scopes_supported?: string[];
}

/**
 * Discovered IndieAuth endpoints from a profile URL.
 *
 * @example
 * ```ts
 * const endpoints: IndieAuthEndpoints = {
 *   authorization_endpoint: "https://indieauth.example.com/auth",
 *   token_endpoint: "https://indieauth.example.com/token",
 * };
 * ```
 */
export interface IndieAuthEndpoints {
  /** Full metadata if discovered via indieauth-metadata link */
  metadata?: IndieAuthMetadata;
  /** Authorization endpoint URL */
  authorization_endpoint?: string;
  /** Token endpoint URL */
  token_endpoint?: string;
}

/**
 * Parameters for an IndieAuth authorization request.
 *
 * @example
 * ```ts
 * const request: AuthorizationRequest = {
 *   response_type: "code",
 *   client_id: "https://app.example.com/",
 *   redirect_uri: "https://app.example.com/callback",
 *   state: "random-state-value",
 *   code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
 *   code_challenge_method: "S256",
 *   scope: "profile create",
 * };
 * ```
 */
export interface AuthorizationRequest {
  /** Must be "code" */
  response_type: "code";
  /** Client's URL identifier */
  client_id: string;
  /** Where to redirect after auth */
  redirect_uri: string;
  /** CSRF protection value */
  state: string;
  /** PKCE code challenge (BASE64URL(SHA256(code_verifier))) */
  code_challenge: string;
  /** PKCE method — S256 required, plain allowed for backwards compat */
  code_challenge_method: "S256" | "plain";
  /** Space-separated scopes (e.g. "profile create update delete") */
  scope?: string;
  /** User's profile URL hint */
  me?: string;
}

/**
 * Authorization response parameters from the callback URL.
 *
 * @example
 * ```ts
 * const response: AuthorizationResponse = {
 *   code: "auth-code-value",
 *   state: "random-state-value",
 *   iss: "https://indieauth.example.com",
 * };
 * ```
 */
export interface AuthorizationResponse {
  /** Authorization code (single-use, short-lived) */
  code: string;
  /** State value — must match the original request */
  state: string;
  /** Issuer identifier — must match discovered metadata */
  iss: string;
}

/**
 * Token exchange request (authorization code grant).
 *
 * @example
 * ```ts
 * const request: TokenRequest = {
 *   grant_type: "authorization_code",
 *   code: "auth-code-value",
 *   client_id: "https://app.example.com/",
 *   redirect_uri: "https://app.example.com/callback",
 *   code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
 * };
 * ```
 */
export interface TokenRequest {
  /** Must be "authorization_code" */
  grant_type: "authorization_code";
  /** Authorization code from callback */
  code: string;
  /** Must match the original authorization request */
  client_id: string;
  /** Must match the original authorization request */
  redirect_uri: string;
  /** PKCE code verifier (43-128 chars from [A-Za-z0-9\-._~]) */
  code_verifier: string;
}

/**
 * Access token response from the token endpoint.
 *
 * @example
 * ```ts
 * const response: TokenResponse = {
 *   access_token: "XXXXXX",
 *   token_type: "Bearer",
 *   scope: "create update",
 *   me: "https://user.example.net/",
 * };
 * ```
 */
export interface TokenResponse {
  /** OAuth 2.0 Bearer token */
  access_token: string;
  /** Always "Bearer" */
  token_type: "Bearer";
  /** Granted scopes (space-separated) */
  scope: string;
  /** Canonical profile URL of the authenticated user */
  me: string;
  /** Token lifetime in seconds */
  expires_in?: number;
  /** Refresh token for obtaining new access tokens */
  refresh_token?: string;
  /** User profile information (if profile/email scope granted) */
  profile?: ProfileInfo;
}

/**
 * Profile-only response from the authorization endpoint.
 *
 * @example
 * ```ts
 * const response: ProfileResponse = {
 *   me: "https://user.example.net/",
 *   profile: { name: "Example User" },
 * };
 * ```
 */
export interface ProfileResponse {
  /** Canonical profile URL */
  me: string;
  /** Non-authoritative profile information */
  profile?: ProfileInfo;
}

/**
 * User profile information.
 *
 * @example
 * ```ts
 * const profile: ProfileInfo = {
 *   name: "Courtney Robertson",
 *   url: "https://courtneyr.dev",
 *   photo: "https://courtneyr.dev/photo.jpg",
 * };
 * ```
 */
export interface ProfileInfo {
  name?: string;
  url?: string;
  photo?: string;
  email?: string;
}

/**
 * Token introspection response.
 *
 * @example
 * ```ts
 * const introspection: TokenIntrospection = {
 *   active: true,
 *   me: "https://user.example.net/",
 *   scope: "create update",
 * };
 * ```
 */
export interface TokenIntrospection {
  /** Whether the token is currently active */
  active: boolean;
  /** Profile URL (present when active) */
  me?: string;
  /** Client that requested the token */
  client_id?: string;
  /** Granted scopes */
  scope?: string;
  /** Expiration timestamp (seconds since epoch) */
  exp?: number;
  /** Issued-at timestamp (seconds since epoch) */
  iat?: number;
}

/**
 * Refresh token request.
 *
 * @example
 * ```ts
 * const request: RefreshTokenRequest = {
 *   grant_type: "refresh_token",
 *   refresh_token: "XXXXXX",
 *   client_id: "https://app.example.com/",
 * };
 * ```
 */
export interface RefreshTokenRequest {
  /** Must be "refresh_token" */
  grant_type: "refresh_token";
  /** The refresh token */
  refresh_token: string;
  /** Client identifier */
  client_id: string;
  /** Optionally request a subset of the original scopes */
  scope?: string;
}

/**
 * PKCE code verifier and challenge pair.
 *
 * @example
 * ```ts
 * const pkce: PKCEPair = {
 *   code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
 *   code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
 *   code_challenge_method: "S256",
 * };
 * ```
 */
export interface PKCEPair {
  /** Random string, 43-128 chars from [A-Za-z0-9\-._~] */
  code_verifier: string;
  /** BASE64URL(SHA256(code_verifier)) */
  code_challenge: string;
  /** Always "S256" */
  code_challenge_method: "S256";
}

/**
 * Client metadata discovered from a client_id URL.
 *
 * @example
 * ```ts
 * const client: ClientMetadata = {
 *   client_id: "https://app.example.com/",
 *   client_name: "My App",
 *   redirect_uris: ["https://app.example.com/callback"],
 * };
 * ```
 */
export interface ClientMetadata {
  /** Must match the fetched URL */
  client_id: string;
  /** Must be a prefix of client_id */
  client_uri?: string;
  /** Human-readable application name */
  client_name?: string;
  /** Application logo URL */
  logo_uri?: string;
  /** Registered redirect URIs */
  redirect_uris?: string[];
}

/**
 * IndieAuth error response (OAuth 2.0 error format).
 *
 * @example
 * ```ts
 * const error: IndieAuthError = {
 *   error: "invalid_request",
 *   error_description: "Missing required parameter: code",
 * };
 * ```
 */
export interface IndieAuthError {
  /** Error code */
  error:
    | "invalid_request"
    | "invalid_token"
    | "insufficient_scope"
    | "unauthorized"
    | "access_denied"
    | "server_error";
  /** Human-readable error description */
  error_description?: string;
}

/**
 * Result of validating a client_id or redirect_uri.
 *
 * @example
 * ```ts
 * const result: ValidationResult = { valid: true };
 * const failed: ValidationResult = { valid: false, error: "client_id must have a path" };
 * ```
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}
