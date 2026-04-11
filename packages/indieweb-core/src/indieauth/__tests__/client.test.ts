import { describe, it, expect } from "vitest";
import {
  buildAuthorizationUrl,
  parseAuthorizationResponse,
  buildTokenRequestBody,
  buildRefreshTokenRequestBody,
  buildRevocationRequestBody,
  parseTokenResponse,
  parseProfileResponse,
  generateState,
} from "../client.js";

describe("buildAuthorizationUrl", () => {
  it("builds a complete authorization URL", () => {
    const url = buildAuthorizationUrl("https://auth.example.com/auth", {
      response_type: "code",
      client_id: "https://app.example.com/",
      redirect_uri: "https://app.example.com/callback",
      state: "abc123",
      code_challenge: "challenge-value",
      code_challenge_method: "S256",
      scope: "profile create",
      me: "https://user.example.net/",
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://auth.example.com");
    expect(parsed.pathname).toBe("/auth");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe(
      "https://app.example.com/",
    );
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/callback",
    );
    expect(parsed.searchParams.get("state")).toBe("abc123");
    expect(parsed.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("scope")).toBe("profile create");
    expect(parsed.searchParams.get("me")).toBe("https://user.example.net/");
  });

  it("omits optional params when not provided", () => {
    const url = buildAuthorizationUrl("https://auth.example.com/auth", {
      response_type: "code",
      client_id: "https://app.example.com/",
      redirect_uri: "https://app.example.com/callback",
      state: "abc123",
      code_challenge: "challenge-value",
      code_challenge_method: "S256",
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.has("scope")).toBe(false);
    expect(parsed.searchParams.has("me")).toBe(false);
  });
});

describe("parseAuthorizationResponse", () => {
  it("parses valid callback URL", () => {
    const result = parseAuthorizationResponse(
      "https://app.example.com/callback?code=auth-code&state=abc123&iss=https://auth.example.com",
    );
    expect(result).toEqual({
      code: "auth-code",
      state: "abc123",
      iss: "https://auth.example.com",
    });
  });

  it("returns error response from callback", () => {
    const result = parseAuthorizationResponse(
      "https://app.example.com/callback?error=access_denied&error_description=User+denied",
    );
    expect(result).toEqual({
      error: "access_denied",
      error_description: "User denied",
    });
  });

  it("returns error for missing code", () => {
    const result = parseAuthorizationResponse(
      "https://app.example.com/callback?state=abc&iss=https://auth.example.com",
    );
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error_description).toContain("code");
    }
  });

  it("returns error for missing state", () => {
    const result = parseAuthorizationResponse(
      "https://app.example.com/callback?code=abc&iss=https://auth.example.com",
    );
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error_description).toContain("state");
    }
  });

  it("returns error for missing iss", () => {
    const result = parseAuthorizationResponse(
      "https://app.example.com/callback?code=abc&state=123",
    );
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error_description).toContain("iss");
    }
  });
});

describe("buildTokenRequestBody", () => {
  it("builds correct form-encoded body", () => {
    const body = buildTokenRequestBody({
      grant_type: "authorization_code",
      code: "auth-code",
      client_id: "https://app.example.com/",
      redirect_uri: "https://app.example.com/callback",
      code_verifier: "verifier-value",
    });

    const params = new URLSearchParams(body);
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("code")).toBe("auth-code");
    expect(params.get("client_id")).toBe("https://app.example.com/");
    expect(params.get("redirect_uri")).toBe("https://app.example.com/callback");
    expect(params.get("code_verifier")).toBe("verifier-value");
  });
});

describe("buildRefreshTokenRequestBody", () => {
  it("builds correct form-encoded body", () => {
    const body = buildRefreshTokenRequestBody({
      grant_type: "refresh_token",
      refresh_token: "refresh-value",
      client_id: "https://app.example.com/",
      scope: "create update",
    });

    const params = new URLSearchParams(body);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("refresh-value");
    expect(params.get("client_id")).toBe("https://app.example.com/");
    expect(params.get("scope")).toBe("create update");
  });

  it("omits scope when not provided", () => {
    const body = buildRefreshTokenRequestBody({
      grant_type: "refresh_token",
      refresh_token: "refresh-value",
      client_id: "https://app.example.com/",
    });

    const params = new URLSearchParams(body);
    expect(params.has("scope")).toBe(false);
  });
});

describe("buildRevocationRequestBody", () => {
  it("builds correct form-encoded body", () => {
    const body = buildRevocationRequestBody("token-value");
    const params = new URLSearchParams(body);
    expect(params.get("token")).toBe("token-value");
  });
});

describe("parseTokenResponse", () => {
  it("parses valid token response", () => {
    const result = parseTokenResponse({
      access_token: "XXXXXX",
      token_type: "Bearer",
      scope: "create update",
      me: "https://user.example.net/",
      expires_in: 3600,
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.access_token).toBe("XXXXXX");
      expect(result.token_type).toBe("Bearer");
      expect(result.scope).toBe("create update");
      expect(result.me).toBe("https://user.example.net/");
      expect(result.expires_in).toBe(3600);
    }
  });

  it("parses token response with profile", () => {
    const result = parseTokenResponse({
      access_token: "XXXXXX",
      token_type: "Bearer",
      scope: "profile",
      me: "https://user.example.net/",
      profile: {
        name: "User",
        url: "https://user.example.net/",
        photo: "https://user.example.net/photo.jpg",
      },
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.profile?.name).toBe("User");
      expect(result.profile?.url).toBe("https://user.example.net/");
    }
  });

  it("parses token response with refresh_token", () => {
    const result = parseTokenResponse({
      access_token: "XXXXXX",
      token_type: "Bearer",
      scope: "create",
      me: "https://user.example.net/",
      refresh_token: "RRRRRR",
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.refresh_token).toBe("RRRRRR");
    }
  });

  it("returns error response from server", () => {
    const result = parseTokenResponse({
      error: "invalid_request",
      error_description: "Code expired",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("invalid_request");
      expect(result.error_description).toBe("Code expired");
    }
  });

  it("returns error for missing access_token", () => {
    const result = parseTokenResponse({
      token_type: "Bearer",
      me: "https://user.example.net/",
    });
    expect("error" in result).toBe(true);
  });

  it("returns error for missing me", () => {
    const result = parseTokenResponse({
      access_token: "XXXXXX",
      token_type: "Bearer",
    });
    expect("error" in result).toBe(true);
  });

  it("returns error for non-object", () => {
    expect("error" in parseTokenResponse(null)).toBe(true);
    expect("error" in parseTokenResponse("string")).toBe(true);
    expect("error" in parseTokenResponse(42)).toBe(true);
  });

  it("defaults token_type to Bearer", () => {
    const result = parseTokenResponse({
      access_token: "XXXXXX",
      me: "https://user.example.net/",
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.token_type).toBe("Bearer");
    }
  });

  it("defaults scope to empty string", () => {
    const result = parseTokenResponse({
      access_token: "XXXXXX",
      me: "https://user.example.net/",
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.scope).toBe("");
    }
  });
});

describe("parseProfileResponse", () => {
  it("parses valid profile response", () => {
    const result = parseProfileResponse({
      me: "https://user.example.net/",
      profile: { name: "User" },
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.me).toBe("https://user.example.net/");
      expect(result.profile?.name).toBe("User");
    }
  });

  it("parses profile response without profile object", () => {
    const result = parseProfileResponse({ me: "https://user.example.net/" });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.me).toBe("https://user.example.net/");
      expect(result.profile).toBeUndefined();
    }
  });

  it("returns error for missing me", () => {
    const result = parseProfileResponse({ profile: { name: "User" } });
    expect("error" in result).toBe(true);
  });

  it("returns error response from server", () => {
    const result = parseProfileResponse({
      error: "access_denied",
      error_description: "User denied",
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("access_denied");
    }
  });

  it("returns error for non-object", () => {
    expect("error" in parseProfileResponse(null)).toBe(true);
  });
});

describe("generateState", () => {
  it("generates a 32-character hex string", () => {
    const state = generateState();
    expect(state).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(state)).toBe(true);
  });

  it("generates unique values", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});
