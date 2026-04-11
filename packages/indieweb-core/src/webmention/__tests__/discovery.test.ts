import { describe, it, expect } from "vitest";
import {
  discoverEndpointFromHeaders,
  discoverEndpointFromHtml,
} from "../discovery.js";

const BASE = "https://example.com/post/1";

describe("discoverEndpointFromHeaders", () => {
  it("returns none for null header", () => {
    const result = discoverEndpointFromHeaders(null, BASE);
    expect(result).toEqual({ endpoint: null, method: "none" });
  });

  it("returns none for empty header", () => {
    const result = discoverEndpointFromHeaders("", BASE);
    expect(result).toEqual({ endpoint: null, method: "none" });
  });

  it("discovers endpoint from Link header with double quotes", () => {
    const header = '<https://example.com/webmention>; rel="webmention"';
    const result = discoverEndpointFromHeaders(header, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "link-header",
    });
  });

  it("discovers endpoint from relative URL", () => {
    const header = '</webmention>; rel="webmention"';
    const result = discoverEndpointFromHeaders(header, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "link-header",
    });
  });

  it("discovers endpoint when rel has multiple values", () => {
    const header = '</webmention>; rel="webmention http://example.com/other"';
    const result = discoverEndpointFromHeaders(header, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "link-header",
    });
  });

  it("discovers endpoint when webmention is not first rel value", () => {
    const header = '</wm>; rel="other webmention"';
    const result = discoverEndpointFromHeaders(header, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/wm",
      method: "link-header",
    });
  });

  it("ignores Link header without webmention rel", () => {
    const header = '</style.css>; rel="stylesheet"';
    const result = discoverEndpointFromHeaders(header, BASE);
    expect(result).toEqual({ endpoint: null, method: "none" });
  });

  it("handles multiple Link entries, finds webmention", () => {
    const header =
      '</style.css>; rel="stylesheet">, </webmention>; rel="webmention"';
    const result = discoverEndpointFromHeaders(header, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "link-header",
    });
  });

  it("handles absolute external endpoint URL", () => {
    const header =
      '<https://webmention.io/example.com/webmention>; rel="webmention"';
    const result = discoverEndpointFromHeaders(header, BASE);
    expect(result).toEqual({
      endpoint: "https://webmention.io/example.com/webmention",
      method: "link-header",
    });
  });

  it("preserves query string parameters in endpoint", () => {
    const header = '</webmention?token=abc123>; rel="webmention"';
    const result = discoverEndpointFromHeaders(header, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention?token=abc123",
      method: "link-header",
    });
  });

  it("is case-insensitive for rel value", () => {
    const header = '</webmention>; rel="Webmention"';
    const result = discoverEndpointFromHeaders(header, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "link-header",
    });
  });
});

describe("discoverEndpointFromHtml", () => {
  it("returns none for empty HTML", () => {
    const result = discoverEndpointFromHtml("", BASE);
    expect(result).toEqual({ endpoint: null, method: "none" });
  });

  it("returns none for HTML without webmention link", () => {
    const html =
      '<html><head><link rel="stylesheet" href="/style.css"></head></html>';
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({ endpoint: null, method: "none" });
  });

  it("discovers endpoint from <link> tag", () => {
    const html = '<link rel="webmention" href="/webmention" />';
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "html-link",
    });
  });

  it("discovers endpoint from <link> with absolute URL", () => {
    const html = '<link rel="webmention" href="https://wm.example/endpoint" />';
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({
      endpoint: "https://wm.example/endpoint",
      method: "html-link",
    });
  });

  it("discovers endpoint from <a> tag", () => {
    const html = '<a rel="webmention" href="/webmention">webmention</a>';
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "html-a",
    });
  });

  it("prefers <link> over <a>", () => {
    const html = `
      <a rel="webmention" href="/wm-a">wm</a>
      <link rel="webmention" href="/wm-link" />
    `;
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/wm-link",
      method: "html-link",
    });
  });

  it("handles rel with multiple values", () => {
    const html = '<link rel="webmention pingback" href="/webmention" />';
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "html-link",
    });
  });

  it("handles single-quoted attributes", () => {
    const html = "<link rel='webmention' href='/webmention' />";
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "html-link",
    });
  });

  it("handles attributes in reverse order (href before rel)", () => {
    const html = '<link href="/webmention" rel="webmention" />';
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "html-link",
    });
  });

  it("preserves query parameters", () => {
    const html = '<link rel="webmention" href="/webmention?csrf=xyz" />';
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention?csrf=xyz",
      method: "html-link",
    });
  });

  it("ignores link tags with wrong rel", () => {
    const html = `
      <link rel="pingback" href="/pingback" />
      <link rel="authorization_endpoint" href="/auth" />
    `;
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({ endpoint: null, method: "none" });
  });

  it("handles webmention.io endpoint", () => {
    const html =
      '<link rel="webmention" href="https://webmention.io/example.com/webmention" />';
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({
      endpoint: "https://webmention.io/example.com/webmention",
      method: "html-link",
    });
  });

  it("handles full HTML document", () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Test</title>
        <link rel="stylesheet" href="/style.css">
        <link rel="webmention" href="/webmention">
        <link rel="authorization_endpoint" href="/auth">
      </head>
      <body>
        <h1>Hello</h1>
      </body>
      </html>
    `;
    const result = discoverEndpointFromHtml(html, BASE);
    expect(result).toEqual({
      endpoint: "https://example.com/webmention",
      method: "html-link",
    });
  });
});
