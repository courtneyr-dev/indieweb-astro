import { describe, it, expect } from "vitest";
import { POST_KINDS } from "../definitions.js";

describe("POST_KINDS", () => {
  it("defines 28 post kinds", () => {
    expect(Object.keys(POST_KINDS)).toHaveLength(28);
  });

  it("every kind has a slug matching its key", () => {
    for (const [key, kind] of Object.entries(POST_KINDS)) {
      expect(kind.slug).toBe(key);
    }
  });

  it("every kind has a non-empty name", () => {
    for (const kind of Object.values(POST_KINDS)) {
      expect(kind.name.length).toBeGreaterThan(0);
    }
  });

  it("every kind has a non-empty icon", () => {
    for (const kind of Object.values(POST_KINDS)) {
      expect(kind.icon.length).toBeGreaterThan(0);
    }
  });

  it("every kind has a valid mf2Root", () => {
    const validRoots = ["h-entry", "h-event", "h-review", "h-recipe"];
    for (const kind of Object.values(POST_KINDS)) {
      expect(validRoots).toContain(kind.mf2Root);
    }
  });

  it("every kind has at least one required field", () => {
    for (const kind of Object.values(POST_KINDS)) {
      expect(kind.requiredFields.length).toBeGreaterThan(0);
    }
  });

  // ── Specific kind validations ────────────────────────────────────

  describe("simple content kinds", () => {
    it("note requires content, uses h-entry, no citation", () => {
      const note = POST_KINDS.note;
      expect(note.mf2Root).toBe("h-entry");
      expect(note.requiredFields).toContain("content");
      expect(note.citationRequired).toBe(false);
      expect(note.mf2Properties).toEqual([]);
    });

    it("article requires name and content", () => {
      const article = POST_KINDS.article;
      expect(article.requiredFields).toContain("name");
      expect(article.requiredFields).toContain("content");
      expect(article.citationRequired).toBe(false);
    });

    it("photo uses u-photo property", () => {
      expect(POST_KINDS.photo.mf2Properties).toContain("u-photo");
      expect(POST_KINDS.photo.requiredFields).toContain("photo");
    });

    it("video uses u-video property", () => {
      expect(POST_KINDS.video.mf2Properties).toContain("u-video");
    });

    it("audio uses u-audio property", () => {
      expect(POST_KINDS.audio.mf2Properties).toContain("u-audio");
    });
  });

  describe("response kinds require citations", () => {
    const citationKinds = [
      "reply",
      "like",
      "repost",
      "bookmark",
      "rsvp",
      "review",
      "tag-reply",
      "quotation",
    ] as const;

    for (const slug of citationKinds) {
      it(`${slug} requires a citation`, () => {
        expect(POST_KINDS[slug].citationRequired).toBe(true);
      });
    }
  });

  describe("response mf2 property mappings", () => {
    it("reply uses u-in-reply-to", () => {
      expect(POST_KINDS.reply.mf2Properties).toContain("u-in-reply-to");
    });

    it("like uses u-like-of", () => {
      expect(POST_KINDS.like.mf2Properties).toContain("u-like-of");
    });

    it("repost uses u-repost-of", () => {
      expect(POST_KINDS.repost.mf2Properties).toContain("u-repost-of");
    });

    it("bookmark uses u-bookmark-of", () => {
      expect(POST_KINDS.bookmark.mf2Properties).toContain("u-bookmark-of");
    });

    it("rsvp uses both u-in-reply-to and p-rsvp", () => {
      expect(POST_KINDS.rsvp.mf2Properties).toContain("u-in-reply-to");
      expect(POST_KINDS.rsvp.mf2Properties).toContain("p-rsvp");
    });

    it("tag-reply uses u-tag-of and u-in-reply-to", () => {
      const tr = POST_KINDS["tag-reply"];
      expect(tr.mf2Properties).toContain("u-tag-of");
      expect(tr.mf2Properties).toContain("u-in-reply-to");
    });

    it("quotation uses u-quotation-of", () => {
      expect(POST_KINDS.quotation.mf2Properties).toContain("u-quotation-of");
    });
  });

  describe("life-logging kinds", () => {
    it("listen uses u-listen-of (scrobble)", () => {
      expect(POST_KINDS.listen.mf2Properties).toContain("u-listen-of");
    });

    it("watch uses u-watch-of", () => {
      expect(POST_KINDS.watch.mf2Properties).toContain("u-watch-of");
    });

    it("read uses p-read-of (per microformats spec)", () => {
      expect(POST_KINDS.read.mf2Properties).toContain("p-read-of");
    });

    it("checkin uses u-checkin", () => {
      expect(POST_KINDS.checkin.mf2Properties).toContain("u-checkin");
    });
  });

  describe("non-h-entry kinds", () => {
    it("event uses h-event with dt-start, dt-end, dt-duration, p-location", () => {
      const event = POST_KINDS.event;
      expect(event.mf2Root).toBe("h-event");
      expect(event.mf2Properties).toContain("dt-start");
      expect(event.mf2Properties).toContain("dt-end");
      expect(event.mf2Properties).toContain("dt-duration");
      expect(event.mf2Properties).toContain("p-location");
    });

    it("review uses h-review with p-rating, p-best, p-worst, p-item", () => {
      const review = POST_KINDS.review;
      expect(review.mf2Root).toBe("h-review");
      expect(review.mf2Properties).toContain("p-rating");
      expect(review.mf2Properties).toContain("p-best");
      expect(review.mf2Properties).toContain("p-worst");
      expect(review.mf2Properties).toContain("p-item");
    });

    it("recipe uses h-recipe with p-ingredient, p-yield, e-instructions, dt-duration", () => {
      const recipe = POST_KINDS.recipe;
      expect(recipe.mf2Root).toBe("h-recipe");
      expect(recipe.mf2Properties).toContain("p-ingredient");
      expect(recipe.mf2Properties).toContain("p-yield");
      expect(recipe.mf2Properties).toContain("e-instructions");
      expect(recipe.mf2Properties).toContain("dt-duration");
    });
  });

  describe("life-logging kinds do not require citations", () => {
    const nonCitationKinds = [
      "eat",
      "drink",
      "play",
      "listen",
      "watch",
      "read",
      "checkin",
      "jam",
      "mood",
      "wish",
      "favorite",
      "acquisition",
    ] as const;

    for (const slug of nonCitationKinds) {
      it(`${slug} does not require a citation`, () => {
        expect(POST_KINDS[slug].citationRequired).toBe(false);
      });
    }
  });
});
