import { describe, it, expect } from "vitest";
import { extractLinkedUrls } from "../sender.js";

const BASE = "https://mysite.com/post/1";

describe("extractLinkedUrls", () => {
  it("extracts href URLs", () => {
    const html = '<a href="https://example.com">Link</a>';
    expect(extractLinkedUrls(html, BASE)).toEqual(["https://example.com/"]);
  });

  it("extracts src URLs", () => {
    const html = '<img src="https://example.com/img.jpg" />';
    expect(extractLinkedUrls(html, BASE)).toEqual([
      "https://example.com/img.jpg",
    ]);
  });

  it("resolves relative URLs", () => {
    const html = '<a href="/about">About</a>';
    expect(extractLinkedUrls(html, BASE)).toEqual(["https://mysite.com/about"]);
  });

  it("deduplicates URLs", () => {
    const html = `
      <a href="https://example.com">Link 1</a>
      <a href="https://example.com">Link 2</a>
    `;
    expect(extractLinkedUrls(html, BASE)).toEqual(["https://example.com/"]);
  });

  it("skips mailto URLs", () => {
    const html = '<a href="mailto:test@example.com">Email</a>';
    expect(extractLinkedUrls(html, BASE)).toEqual([]);
  });

  it("skips tel URLs", () => {
    const html = '<a href="tel:+1234567890">Call</a>';
    expect(extractLinkedUrls(html, BASE)).toEqual([]);
  });

  it("skips javascript URLs", () => {
    const html = '<a href="javascript:void(0)">Click</a>';
    expect(extractLinkedUrls(html, BASE)).toEqual([]);
  });

  it("handles multiple different URLs", () => {
    const html = `
      <a href="https://alice.example">Alice</a>
      <a href="https://bob.example">Bob</a>
      <img src="https://cdn.example/img.jpg" />
    `;
    const urls = extractLinkedUrls(html, BASE);
    expect(urls).toHaveLength(3);
    expect(urls).toContain("https://alice.example/");
    expect(urls).toContain("https://bob.example/");
    expect(urls).toContain("https://cdn.example/img.jpg");
  });

  it("returns empty array for HTML with no links", () => {
    const html = "<p>Hello world</p>";
    expect(extractLinkedUrls(html, BASE)).toEqual([]);
  });

  it("handles both http and https URLs", () => {
    const html = `
      <a href="http://example.com">HTTP</a>
      <a href="https://example.com">HTTPS</a>
    `;
    const urls = extractLinkedUrls(html, BASE);
    expect(urls).toContain("http://example.com/");
    expect(urls).toContain("https://example.com/");
  });

  it("handles single-quoted attributes", () => {
    const html = "<a href='https://example.com'>Link</a>";
    expect(extractLinkedUrls(html, BASE)).toEqual(["https://example.com/"]);
  });
});
