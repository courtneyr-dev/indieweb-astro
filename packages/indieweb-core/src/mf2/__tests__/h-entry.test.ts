import { describe, it, expect } from "vitest";
import { buildHEntry } from "../h-entry.js";

describe("buildHEntry", () => {
  it("returns h-entry as rootClassName", () => {
    const result = buildHEntry({});
    expect(result.rootClassName).toBe("h-entry");
  });

  it("maps name to p-name", () => {
    const result = buildHEntry({ name: "Hello World" });
    expect(result.properties.name).toEqual({
      className: "p-name",
      value: "Hello World",
    });
  });

  it("maps summary to p-summary", () => {
    const result = buildHEntry({ summary: "A short summary" });
    expect(result.properties.summary).toEqual({
      className: "p-summary",
      value: "A short summary",
    });
  });

  it("maps content to e-content with html attribute", () => {
    const result = buildHEntry({ content: "<p>Hello</p>" });
    expect(result.properties.content).toEqual({
      className: "e-content",
      value: "<p>Hello</p>",
      attributes: { html: "<p>Hello</p>" },
    });
  });

  it("uses contentValue as the plain-text value when provided", () => {
    const result = buildHEntry({
      content: "<p>Hello</p>",
      contentValue: "Hello",
    });
    expect(result.properties.content?.value).toBe("Hello");
    expect(result.properties.content?.attributes?.html).toBe("<p>Hello</p>");
  });

  it("maps published to dt-published with datetime attribute", () => {
    const result = buildHEntry({ published: "2026-04-10T12:00:00Z" });
    expect(result.properties.published).toEqual({
      className: "dt-published",
      value: "2026-04-10T12:00:00Z",
      attributes: { datetime: "2026-04-10T12:00:00Z" },
    });
  });

  it("maps updated to dt-updated with datetime attribute", () => {
    const result = buildHEntry({ updated: "2026-04-11T08:00:00Z" });
    expect(result.properties.updated).toEqual({
      className: "dt-updated",
      value: "2026-04-11T08:00:00Z",
      attributes: { datetime: "2026-04-11T08:00:00Z" },
    });
  });

  it("maps author URL to p-author with href", () => {
    const result = buildHEntry({ author: "https://courtneyr.dev" });
    expect(result.properties.author).toEqual({
      className: "p-author",
      value: "https://courtneyr.dev",
      attributes: { href: "https://courtneyr.dev" },
    });
  });

  it("maps author name to p-author without href", () => {
    const result = buildHEntry({ author: "Courtney Robertson" });
    expect(result.properties.author).toEqual({
      className: "p-author",
      value: "Courtney Robertson",
    });
  });

  it("maps url to u-url with href", () => {
    const result = buildHEntry({ url: "https://example.com/post" });
    expect(result.properties.url).toEqual({
      className: "u-url",
      value: "https://example.com/post",
      attributes: { href: "https://example.com/post" },
    });
  });

  it("maps uid to u-uid with href", () => {
    const result = buildHEntry({ uid: "https://example.com/post" });
    expect(result.properties.uid).toEqual({
      className: "u-uid",
      value: "https://example.com/post",
      attributes: { href: "https://example.com/post" },
    });
  });

  it("maps categories to p-category array", () => {
    const result = buildHEntry({ category: ["indieweb", "astro"] });
    expect(result.properties.category).toEqual([
      { className: "p-category", value: "indieweb" },
      { className: "p-category", value: "astro" },
    ]);
  });

  it("omits category when array is empty", () => {
    const result = buildHEntry({ category: [] });
    expect(result.properties.category).toBeUndefined();
  });

  it("maps syndication to u-syndication array with hrefs", () => {
    const urls = [
      "https://twitter.com/x/123",
      "https://mastodon.social/@x/456",
    ];
    const result = buildHEntry({ syndication: urls });
    expect(result.properties.syndication).toEqual([
      {
        className: "u-syndication",
        value: "https://twitter.com/x/123",
        attributes: { href: "https://twitter.com/x/123" },
      },
      {
        className: "u-syndication",
        value: "https://mastodon.social/@x/456",
        attributes: { href: "https://mastodon.social/@x/456" },
      },
    ]);
  });

  it("maps inReplyTo to u-in-reply-to with href", () => {
    const result = buildHEntry({ inReplyTo: "https://example.com/original" });
    expect(result.properties.inReplyTo).toEqual({
      className: "u-in-reply-to",
      value: "https://example.com/original",
      attributes: { href: "https://example.com/original" },
    });
  });

  it("maps likeOf to u-like-of with href", () => {
    const result = buildHEntry({ likeOf: "https://example.com/liked" });
    expect(result.properties.likeOf).toEqual({
      className: "u-like-of",
      value: "https://example.com/liked",
      attributes: { href: "https://example.com/liked" },
    });
  });

  it("maps bookmarkOf to u-bookmark-of with href", () => {
    const result = buildHEntry({ bookmarkOf: "https://example.com/saved" });
    expect(result.properties.bookmarkOf).toEqual({
      className: "u-bookmark-of",
      value: "https://example.com/saved",
      attributes: { href: "https://example.com/saved" },
    });
  });

  it("maps repostOf to u-repost-of with href", () => {
    const result = buildHEntry({ repostOf: "https://example.com/boosted" });
    expect(result.properties.repostOf).toEqual({
      className: "u-repost-of",
      value: "https://example.com/boosted",
      attributes: { href: "https://example.com/boosted" },
    });
  });

  it("maps rsvp to p-rsvp", () => {
    const result = buildHEntry({ rsvp: "yes" });
    expect(result.properties.rsvp).toEqual({
      className: "p-rsvp",
      value: "yes",
    });
  });

  it("maps a single photo string to u-photo array with src", () => {
    const result = buildHEntry({ photo: "https://example.com/pic.jpg" });
    expect(result.properties.photo).toEqual([
      {
        className: "u-photo",
        value: "https://example.com/pic.jpg",
        attributes: { src: "https://example.com/pic.jpg" },
      },
    ]);
  });

  it("maps multiple photos to u-photo array", () => {
    const photos = ["https://example.com/a.jpg", "https://example.com/b.jpg"];
    const result = buildHEntry({ photo: photos });
    expect(result.properties.photo).toHaveLength(2);
    expect(result.properties.photo?.[0].className).toBe("u-photo");
    expect(result.properties.photo?.[1].attributes?.src).toBe(
      "https://example.com/b.jpg",
    );
  });

  it("maps video to u-video array with src", () => {
    const result = buildHEntry({ video: "https://example.com/vid.mp4" });
    expect(result.properties.video).toEqual([
      {
        className: "u-video",
        value: "https://example.com/vid.mp4",
        attributes: { src: "https://example.com/vid.mp4" },
      },
    ]);
  });

  it("omits undefined properties from output", () => {
    const result = buildHEntry({ name: "Only a title" });
    expect(result.properties.content).toBeUndefined();
    expect(result.properties.published).toBeUndefined();
    expect(result.properties.syndication).toBeUndefined();
    expect(result.properties.inReplyTo).toBeUndefined();
  });

  it("handles a full entry with all fields", () => {
    const result = buildHEntry({
      name: "Full Post",
      summary: "A complete test",
      content: "<p>Everything</p>",
      published: "2026-01-01T00:00:00Z",
      updated: "2026-01-02T00:00:00Z",
      author: "https://example.com",
      url: "https://example.com/full",
      uid: "https://example.com/full",
      category: ["test"],
      syndication: ["https://twitter.com/x/1"],
      inReplyTo: "https://example.com/parent",
      likeOf: "https://example.com/liked",
      bookmarkOf: "https://example.com/saved",
      repostOf: "https://example.com/original",
      rsvp: "maybe",
      photo: "https://example.com/photo.jpg",
      video: "https://example.com/video.mp4",
    });

    expect(result.rootClassName).toBe("h-entry");
    expect(Object.keys(result.properties)).toHaveLength(17);
  });
});
