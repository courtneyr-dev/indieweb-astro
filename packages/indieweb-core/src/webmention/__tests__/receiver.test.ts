import { describe, it, expect } from "vitest";
import { validateWebmention, sourceLinksToTarget } from "../receiver.js";

describe("validateWebmention", () => {
  const source = "https://alice.example/post/1";
  const target = "https://bob.example/post/2";

  it("accepts valid source and target", () => {
    const result = validateWebmention(source, target);
    expect(result).toEqual({ valid: true, source, target });
  });

  it("rejects missing source", () => {
    const result = validateWebmention("", target);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it("rejects missing target", () => {
    const result = validateWebmention(source, "");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it("rejects invalid source URL", () => {
    const result = validateWebmention("not-a-url", target);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid source/i);
  });

  it("rejects invalid target URL", () => {
    const result = validateWebmention(source, "not-a-url");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid target/i);
  });

  it("rejects non-http source (ftp)", () => {
    const result = validateWebmention("ftp://alice.example/file", target);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/scheme/i);
  });

  it("rejects non-http target (mailto)", () => {
    const result = validateWebmention(source, "mailto:bob@example.com");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/scheme/i);
  });

  it("accepts http (not just https)", () => {
    const result = validateWebmention(
      "http://alice.example/post",
      "http://bob.example/post",
    );
    expect(result.valid).toBe(true);
  });

  it("rejects same source and target", () => {
    const result = validateWebmention(source, source);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/different/i);
  });

  it("rejects same URL ignoring fragment", () => {
    const result = validateWebmention(
      "https://example.com/post",
      "https://example.com/post#comment",
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/different/i);
  });

  it("accepts when target domain is in acceptedDomains", () => {
    const result = validateWebmention(source, target, ["bob.example"]);
    expect(result.valid).toBe(true);
  });

  it("rejects when target domain is not in acceptedDomains", () => {
    const result = validateWebmention(source, target, ["other.example"]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not accepted/i);
  });

  it("accepts subdomain when parent is in acceptedDomains", () => {
    const result = validateWebmention(
      source,
      "https://blog.bob.example/post/1",
      ["bob.example"],
    );
    expect(result.valid).toBe(true);
  });

  it("is case-insensitive for domain matching", () => {
    const result = validateWebmention(source, "https://BOB.EXAMPLE/post/1", [
      "bob.example",
    ]);
    expect(result.valid).toBe(true);
  });

  it("skips domain check when acceptedDomains is empty", () => {
    const result = validateWebmention(source, target, []);
    expect(result.valid).toBe(true);
  });

  it("skips domain check when acceptedDomains is undefined", () => {
    const result = validateWebmention(source, target);
    expect(result.valid).toBe(true);
  });
});

describe("sourceLinksToTarget", () => {
  const target = "https://bob.example/post/2";

  // HTML content
  it("finds target in href attribute", () => {
    const html = `<a href="${target}">Link</a>`;
    expect(sourceLinksToTarget(html, target, "text/html")).toBe(true);
  });

  it("finds target in src attribute", () => {
    const html = `<img src="${target}" />`;
    expect(sourceLinksToTarget(html, target, "text/html")).toBe(true);
  });

  it("finds target in srcset attribute", () => {
    const html = `<img srcset="${target} 1x, https://other.com/img 2x" />`;
    expect(sourceLinksToTarget(html, target, "text/html")).toBe(true);
  });

  it("returns false when target is not in HTML", () => {
    const html = '<a href="https://other.example/post">Link</a>';
    expect(sourceLinksToTarget(html, target, "text/html")).toBe(false);
  });

  it("requires exact match — no partial URL matching", () => {
    const html = '<a href="https://bob.example/post/2/extra">Link</a>';
    expect(sourceLinksToTarget(html, target, "text/html")).toBe(false);
  });

  it("does not treat data-href or other suffixed attributes as links", () => {
    const html = `<div data-href="${target}" formsrc="${target}" data-srcset="${target} 1x"></div>`;
    expect(sourceLinksToTarget(html, target, "text/html")).toBe(false);
  });

  it("strips fragment from target before matching", () => {
    const html = `<a href="${target}">Link</a>`;
    expect(sourceLinksToTarget(html, target + "#section", "text/html")).toBe(
      true,
    );
  });

  it("handles xhtml content type", () => {
    const html = `<a href="${target}">Link</a>`;
    expect(sourceLinksToTarget(html, target, "application/xhtml+xml")).toBe(
      true,
    );
  });

  // JSON content
  it("finds target in JSON content", () => {
    const json = JSON.stringify({ url: target });
    expect(sourceLinksToTarget(json, target, "application/json")).toBe(true);
  });

  it("returns false when target is not in JSON", () => {
    const json = JSON.stringify({ url: "https://other.example" });
    expect(sourceLinksToTarget(json, target, "application/json")).toBe(false);
  });

  // Plain text
  it("finds target in plain text", () => {
    const text = `Check out ${target} for more info.`;
    expect(sourceLinksToTarget(text, target, "text/plain")).toBe(true);
  });

  it("returns false when target is not in plain text", () => {
    const text = "Check out https://other.example for more info.";
    expect(sourceLinksToTarget(text, target, "text/plain")).toBe(false);
  });

  // Content type with charset
  it("handles content type with charset parameter", () => {
    const html = `<a href="${target}">Link</a>`;
    expect(sourceLinksToTarget(html, target, "text/html; charset=utf-8")).toBe(
      true,
    );
  });
});
