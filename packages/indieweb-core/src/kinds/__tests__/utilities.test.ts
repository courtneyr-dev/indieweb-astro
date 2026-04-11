import { describe, it, expect } from "vitest";
import {
  getPostKind,
  getAllPostKinds,
  getAllSlugs,
  getKindsByMf2Property,
  getCitationKinds,
  isValidSlug,
  discoverPostType,
} from "../utilities.js";

describe("getPostKind", () => {
  it("returns the kind for a valid slug", () => {
    const note = getPostKind("note");
    expect(note).toBeDefined();
    expect(note?.slug).toBe("note");
    expect(note?.name).toBe("Note");
  });

  it("returns undefined for an invalid slug", () => {
    expect(getPostKind("nonexistent")).toBeUndefined();
  });

  it("returns tag-reply for hyphenated slug", () => {
    const tr = getPostKind("tag-reply");
    expect(tr).toBeDefined();
    expect(tr?.mf2Properties).toContain("u-tag-of");
  });
});

describe("getAllPostKinds", () => {
  it("returns all 27 kinds", () => {
    expect(getAllPostKinds()).toHaveLength(28);
  });

  it("returns objects with slug, name, and mf2Root", () => {
    for (const kind of getAllPostKinds()) {
      expect(kind.slug).toBeTruthy();
      expect(kind.name).toBeTruthy();
      expect(kind.mf2Root).toBeTruthy();
    }
  });
});

describe("getAllSlugs", () => {
  it("returns 27 slugs", () => {
    expect(getAllSlugs()).toHaveLength(28);
  });

  it("includes note, article, reply, bookmark", () => {
    const slugs = getAllSlugs();
    expect(slugs).toContain("note");
    expect(slugs).toContain("article");
    expect(slugs).toContain("reply");
    expect(slugs).toContain("bookmark");
  });
});

describe("getKindsByMf2Property", () => {
  it("finds reply and rsvp and tag-reply for u-in-reply-to", () => {
    const kinds = getKindsByMf2Property("u-in-reply-to");
    const slugs = kinds.map((k) => k.slug);
    expect(slugs).toContain("reply");
    expect(slugs).toContain("rsvp");
    expect(slugs).toContain("tag-reply");
  });

  it("finds only like for u-like-of", () => {
    const kinds = getKindsByMf2Property("u-like-of");
    expect(kinds).toHaveLength(1);
    expect(kinds[0].slug).toBe("like");
  });

  it("returns empty array for unrecognized property", () => {
    expect(getKindsByMf2Property("u-nonexistent")).toEqual([]);
  });
});

describe("getCitationKinds", () => {
  it("returns all kinds that require citations", () => {
    const kinds = getCitationKinds();
    const slugs = kinds.map((k) => k.slug);
    expect(slugs).toContain("reply");
    expect(slugs).toContain("like");
    expect(slugs).toContain("repost");
    expect(slugs).toContain("bookmark");
    expect(slugs).toContain("rsvp");
    expect(slugs).toContain("review");
    expect(slugs).toContain("tag-reply");
    expect(slugs).toContain("quotation");
  });

  it("does not include note or article", () => {
    const slugs = getCitationKinds().map((k) => k.slug);
    expect(slugs).not.toContain("note");
    expect(slugs).not.toContain("article");
  });
});

describe("isValidSlug", () => {
  it("returns true for valid slugs", () => {
    expect(isValidSlug("note")).toBe(true);
    expect(isValidSlug("bookmark")).toBe(true);
    expect(isValidSlug("tag-reply")).toBe(true);
  });

  it("returns false for invalid slugs", () => {
    expect(isValidSlug("invalid")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });
});

// ── Post Type Discovery Algorithm ────────────────────────────────────

describe("discoverPostType", () => {
  it("returns event for h-event items", () => {
    expect(
      discoverPostType({
        type: ["h-event"],
        properties: { name: ["Homebrew Website Club"] },
      }),
    ).toBe("event");
  });

  it("returns rsvp when p-rsvp is present", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          rsvp: ["yes"],
          "in-reply-to": ["https://example.com/event"],
        },
      }),
    ).toBe("rsvp");
  });

  it("returns repost for repost-of", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "repost-of": ["https://example.com/post"],
        },
      }),
    ).toBe("repost");
  });

  it("returns like for like-of", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "like-of": ["https://example.com/post"],
        },
      }),
    ).toBe("like");
  });

  it("returns bookmark for bookmark-of", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "bookmark-of": ["https://example.com/article"],
        },
      }),
    ).toBe("bookmark");
  });

  it("returns quotation for quotation-of", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "quotation-of": ["https://example.com/post"],
          content: ["A great excerpt from the post."],
        },
      }),
    ).toBe("quotation");
  });

  it("returns tag-reply when tag-of AND in-reply-to are present", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "tag-of": ["https://example.com/post"],
          "in-reply-to": ["https://example.com/post"],
        },
      }),
    ).toBe("tag-reply");
  });

  it("returns reply for in-reply-to (without tag-of)", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "in-reply-to": ["https://example.com/post"],
          content: ["Great post!"],
        },
      }),
    ).toBe("reply");
  });

  it("returns checkin for checkin property", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          checkin: ["https://example.com/venue"],
        },
      }),
    ).toBe("checkin");
  });

  it("returns listen for listen-of (scrobble)", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "listen-of": ["https://example.com/track"],
        },
      }),
    ).toBe("listen");
  });

  it("returns watch for watch-of", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "watch-of": ["https://example.com/movie"],
        },
      }),
    ).toBe("watch");
  });

  it("returns read for read-of", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "read-of": ["A Great Book"],
        },
      }),
    ).toBe("read");
  });

  it("returns video for video property", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          video: ["https://example.com/clip.mp4"],
        },
      }),
    ).toBe("video");
  });

  it("returns photo for photo property", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          photo: ["https://example.com/pic.jpg"],
        },
      }),
    ).toBe("photo");
  });

  it("returns audio for audio property", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          audio: ["https://example.com/song.mp3"],
        },
      }),
    ).toBe("audio");
  });

  it("returns note when content exists but no name", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          content: ["Just a short thought."],
        },
      }),
    ).toBe("note");
  });

  it("returns note when name is empty string", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          name: [""],
          content: ["Just a thought."],
        },
      }),
    ).toBe("note");
  });

  it("returns article when name is distinct from content", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          name: ["My Blog Post Title"],
          content: ["This is the body of my blog post with lots of detail."],
        },
      }),
    ).toBe("article");
  });

  it("returns note when name is a prefix of content", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          name: ["Short thought here"],
          content: ["Short thought here and nothing more"],
        },
      }),
    ).toBe("note");
  });

  it("handles mf2 content objects with html and value", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          name: ["My Article"],
          content: [
            { html: "<p>Full content here.</p>", value: "Full content here." },
          ],
        },
      }),
    ).toBe("article");
  });

  it("returns note for empty properties", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {},
      }),
    ).toBe("note");
  });

  // ── Priority order tests ───────────────────────────────────────────

  it("rsvp takes priority over reply (both have in-reply-to)", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          rsvp: ["yes"],
          "in-reply-to": ["https://example.com/event"],
          content: ["See you there!"],
        },
      }),
    ).toBe("rsvp");
  });

  it("repost takes priority over like", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "repost-of": ["https://example.com/post"],
          "like-of": ["https://example.com/post"],
        },
      }),
    ).toBe("repost");
  });

  it("like takes priority over reply", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "like-of": ["https://example.com/post"],
          "in-reply-to": ["https://example.com/post"],
        },
      }),
    ).toBe("like");
  });

  it("video takes priority over photo", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          video: ["https://example.com/vid.mp4"],
          photo: ["https://example.com/thumb.jpg"],
        },
      }),
    ).toBe("video");
  });

  it("accepts single strings (not just arrays)", () => {
    expect(
      discoverPostType({
        type: ["h-entry"],
        properties: {
          "like-of": "https://example.com/post",
        },
      }),
    ).toBe("like");
  });
});
