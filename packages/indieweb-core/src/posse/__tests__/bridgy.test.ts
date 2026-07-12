import { describe, it, expect } from "vitest";
import {
  BRIDGY_WEBMENTION_ENDPOINT,
  isBridgyPublishTarget,
  parseBridgyResponse,
} from "../bridgy.js";

describe("isBridgyPublishTarget", () => {
  it("accepts brid.gy publish URLs", () => {
    expect(isBridgyPublishTarget("https://brid.gy/publish/mastodon")).toBe(
      true,
    );
    expect(isBridgyPublishTarget("https://brid.gy/publish/bluesky")).toBe(
      true,
    );
    expect(isBridgyPublishTarget("https://www.brid.gy/publish/github")).toBe(
      true,
    );
  });

  it("rejects non-bridgy URLs", () => {
    expect(isBridgyPublishTarget("https://mastodon.social/@me")).toBe(false);
    expect(isBridgyPublishTarget("https://brid.gy/about")).toBe(false);
    expect(isBridgyPublishTarget("https://evil.example/publish/mastodon")).toBe(
      false,
    );
  });

  it("rejects invalid URLs", () => {
    expect(isBridgyPublishTarget("not a url")).toBe(false);
    expect(isBridgyPublishTarget("")).toBe(false);
  });
});

describe("parseBridgyResponse", () => {
  it("extracts the syndicated URL on success", () => {
    const result = parseBridgyResponse(
      201,
      JSON.stringify({ url: "https://mastodon.social/@me/1234" }),
    );
    expect(result).toEqual({ url: "https://mastodon.social/@me/1234" });
  });

  it("reports missing URL on 2xx without url", () => {
    const result = parseBridgyResponse(200, "{}");
    expect(result.url).toBeUndefined();
    expect(result.error).toContain("without a syndicated URL");
  });

  it("extracts error message from failed responses", () => {
    const result = parseBridgyResponse(
      400,
      JSON.stringify({ error: "silo account not found" }),
    );
    expect(result).toEqual({ error: "silo account not found" });
  });

  it("falls back to HTTP status for non-JSON errors", () => {
    const result = parseBridgyResponse(502, "<html>bad gateway</html>");
    expect(result.error).toContain("502");
  });
});

describe("BRIDGY_WEBMENTION_ENDPOINT", () => {
  it("is the documented Bridgy publish webmention endpoint", () => {
    expect(BRIDGY_WEBMENTION_ENDPOINT).toBe(
      "https://brid.gy/publish/webmention",
    );
  });
});
