import { describe, it, expect } from "vitest";
import {
  generatePKCE,
  computeS256Challenge,
  verifyCodeChallenge,
  validateCodeVerifier,
} from "../pkce.js";

describe("generatePKCE", () => {
  it("generates a valid PKCE pair", async () => {
    const pkce = await generatePKCE();
    expect(pkce.code_verifier).toBeDefined();
    expect(pkce.code_challenge).toBeDefined();
    expect(pkce.code_challenge_method).toBe("S256");
  });

  it("generates verifier with 43+ characters", async () => {
    const pkce = await generatePKCE();
    expect(pkce.code_verifier.length).toBeGreaterThanOrEqual(43);
  });

  it("generates verifier with valid characters", async () => {
    const pkce = await generatePKCE();
    expect(/^[A-Za-z0-9\-._~]+$/.test(pkce.code_verifier)).toBe(true);
  });

  it("generates unique pairs", async () => {
    const a = await generatePKCE();
    const b = await generatePKCE();
    expect(a.code_verifier).not.toBe(b.code_verifier);
    expect(a.code_challenge).not.toBe(b.code_challenge);
  });

  it("challenge verifies against its verifier", async () => {
    const pkce = await generatePKCE();
    const valid = await verifyCodeChallenge(
      pkce.code_verifier,
      pkce.code_challenge,
      "S256",
    );
    expect(valid).toBe(true);
  });
});

describe("computeS256Challenge", () => {
  it("computes consistent challenge for same verifier", async () => {
    const a = await computeS256Challenge(
      "test-verifier-value-that-is-long-enough-here",
    );
    const b = await computeS256Challenge(
      "test-verifier-value-that-is-long-enough-here",
    );
    expect(a).toBe(b);
  });

  it("computes different challenges for different verifiers", async () => {
    const a = await computeS256Challenge(
      "verifier-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const b = await computeS256Challenge(
      "verifier-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    expect(a).not.toBe(b);
  });

  it("produces base64url-encoded output (no padding)", async () => {
    const challenge = await computeS256Challenge("test-verifier-value");
    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
    expect(challenge).not.toContain("=");
  });
});

describe("verifyCodeChallenge", () => {
  it("verifies S256 challenge", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await computeS256Challenge(verifier);
    expect(await verifyCodeChallenge(verifier, challenge, "S256")).toBe(true);
  });

  it("rejects wrong verifier for S256", async () => {
    const challenge = await computeS256Challenge(
      "correct-verifier-aaaaaaaaaaaaaaaaaaa",
    );
    expect(
      await verifyCodeChallenge(
        "wrong-verifier-bbbbbbbbbbbbbbbbbbbbb",
        challenge,
        "S256",
      ),
    ).toBe(false);
  });

  it("verifies plain challenge (exact match)", async () => {
    expect(await verifyCodeChallenge("same-value", "same-value", "plain")).toBe(
      true,
    );
  });

  it("rejects wrong plain challenge", async () => {
    expect(await verifyCodeChallenge("a", "b", "plain")).toBe(false);
  });
});

describe("validateCodeVerifier", () => {
  it("accepts valid 43-char verifier", () => {
    const verifier = "a".repeat(43);
    expect(validateCodeVerifier(verifier)).toEqual({ valid: true });
  });

  it("accepts valid 128-char verifier", () => {
    const verifier = "a".repeat(128);
    expect(validateCodeVerifier(verifier)).toEqual({ valid: true });
  });

  it("accepts all valid characters", () => {
    const verifier = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq";
    expect(validateCodeVerifier(verifier)).toEqual({ valid: true });
  });

  it("accepts special allowed characters", () => {
    const verifier = "abcdefghijklmnopqrstuvwxyz-._~ABCDEFGHIJKLM";
    expect(validateCodeVerifier(verifier)).toEqual({ valid: true });
  });

  it("rejects verifier shorter than 43 chars", () => {
    const result = validateCodeVerifier("a".repeat(42));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at least 43");
  });

  it("rejects verifier longer than 128 chars", () => {
    const result = validateCodeVerifier("a".repeat(129));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at most 128");
  });

  it("rejects verifier with invalid characters", () => {
    const result = validateCodeVerifier("a".repeat(42) + "!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("only contain");
  });

  it("rejects verifier with spaces", () => {
    const result = validateCodeVerifier("a".repeat(42) + " ");
    expect(result.valid).toBe(false);
  });
});
