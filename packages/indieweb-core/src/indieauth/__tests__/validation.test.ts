import { describe, it, expect } from "vitest";
import {
  validateClientId,
  validateRedirectUri,
  canonicalizeUrl,
  profileUrlsMatch,
} from "../validation.js";

describe("validateClientId", () => {
  it("accepts valid https URL with path", () => {
    expect(validateClientId("https://app.example.com/")).toEqual({
      valid: true,
    });
  });

  it("accepts valid http URL with path", () => {
    expect(validateClientId("http://app.example.com/")).toEqual({
      valid: true,
    });
  });

  it("accepts URL with path segments", () => {
    expect(validateClientId("https://example.com/app/client")).toEqual({
      valid: true,
    });
  });

  it("accepts URL with query string", () => {
    expect(validateClientId("https://example.com/?client=1")).toEqual({
      valid: true,
    });
  });

  it("accepts loopback IPv4", () => {
    expect(validateClientId("http://127.0.0.1/")).toEqual({ valid: true });
  });

  it("accepts loopback IPv6", () => {
    expect(validateClientId("http://[::1]/")).toEqual({ valid: true });
  });

  it("accepts localhost", () => {
    expect(validateClientId("http://localhost/")).toEqual({ valid: true });
  });

  it("accepts loopback with port", () => {
    expect(validateClientId("http://127.0.0.1:8080/")).toEqual({ valid: true });
  });

  it("accepts localhost with port", () => {
    expect(validateClientId("http://localhost:3000/")).toEqual({ valid: true });
  });

  it("rejects non-http scheme", () => {
    const result = validateClientId("ftp://example.com/");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("http or https");
  });

  it("rejects URL with fragment", () => {
    const result = validateClientId("https://example.com/#section");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("fragment");
  });

  it("rejects URL with username", () => {
    const result = validateClientId("https://user@example.com/");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("username or password");
  });

  it("rejects URL with password", () => {
    const result = validateClientId("https://user:pass@example.com/");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("username or password");
  });

  it("rejects non-loopback URL with port", () => {
    const result = validateClientId("https://example.com:8080/");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("port");
  });

  it("rejects arbitrary IPv4 address", () => {
    const result = validateClientId("http://192.168.1.1/");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("domain name");
  });

  it("rejects arbitrary IPv6 address", () => {
    const result = validateClientId("http://[2001:db8::1]/");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("domain name");
  });

  it("rejects dot segments in path", () => {
    const result = validateClientId("https://example.com/./path");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("dot segments");
  });

  it("rejects double-dot segments in path", () => {
    const result = validateClientId("https://example.com/../path");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("dot segments");
  });

  it("rejects invalid URL", () => {
    const result = validateClientId("not a url");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not a valid URL");
  });
});

describe("validateRedirectUri", () => {
  it("allows redirect_uri on same host as client_id", () => {
    expect(
      validateRedirectUri(
        "https://app.example.com/callback",
        "https://app.example.com/",
      ),
    ).toEqual({ valid: true });
  });

  it("allows same host with different paths", () => {
    expect(
      validateRedirectUri(
        "https://app.example.com/auth/callback",
        "https://app.example.com/",
      ),
    ).toEqual({ valid: true });
  });

  it("host comparison is case-insensitive", () => {
    expect(
      validateRedirectUri(
        "https://APP.example.com/callback",
        "https://app.EXAMPLE.com/",
      ),
    ).toEqual({ valid: true });
  });

  it("allows different host when registered", () => {
    expect(
      validateRedirectUri(
        "https://other.example.com/callback",
        "https://app.example.com/",
        ["https://other.example.com/callback"],
      ),
    ).toEqual({ valid: true });
  });

  it("requires exact match for registered URIs", () => {
    const result = validateRedirectUri(
      "https://other.example.com/callback?extra=1",
      "https://app.example.com/",
      ["https://other.example.com/callback"],
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exact match");
  });

  it("rejects different host without registration", () => {
    const result = validateRedirectUri(
      "https://other.example.com/callback",
      "https://app.example.com/",
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("no registered redirect URIs");
  });

  it("rejects different host with empty registration list", () => {
    const result = validateRedirectUri(
      "https://other.example.com/callback",
      "https://app.example.com/",
      [],
    );
    expect(result.valid).toBe(false);
  });

  it("rejects non-http scheme", () => {
    const result = validateRedirectUri(
      "ftp://app.example.com/callback",
      "https://app.example.com/",
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("http or https");
  });

  it("rejects invalid redirect_uri", () => {
    const result = validateRedirectUri("not a url", "https://app.example.com/");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not a valid URL");
  });

  it("rejects invalid client_id", () => {
    const result = validateRedirectUri(
      "https://app.example.com/callback",
      "not a url",
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not a valid URL");
  });
});

describe("canonicalizeUrl", () => {
  it("adds trailing slash to bare domain", () => {
    expect(canonicalizeUrl("https://example.com")).toBe("https://example.com/");
  });

  it("lowercases the host", () => {
    expect(canonicalizeUrl("https://EXAMPLE.COM/")).toBe(
      "https://example.com/",
    );
  });

  it("preserves path", () => {
    expect(canonicalizeUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("returns invalid URL as-is", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
  });
});

describe("profileUrlsMatch", () => {
  it("matches identical URLs", () => {
    expect(
      profileUrlsMatch("https://example.com/", "https://example.com/"),
    ).toBe(true);
  });

  it("matches with different casing", () => {
    expect(
      profileUrlsMatch("https://Example.Com/", "https://example.com/"),
    ).toBe(true);
  });

  it("matches bare domain with trailing slash", () => {
    expect(
      profileUrlsMatch("https://example.com", "https://example.com/"),
    ).toBe(true);
  });

  it("does not match different paths", () => {
    expect(
      profileUrlsMatch("https://example.com/a", "https://example.com/b"),
    ).toBe(false);
  });

  it("does not match different hosts", () => {
    expect(
      profileUrlsMatch("https://a.example.com/", "https://b.example.com/"),
    ).toBe(false);
  });
});
