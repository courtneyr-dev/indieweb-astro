import { describe, expect, it } from "vitest";

import {
  generateSecret,
  hashSecret,
  isAuthorizationServerError,
  isExpired,
  validateAuthorizationRequest,
} from "../server.js";

const VALID_PARAMS: Record<string, string> = {
  response_type: "code",
  client_id: "https://app.example.com/",
  redirect_uri: "https://app.example.com/callback",
  state: "abc123",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  scope: "create update",
};

describe("validateAuthorizationRequest", () => {
  it("accepts a fully valid request", () => {
    const result = validateAuthorizationRequest(VALID_PARAMS);
    expect(isAuthorizationServerError(result)).toBe(false);
    if (!isAuthorizationServerError(result)) {
      expect(result.clientId).toBe("https://app.example.com/");
      expect(result.redirectUri).toBe("https://app.example.com/callback");
      expect(result.scopes).toEqual(["create", "update"]);
      expect(result.codeChallengeMethod).toBe("S256");
    }
  });

  it("rejects a missing response_type", () => {
    const { response_type: _drop, ...params } = VALID_PARAMS;
    const result = validateAuthorizationRequest(params);
    expect(result).toMatchObject({ error: "invalid_request" });
  });

  it("rejects non-code response types", () => {
    const result = validateAuthorizationRequest({
      ...VALID_PARAMS,
      response_type: "token",
    });
    expect(result).toMatchObject({ error: "unsupported_response_type" });
  });

  it("rejects a missing client_id", () => {
    const { client_id: _drop, ...params } = VALID_PARAMS;
    expect(validateAuthorizationRequest(params)).toMatchObject({
      error: "invalid_request",
    });
  });

  it("rejects a non-URL client_id", () => {
    expect(
      validateAuthorizationRequest({ ...VALID_PARAMS, client_id: "not a url" }),
    ).toMatchObject({ error: "invalid_request" });
  });

  it("rejects a redirect_uri on a different host than client_id", () => {
    expect(
      validateAuthorizationRequest({
        ...VALID_PARAMS,
        redirect_uri: "https://evil.example.org/callback",
      }),
    ).toMatchObject({ error: "invalid_request" });
  });

  it("rejects a missing state", () => {
    const { state: _drop, ...params } = VALID_PARAMS;
    expect(validateAuthorizationRequest(params)).toMatchObject({
      error: "invalid_request",
    });
  });

  it("requires PKCE", () => {
    const { code_challenge: _drop, ...params } = VALID_PARAMS;
    expect(validateAuthorizationRequest(params)).toMatchObject({
      error: "invalid_request",
    });
  });

  it("rejects the plain code_challenge_method", () => {
    expect(
      validateAuthorizationRequest({
        ...VALID_PARAMS,
        code_challenge_method: "plain",
      }),
    ).toMatchObject({ error: "invalid_request" });
  });

  it("defaults code_challenge_method to S256", () => {
    const { code_challenge_method: _drop, ...params } = VALID_PARAMS;
    const result = validateAuthorizationRequest(params);
    expect(isAuthorizationServerError(result)).toBe(false);
    if (!isAuthorizationServerError(result)) {
      expect(result.codeChallengeMethod).toBe("S256");
    }
  });

  it("parses scope lists separated by spaces or plus signs", () => {
    const result = validateAuthorizationRequest({
      ...VALID_PARAMS,
      scope: "create+media",
    });
    if (!isAuthorizationServerError(result)) {
      expect(result.scopes).toEqual(["create", "media"]);
    }
  });

  it("returns an empty scope list when scope is absent", () => {
    const { scope: _drop, ...params } = VALID_PARAMS;
    const result = validateAuthorizationRequest(params);
    if (!isAuthorizationServerError(result)) {
      expect(result.scopes).toEqual([]);
    }
  });
});

describe("generateSecret", () => {
  it("produces unique 43-char base64url strings", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("hashSecret", () => {
  it("is deterministic and hex-encoded", async () => {
    const hash1 = await hashSecret("hello");
    const hash2 = await hashSecret("hello");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    // Known SHA-256 of "hello"
    expect(hash1).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("differs for different inputs", async () => {
    expect(await hashSecret("a")).not.toBe(await hashSecret("b"));
  });
});

describe("isExpired", () => {
  it("returns false before expiry and true after", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isExpired("2026-01-01T00:00:01Z", now)).toBe(false);
    expect(isExpired("2025-12-31T23:59:59Z", now)).toBe(true);
  });

  it("treats the exact expiry instant as expired", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isExpired("2026-01-01T00:00:00Z", now)).toBe(true);
  });

  it("treats unparseable timestamps as expired", () => {
    expect(isExpired("garbage")).toBe(true);
  });
});
