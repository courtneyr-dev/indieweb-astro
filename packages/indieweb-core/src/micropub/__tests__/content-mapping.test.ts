import { describe, it, expect } from "vitest";
import {
  mapMicropubToPostFields,
  textToPortableText,
} from "../content-mapping.js";
import type { MicropubCreateRequest } from "../types.js";

function createRequest(
  properties: MicropubCreateRequest["properties"],
): MicropubCreateRequest {
  return { type: ["h-entry"], properties };
}

describe("textToPortableText", () => {
  it("creates one block per paragraph", () => {
    const blocks = textToPortableText("First paragraph\n\nSecond paragraph");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].children[0].text).toBe("First paragraph");
    expect(blocks[1].children[0].text).toBe("Second paragraph");
  });

  it("produces valid block shape", () => {
    const [block] = textToPortableText("Hello");
    expect(block._type).toBe("block");
    expect(block.style).toBe("normal");
    expect(block._key).toBeTruthy();
    expect(block.children[0]._type).toBe("span");
    expect(block.children[0].marks).toEqual([]);
    expect(block.markDefs).toEqual([]);
  });

  it("handles single-paragraph text", () => {
    const blocks = textToPortableText("Just one line");
    expect(blocks).toHaveLength(1);
  });
});

describe("mapMicropubToPostFields", () => {
  it("maps a simple note", () => {
    const mapped = mapMicropubToPostFields(
      createRequest({ content: ["Hello world"] }),
    );
    expect(mapped.fields.title).toBeUndefined();
    expect(Array.isArray(mapped.fields.content)).toBe(true);
    expect(mapped.status).toBe("published");
    expect(mapped.slug).toMatch(/^hello-world-\d{14}$/);
  });

  it("maps an article with a title and no explicit slug", () => {
    const mapped = mapMicropubToPostFields(
      createRequest({
        name: ["My Article"],
        content: ["Body text"],
      }),
    );
    expect(mapped.fields.title).toBe("My Article");
    // Slug derivation from title is left to the CMS.
    expect(mapped.slug).toBeUndefined();
  });

  it("respects mp-slug", () => {
    const mapped = mapMicropubToPostFields(
      createRequest({
        content: ["Hi"],
        "mp-slug": ["custom-slug"],
      }),
    );
    expect(mapped.slug).toBe("custom-slug");
  });

  it("maps citation properties to snake_case fields", () => {
    const mapped = mapMicropubToPostFields(
      createRequest({
        content: ["Replying"],
        "in-reply-to": ["https://example.com/post/1"],
        "like-of": ["https://example.com/post/2"],
        "repost-of": ["https://example.com/post/3"],
        "bookmark-of": ["https://example.com/post/4"],
      }),
    );
    expect(mapped.fields.in_reply_to).toBe("https://example.com/post/1");
    expect(mapped.fields.like_of).toBe("https://example.com/post/2");
    expect(mapped.fields.repost_of).toBe("https://example.com/post/3");
    expect(mapped.fields.bookmark_of).toBe("https://example.com/post/4");
  });

  it("strips HTML tags from html content", () => {
    const mapped = mapMicropubToPostFields(
      createRequest({ content: [{ html: "<p>Hello <b>world</b></p>" }] }),
    );
    const blocks = mapped.fields.content as Array<{
      children: Array<{ text: string }>;
    }>;
    expect(blocks[0].children[0].text).toBe("Hello world");
  });

  it("maps post-status draft", () => {
    const mapped = mapMicropubToPostFields(
      createRequest({
        content: ["Draft note"],
        "post-status": ["draft"],
      }),
    );
    expect(mapped.status).toBe("draft");
  });

  it("collects categories and syndication targets", () => {
    const mapped = mapMicropubToPostFields(
      createRequest({
        content: ["Tagged"],
        category: ["indieweb", "micropub"],
        "mp-syndicate-to": ["https://brid.gy/publish/mastodon"],
      }),
    );
    expect(mapped.categories).toEqual(["indieweb", "micropub"]);
    expect(mapped.syndicateTo).toEqual(["https://brid.gy/publish/mastodon"]);
    expect(mapped.fields.syndication).toEqual({
      targets: ["https://brid.gy/publish/mastodon"],
      links: [],
    });
  });

  it("stores photos and location in kind_meta", () => {
    const mapped = mapMicropubToPostFields(
      createRequest({
        content: ["Photo post"],
        photo: [
          "https://example.com/1.jpg",
          { value: "https://example.com/2.jpg", alt: "Second" },
        ],
        location: ["geo:37.7,-122.4"],
      }),
    );
    const meta = mapped.fields.kind_meta as Record<string, unknown>;
    expect(meta.photos).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
    expect(meta.location).toBe("geo:37.7,-122.4");
  });

  it("maps summary to excerpt", () => {
    const mapped = mapMicropubToPostFields(
      createRequest({
        name: ["Post"],
        content: ["Body"],
        summary: ["A short summary"],
      }),
    );
    expect(mapped.fields.excerpt).toBe("A short summary");
  });

  it("records existing syndication links", () => {
    const mapped = mapMicropubToPostFields(
      createRequest({
        content: ["Already syndicated"],
        syndication: ["https://mastodon.social/@me/99"],
      }),
    );
    expect(mapped.fields.syndication).toEqual({
      targets: [],
      links: [{ url: "https://mastodon.social/@me/99" }],
    });
  });
});
