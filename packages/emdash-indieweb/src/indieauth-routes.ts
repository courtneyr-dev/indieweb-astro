/**
 * IndieAuth server route handlers.
 *
 * The plugin owns the authorization state (codes, tokens) in plugin
 * storage; the site's Astro routes own the HTTP wire format and, for
 * the consent flow, the admin-session gate. Handlers return plain
 * objects — OAuth-style `{ error }` objects on failure — so the wire
 * layer can shape status codes.
 *
 * Route trust model:
 * - `issueAuthorizationCode` backs a PRIVATE route: only the site's
 *   consent flow (which verifies the EmDash admin session) may call it.
 * - `redeemAuthorizationCode` / `verifyAccessToken` back PUBLIC routes:
 *   they are secured by possession of the code/token itself.
 *
 * @see https://indieauth.spec.indieweb.org/
 */
import type { PluginContext } from "emdash";
import {
  CODE_TTL_MS,
  TOKEN_TTL_MS,
  generateSecret,
  hashSecret,
  isExpired,
  verifyCodeChallenge,
} from "@opensourcetogether/indieweb-core/indieauth";
import type {
  AuthorizationCodeRecord,
  AccessTokenRecord,
} from "@opensourcetogether/indieweb-core/indieauth";

/** Input for {@link issueAuthorizationCode}. */
export interface IssueCodeInput {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  me: string;
}

/**
 * Issue a single-use authorization code for a validated, consented
 * authorization request. The plaintext code is returned to the caller
 * for the redirect; only its SHA-256 hash is stored.
 */
export async function issueAuthorizationCode(
  ctx: PluginContext,
  input: IssueCodeInput,
): Promise<{ code: string }> {
  const code = generateSecret();
  const now = new Date();
  const record: AuthorizationCodeRecord = {
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: "S256",
    scopes: input.scopes,
    me: input.me,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
  };
  await ctx.storage.indieauth_codes.put(
    await hashSecret(code),
    record as unknown as Record<string, unknown>,
  );
  return { code };
}

/** Input for {@link redeemAuthorizationCode}. */
export interface RedeemCodeInput {
  grantType?: string;
  code?: string;
  clientId?: string;
  redirectUri?: string;
  codeVerifier?: string;
  /**
   * "token" — token-endpoint redemption, issues an access token.
   * "profile" — authorization-endpoint redemption, returns `me` only.
   */
  flow: "token" | "profile";
}

/** OAuth error shape returned by redemption/verification failures. */
export interface OAuthErrorBody {
  error: string;
  error_description: string;
}

/** Successful token-flow redemption response. */
export interface TokenResponseBody {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  me: string;
  expires_in: number;
}

/** Successful profile-flow redemption response. */
export interface ProfileResponseBody {
  me: string;
}

function oauthError(error: string, description: string): OAuthErrorBody {
  return { error, error_description: description };
}

/**
 * Redeem an authorization code (single use). Validates client_id,
 * redirect_uri, expiry, and the PKCE code_verifier, then either
 * issues an access token (`flow: "token"`) or returns the profile
 * URL (`flow: "profile"`).
 */
export async function redeemAuthorizationCode(
  ctx: PluginContext,
  input: RedeemCodeInput,
): Promise<TokenResponseBody | ProfileResponseBody | OAuthErrorBody> {
  if (input.grantType && input.grantType !== "authorization_code") {
    return oauthError(
      "unsupported_grant_type",
      `grant_type must be "authorization_code"`,
    );
  }
  if (!input.code || !input.clientId || !input.redirectUri) {
    return oauthError(
      "invalid_request",
      "code, client_id, and redirect_uri are required",
    );
  }
  if (!input.codeVerifier) {
    return oauthError("invalid_request", "code_verifier is required (PKCE)");
  }

  const codeHash = await hashSecret(input.code);
  const stored = await ctx.storage.indieauth_codes.get(codeHash);
  if (!stored) {
    return oauthError("invalid_grant", "authorization code is invalid");
  }
  // Single use: delete before validation so a failed attempt also burns it.
  await ctx.storage.indieauth_codes.delete(codeHash);

  const record = stored as unknown as AuthorizationCodeRecord;
  if (isExpired(record.expiresAt)) {
    return oauthError("invalid_grant", "authorization code has expired");
  }
  if (record.clientId !== input.clientId) {
    return oauthError("invalid_grant", "client_id does not match");
  }
  if (record.redirectUri !== input.redirectUri) {
    return oauthError("invalid_grant", "redirect_uri does not match");
  }
  const pkceOk = await verifyCodeChallenge(
    input.codeVerifier,
    record.codeChallenge,
    "S256",
  );
  if (!pkceOk) {
    return oauthError("invalid_grant", "PKCE verification failed");
  }

  if (input.flow === "profile") {
    return { me: record.me };
  }

  if (record.scopes.length === 0) {
    return oauthError(
      "invalid_grant",
      "no scope was granted; redeem at the authorization endpoint instead",
    );
  }

  const token = generateSecret();
  const now = new Date();
  const tokenRecord: AccessTokenRecord = {
    clientId: record.clientId,
    scopes: record.scopes,
    me: record.me,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
  };
  await ctx.storage.indieauth_tokens.put(
    await hashSecret(token),
    tokenRecord as unknown as Record<string, unknown>,
  );

  return {
    access_token: token,
    token_type: "Bearer",
    scope: record.scopes.join(" "),
    me: record.me,
    expires_in: Math.floor(TOKEN_TTL_MS / 1000),
  };
}

/** Result of a token verification. */
export interface TokenVerification {
  active: boolean;
  me?: string;
  client_id?: string;
  scope?: string;
  error?: string;
}

/**
 * Verify a bearer access token, optionally requiring a scope.
 * Mirrors OAuth token introspection: inactive tokens return
 * `{ active: false }` rather than an error object.
 */
export async function verifyAccessToken(
  ctx: PluginContext,
  token: string | undefined,
  requiredScope?: string,
): Promise<TokenVerification> {
  if (!token) return { active: false, error: "missing token" };

  const stored = await ctx.storage.indieauth_tokens.get(
    await hashSecret(token),
  );
  if (!stored) return { active: false, error: "unknown token" };

  const record = stored as unknown as AccessTokenRecord;
  if (isExpired(record.expiresAt)) {
    return { active: false, error: "token expired" };
  }
  if (requiredScope && !record.scopes.includes(requiredScope)) {
    return {
      active: false,
      error: `token lacks required scope: ${requiredScope}`,
      me: record.me,
      client_id: record.clientId,
      scope: record.scopes.join(" "),
    };
  }
  return {
    active: true,
    me: record.me,
    client_id: record.clientId,
    scope: record.scopes.join(" "),
  };
}

/**
 * Revoke an access token (RFC 7009 semantics: always succeeds).
 */
export async function revokeAccessToken(
  ctx: PluginContext,
  token: string | undefined,
): Promise<{ revoked: boolean }> {
  if (!token) return { revoked: false };
  const deleted = await ctx.storage.indieauth_tokens.delete(
    await hashSecret(token),
  );
  return { revoked: deleted };
}
