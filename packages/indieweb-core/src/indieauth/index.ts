/**
 * IndieAuth module — client/server helpers for the IndieAuth protocol.
 *
 * @example
 * ```ts
 * import {
 *   discoverIndieAuth,
 *   generatePKCE,
 *   buildAuthorizationUrl,
 *   validateClientId,
 * } from "@opensourcetogether/indieweb-core/indieauth";
 * ```
 *
 * @see https://indieauth.spec.indieweb.org/
 */

// Types
export type {
  IndieAuthMetadata,
  IndieAuthEndpoints,
  AuthorizationRequest,
  AuthorizationResponse,
  TokenRequest,
  TokenResponse,
  ProfileResponse,
  ProfileInfo,
  TokenIntrospection,
  RefreshTokenRequest,
  PKCEPair,
  ClientMetadata,
  IndieAuthError,
  ValidationResult,
} from "./types.js";

// Discovery
export {
  discoverEndpointsFromHeaders,
  discoverEndpointsFromHtml,
  discoverIndieAuth,
} from "./discovery.js";

// PKCE
export {
  generatePKCE,
  computeS256Challenge,
  verifyCodeChallenge,
  validateCodeVerifier,
} from "./pkce.js";

// Client helpers
export {
  buildAuthorizationUrl,
  parseAuthorizationResponse,
  buildTokenRequestBody,
  buildRefreshTokenRequestBody,
  buildRevocationRequestBody,
  parseTokenResponse,
  parseProfileResponse,
  generateState,
} from "./client.js";

// Validation
export {
  validateClientId,
  validateRedirectUri,
  canonicalizeUrl,
  profileUrlsMatch,
} from "./validation.js";

// Server-side primitives
export type {
  ValidatedAuthorizationRequest,
  AuthorizationCodeRecord,
  AccessTokenRecord,
  AuthorizationServerError,
} from "./server.js";
export {
  CODE_TTL_MS,
  TOKEN_TTL_MS,
  TXN_TTL_MS,
  validateAuthorizationRequest,
  isAuthorizationServerError,
  generateSecret,
  hashSecret,
  isExpired,
} from "./server.js";
