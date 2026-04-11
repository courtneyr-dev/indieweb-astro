import { describe, it, expect } from "vitest";
import {
  discoverMicropubFromHeaders,
  discoverMicropubFromHtml,
} from "../discovery.js";

describe("discoverMicropubFromHeaders", () => {
  it("discovers micropub endpoint from Link header", () => {
    const header = '<https://example.com/micropub>; rel="micropub"';
    const result = discoverMicropubFromHeaders(header, "https://example.com");
    expect(result).toBe("https://example.com/micropub");
  });

  it("handles rel with multiple values", () => {
    const header = '<https://example.com/micropub>; rel="micropub other"';
    const result = discoverMicropubFromHeaders(header, "https://example.com");
    expect(result).toBe("https://example.com/micropub");
  });

  it("resolves relative URL", () => {
    const header = '</micropub>; rel="micropub"';
    const result = discoverMicropubFromHeaders(header, "https://example.com");
    expect(result).toBe("https://example.com/micropub");
  });

  it("returns null when no micropub link found", () => {
    const header = '<https://example.com/auth>; rel="authorization_endpoint"';
    const result = discoverMicropubFromHeaders(header, "https://example.com");
    expect(result).toBeNull();
  });

  it("returns null for empty header", () => {
    expect(discoverMicropubFromHeaders("", "https://example.com")).toBeNull();
  });

  it("finds micropub among multiple links", () => {
    const header =
      '<https://example.com/auth>; rel="authorization_endpoint", ' +
      '<https://example.com/micropub>; rel="micropub"';
    const result = discoverMicropubFromHeaders(header, "https://example.com");
    expect(result).toBe("https://example.com/micropub");
  });
});

describe("discoverMicropubFromHtml", () => {
  it("discovers from link tag", () => {
    const html = '<link rel="micropub" href="https://example.com/micropub">';
    const result = discoverMicropubFromHtml(html, "https://example.com");
    expect(result).toBe("https://example.com/micropub");
  });

  it("discovers from a tag", () => {
    const html = '<a rel="micropub" href="/micropub">Micropub</a>';
    const result = discoverMicropubFromHtml(html, "https://example.com");
    expect(result).toBe("https://example.com/micropub");
  });

  it("resolves relative URL", () => {
    const html = '<link rel="micropub" href="/micropub">';
    const result = discoverMicropubFromHtml(html, "https://example.com");
    expect(result).toBe("https://example.com/micropub");
  });

  it("returns null when no micropub link found", () => {
    const html = '<link rel="stylesheet" href="/style.css">';
    expect(discoverMicropubFromHtml(html, "https://example.com")).toBeNull();
  });

  it("returns null for empty HTML", () => {
    expect(discoverMicropubFromHtml("", "https://example.com")).toBeNull();
  });

  it("handles rel with multiple values", () => {
    const html = '<link rel="micropub me" href="/micropub">';
    const result = discoverMicropubFromHtml(html, "https://example.com");
    expect(result).toBe("https://example.com/micropub");
  });

  it("finds micropub in full HTML document", () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="stylesheet" href="/style.css">
        <link rel="micropub" href="/micropub">
        <link rel="authorization_endpoint" href="/auth">
      </head>
      <body><p>Hello</p></body>
      </html>
    `;
    const result = discoverMicropubFromHtml(html, "https://example.com");
    expect(result).toBe("https://example.com/micropub");
  });
});
