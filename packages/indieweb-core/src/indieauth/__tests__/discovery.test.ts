import { describe, it, expect } from "vitest";
import {
  discoverEndpointsFromHeaders,
  discoverEndpointsFromHtml,
} from "../discovery.js";

describe("discoverEndpointsFromHeaders", () => {
  it("discovers indieauth-metadata from Link header", () => {
    const header =
      '<https://auth.example.com/.well-known/oauth-authorization-server>; rel="indieauth-metadata"';
    const result = discoverEndpointsFromHeaders(header, "https://example.com");
    expect(result.metadata_url).toBe(
      "https://auth.example.com/.well-known/oauth-authorization-server",
    );
  });

  it("discovers authorization_endpoint from Link header", () => {
    const header =
      '<https://auth.example.com/auth>; rel="authorization_endpoint"';
    const result = discoverEndpointsFromHeaders(header, "https://example.com");
    expect(result.authorization_endpoint).toBe("https://auth.example.com/auth");
  });

  it("discovers token_endpoint from Link header", () => {
    const header = '<https://auth.example.com/token>; rel="token_endpoint"';
    const result = discoverEndpointsFromHeaders(header, "https://example.com");
    expect(result.token_endpoint).toBe("https://auth.example.com/token");
  });

  it("discovers multiple endpoints from comma-separated Link header", () => {
    const header =
      '<https://auth.example.com/auth>; rel="authorization_endpoint", ' +
      '<https://auth.example.com/token>; rel="token_endpoint"';
    const result = discoverEndpointsFromHeaders(header, "https://example.com");
    expect(result.authorization_endpoint).toBe("https://auth.example.com/auth");
    expect(result.token_endpoint).toBe("https://auth.example.com/token");
  });

  it("handles rel with multiple values", () => {
    const header =
      '<https://auth.example.com/auth>; rel="authorization_endpoint openid"';
    const result = discoverEndpointsFromHeaders(header, "https://example.com");
    expect(result.authorization_endpoint).toBe("https://auth.example.com/auth");
  });

  it("resolves relative URLs against base", () => {
    const header = '</auth>; rel="authorization_endpoint"';
    const result = discoverEndpointsFromHeaders(header, "https://example.com");
    expect(result.authorization_endpoint).toBe("https://example.com/auth");
  });

  it("returns empty object for no matches", () => {
    const header = '<https://example.com/style.css>; rel="stylesheet"';
    const result = discoverEndpointsFromHeaders(header, "https://example.com");
    expect(result.metadata_url).toBeUndefined();
    expect(result.authorization_endpoint).toBeUndefined();
    expect(result.token_endpoint).toBeUndefined();
  });

  it("handles empty Link header", () => {
    const result = discoverEndpointsFromHeaders("", "https://example.com");
    expect(result.metadata_url).toBeUndefined();
  });
});

describe("discoverEndpointsFromHtml", () => {
  it("discovers authorization_endpoint from link tag", () => {
    const html =
      '<link rel="authorization_endpoint" href="https://auth.example.com/auth">';
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.authorization_endpoint).toBe("https://auth.example.com/auth");
  });

  it("discovers token_endpoint from link tag", () => {
    const html =
      '<link rel="token_endpoint" href="https://auth.example.com/token">';
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.token_endpoint).toBe("https://auth.example.com/token");
  });

  it("discovers indieauth-metadata from link tag", () => {
    const html =
      '<link rel="indieauth-metadata" href="https://auth.example.com/.well-known/oauth-authorization-server">';
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.metadata_url).toBe(
      "https://auth.example.com/.well-known/oauth-authorization-server",
    );
  });

  it("discovers endpoints from a tag", () => {
    const html = '<a rel="authorization_endpoint" href="/auth">Login</a>';
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.authorization_endpoint).toBe("https://example.com/auth");
  });

  it("resolves relative URLs", () => {
    const html = '<link rel="token_endpoint" href="/token">';
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.token_endpoint).toBe("https://example.com/token");
  });

  it("handles multiple endpoints in HTML", () => {
    const html = `
      <head>
        <link rel="authorization_endpoint" href="/auth">
        <link rel="token_endpoint" href="/token">
        <link rel="indieauth-metadata" href="/.well-known/oauth-authorization-server">
      </head>
    `;
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.authorization_endpoint).toBe("https://example.com/auth");
    expect(result.token_endpoint).toBe("https://example.com/token");
    expect(result.metadata_url).toBe(
      "https://example.com/.well-known/oauth-authorization-server",
    );
  });

  it("uses first occurrence of each endpoint", () => {
    const html = `
      <link rel="authorization_endpoint" href="/auth1">
      <link rel="authorization_endpoint" href="/auth2">
    `;
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.authorization_endpoint).toBe("https://example.com/auth1");
  });

  it("handles rel with multiple values in HTML", () => {
    const html = '<link rel="authorization_endpoint openid" href="/auth">';
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.authorization_endpoint).toBe("https://example.com/auth");
  });

  it("ignores tags without href", () => {
    const html = '<link rel="authorization_endpoint">';
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.authorization_endpoint).toBeUndefined();
  });

  it("ignores tags without rel", () => {
    const html = '<link href="/auth">';
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.authorization_endpoint).toBeUndefined();
  });

  it("returns empty for HTML with no relevant links", () => {
    const html = '<link rel="stylesheet" href="/style.css">';
    const result = discoverEndpointsFromHtml(html, "https://example.com");
    expect(result.authorization_endpoint).toBeUndefined();
    expect(result.token_endpoint).toBeUndefined();
    expect(result.metadata_url).toBeUndefined();
  });
});
