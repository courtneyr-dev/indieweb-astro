import { describe, it, expect } from "vitest";
import {
  detectDisplayType,
  extractRsvpValue,
  extractAuthor,
  extractContent,
} from "../display.js";
import type { SourceMf2Entry } from "../display.js";

const TARGET = "https://bob.example/post/2";

describe("detectDisplayType", () => {
  it("detects like", () => {
    const entry: SourceMf2Entry = { "like-of": [TARGET] };
    expect(detectDisplayType(entry, TARGET)).toBe("like");
  });

  it("detects reply", () => {
    const entry: SourceMf2Entry = { "in-reply-to": [TARGET] };
    expect(detectDisplayType(entry, TARGET)).toBe("reply");
  });

  it("detects repost", () => {
    const entry: SourceMf2Entry = { "repost-of": [TARGET] };
    expect(detectDisplayType(entry, TARGET)).toBe("repost");
  });

  it("detects bookmark", () => {
    const entry: SourceMf2Entry = { "bookmark-of": [TARGET] };
    expect(detectDisplayType(entry, TARGET)).toBe("bookmark");
  });

  it("detects tag", () => {
    const entry: SourceMf2Entry = { "tag-of": [TARGET] };
    expect(detectDisplayType(entry, TARGET)).toBe("tag");
  });

  it("detects rsvp", () => {
    const entry: SourceMf2Entry = {
      rsvp: ["yes"],
      "in-reply-to": [TARGET],
    };
    expect(detectDisplayType(entry, TARGET)).toBe("rsvp");
  });

  it("defaults to mention when no interaction properties", () => {
    const entry: SourceMf2Entry = {
      content: ["Great post!"],
    };
    expect(detectDisplayType(entry, TARGET)).toBe("mention");
  });

  it("defaults to mention when properties target a different URL", () => {
    const entry: SourceMf2Entry = {
      "like-of": ["https://other.example/post"],
    };
    expect(detectDisplayType(entry, TARGET)).toBe("mention");
  });

  it("rsvp takes priority over reply", () => {
    const entry: SourceMf2Entry = {
      rsvp: ["maybe"],
      "in-reply-to": [TARGET],
    };
    expect(detectDisplayType(entry, TARGET)).toBe("rsvp");
  });

  it("repost takes priority over like", () => {
    const entry: SourceMf2Entry = {
      "repost-of": [TARGET],
      "like-of": [TARGET],
    };
    expect(detectDisplayType(entry, TARGET)).toBe("repost");
  });

  it("like takes priority over bookmark", () => {
    const entry: SourceMf2Entry = {
      "like-of": [TARGET],
      "bookmark-of": [TARGET],
    };
    expect(detectDisplayType(entry, TARGET)).toBe("like");
  });

  it("bookmark takes priority over reply", () => {
    const entry: SourceMf2Entry = {
      "bookmark-of": [TARGET],
      "in-reply-to": [TARGET],
    };
    expect(detectDisplayType(entry, TARGET)).toBe("bookmark");
  });

  it("handles target with fragment — strips before matching", () => {
    const entry: SourceMf2Entry = { "like-of": [TARGET] };
    expect(detectDisplayType(entry, TARGET + "#section")).toBe("like");
  });

  it("matches when property has multiple URLs including target", () => {
    const entry: SourceMf2Entry = {
      "in-reply-to": ["https://other.example/post", TARGET],
    };
    expect(detectDisplayType(entry, TARGET)).toBe("reply");
  });

  it("returns mention for empty entry", () => {
    const entry: SourceMf2Entry = {};
    expect(detectDisplayType(entry, TARGET)).toBe("mention");
  });
});

describe("extractRsvpValue", () => {
  it("extracts yes", () => {
    expect(extractRsvpValue({ rsvp: ["yes"] })).toBe("yes");
  });

  it("extracts no", () => {
    expect(extractRsvpValue({ rsvp: ["no"] })).toBe("no");
  });

  it("extracts maybe", () => {
    expect(extractRsvpValue({ rsvp: ["maybe"] })).toBe("maybe");
  });

  it("extracts interested", () => {
    expect(extractRsvpValue({ rsvp: ["interested"] })).toBe("interested");
  });

  it("is case-insensitive", () => {
    expect(extractRsvpValue({ rsvp: ["YES"] })).toBe("yes");
  });

  it("returns undefined for unknown value", () => {
    expect(extractRsvpValue({ rsvp: ["unknown"] })).toBeUndefined();
  });

  it("returns undefined for empty array", () => {
    expect(extractRsvpValue({ rsvp: [] })).toBeUndefined();
  });

  it("returns undefined when no rsvp property", () => {
    expect(extractRsvpValue({})).toBeUndefined();
  });
});

describe("extractAuthor", () => {
  it("extracts string author as name", () => {
    const author = extractAuthor({ author: ["Alice"] });
    expect(author).toEqual({ name: "Alice" });
  });

  it("extracts object author", () => {
    const author = extractAuthor({
      author: [
        {
          name: "Alice",
          url: "https://alice.example",
          photo: "https://alice.example/photo.jpg",
        },
      ],
    });
    expect(author).toEqual({
      name: "Alice",
      url: "https://alice.example",
      photo: "https://alice.example/photo.jpg",
    });
  });

  it("returns first author when multiple", () => {
    const author = extractAuthor({
      author: ["Alice", "Bob"],
    });
    expect(author).toEqual({ name: "Alice" });
  });

  it("returns undefined for empty array", () => {
    expect(extractAuthor({ author: [] })).toBeUndefined();
  });

  it("returns undefined when no author property", () => {
    expect(extractAuthor({})).toBeUndefined();
  });
});

describe("extractContent", () => {
  it("extracts string content", () => {
    expect(extractContent({ content: ["Great post!"] })).toBe("Great post!");
  });

  it("extracts plain text value from object", () => {
    const content = extractContent({
      content: [{ html: "<p>Great post!</p>", value: "Great post!" }],
    });
    expect(content).toBe("Great post!");
  });

  it("falls back to html when no value", () => {
    const content = extractContent({
      content: [{ html: "<p>Great post!</p>" }],
    });
    expect(content).toBe("<p>Great post!</p>");
  });

  it("returns undefined for empty array", () => {
    expect(extractContent({ content: [] })).toBeUndefined();
  });

  it("returns undefined when no content property", () => {
    expect(extractContent({})).toBeUndefined();
  });
});
