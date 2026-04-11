import { describe, it, expect } from "vitest";
import {
  XFN_VALUES,
  XFN_CATEGORIES,
  EXCLUSIVITY_GROUPS,
} from "../vocabulary.js";
import { validateXfnRelationships, isValidXfnValue } from "../validator.js";
import {
  buildRelAttribute,
  parseRelAttribute,
  extractXfnLinks,
} from "../builder.js";

// ── Vocabulary ───────────────────────────────────────────────────────

describe("XFN_VALUES", () => {
  it("contains 18 values", () => {
    expect(XFN_VALUES).toHaveLength(18);
  });

  it("includes all friendship values", () => {
    expect(XFN_VALUES).toContain("contact");
    expect(XFN_VALUES).toContain("acquaintance");
    expect(XFN_VALUES).toContain("friend");
  });

  it("includes met", () => {
    expect(XFN_VALUES).toContain("met");
  });

  it("includes professional values", () => {
    expect(XFN_VALUES).toContain("co-worker");
    expect(XFN_VALUES).toContain("colleague");
  });

  it("includes geographical values", () => {
    expect(XFN_VALUES).toContain("co-resident");
    expect(XFN_VALUES).toContain("neighbor");
  });

  it("includes all family values", () => {
    expect(XFN_VALUES).toContain("child");
    expect(XFN_VALUES).toContain("parent");
    expect(XFN_VALUES).toContain("sibling");
    expect(XFN_VALUES).toContain("spouse");
    expect(XFN_VALUES).toContain("kin");
  });

  it("includes all romantic values", () => {
    expect(XFN_VALUES).toContain("muse");
    expect(XFN_VALUES).toContain("crush");
    expect(XFN_VALUES).toContain("date");
    expect(XFN_VALUES).toContain("sweetheart");
  });

  it("includes me", () => {
    expect(XFN_VALUES).toContain("me");
  });
});

describe("XFN_CATEGORIES", () => {
  it("defines 7 categories", () => {
    expect(XFN_CATEGORIES).toHaveLength(7);
  });

  it("has correct slugs", () => {
    const slugs = XFN_CATEGORIES.map((c) => c.slug);
    expect(slugs).toEqual([
      "friendship",
      "physical",
      "professional",
      "geographical",
      "family",
      "romantic",
      "identity",
    ]);
  });

  it("marks exclusive categories as radio", () => {
    const friendship = XFN_CATEGORIES.find((c) => c.slug === "friendship");
    expect(friendship?.selectionType).toBe("radio");

    const geographical = XFN_CATEGORIES.find((c) => c.slug === "geographical");
    expect(geographical?.selectionType).toBe("radio");

    const family = XFN_CATEGORIES.find((c) => c.slug === "family");
    expect(family?.selectionType).toBe("radio");
  });

  it("marks non-exclusive categories as checkbox", () => {
    const physical = XFN_CATEGORIES.find((c) => c.slug === "physical");
    expect(physical?.selectionType).toBe("checkbox");

    const professional = XFN_CATEGORIES.find((c) => c.slug === "professional");
    expect(professional?.selectionType).toBe("checkbox");

    const romantic = XFN_CATEGORIES.find((c) => c.slug === "romantic");
    expect(romantic?.selectionType).toBe("checkbox");
  });

  it("every value has a label and description", () => {
    for (const category of XFN_CATEGORIES) {
      for (const val of category.values) {
        expect(val.label.length).toBeGreaterThan(0);
        expect(val.description.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("EXCLUSIVITY_GROUPS", () => {
  it("defines 3 exclusive groups", () => {
    expect(Object.keys(EXCLUSIVITY_GROUPS)).toHaveLength(3);
  });

  it("friendship group has contact, acquaintance, friend", () => {
    expect(EXCLUSIVITY_GROUPS.friendship).toEqual([
      "contact",
      "acquaintance",
      "friend",
    ]);
  });

  it("geographical group has co-resident, neighbor", () => {
    expect(EXCLUSIVITY_GROUPS.geographical).toEqual([
      "co-resident",
      "neighbor",
    ]);
  });

  it("family group has child, parent, sibling, spouse, kin", () => {
    expect(EXCLUSIVITY_GROUPS.family).toEqual([
      "child",
      "parent",
      "sibling",
      "spouse",
      "kin",
    ]);
  });
});

// ── Validator ────────────────────────────────────────────────────────

describe("validateXfnRelationships", () => {
  it("accepts empty array", () => {
    const result = validateXfnRelationships([]);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("accepts valid single value", () => {
    expect(validateXfnRelationships(["friend"]).valid).toBe(true);
    expect(validateXfnRelationships(["met"]).valid).toBe(true);
    expect(validateXfnRelationships(["me"]).valid).toBe(true);
  });

  it("accepts valid combinations across categories", () => {
    const result = validateXfnRelationships([
      "friend",
      "met",
      "colleague",
      "neighbor",
    ]);
    expect(result.valid).toBe(true);
  });

  it("rejects friend + acquaintance (friendship exclusivity)", () => {
    const result = validateXfnRelationships(["friend", "acquaintance"]);
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Friendship");
  });

  it("rejects contact + friend (friendship exclusivity)", () => {
    const result = validateXfnRelationships(["contact", "friend"]);
    expect(result.valid).toBe(false);
  });

  it("rejects co-resident + neighbor (geographical exclusivity)", () => {
    const result = validateXfnRelationships(["co-resident", "neighbor"]);
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain("Geographical");
  });

  it("rejects child + spouse (family exclusivity)", () => {
    const result = validateXfnRelationships(["child", "spouse"]);
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain("Family");
  });

  it("rejects sibling + parent + kin (multiple family violations)", () => {
    const result = validateXfnRelationships(["sibling", "parent", "kin"]);
    expect(result.valid).toBe(false);
  });

  it("rejects me + any other value", () => {
    const result = validateXfnRelationships(["me", "friend"]);
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain("me");
    expect(result.warnings[0]).toContain("exclusive");
  });

  it("warns about unrecognized values", () => {
    const result = validateXfnRelationships(["friend", "enemy"]);
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain("enemy");
  });

  it("allows co-worker + colleague (professional is not exclusive)", () => {
    const result = validateXfnRelationships(["co-worker", "colleague"]);
    expect(result.valid).toBe(true);
  });

  it("allows multiple romantic values", () => {
    const result = validateXfnRelationships(["crush", "date"]);
    expect(result.valid).toBe(true);
  });

  it("can report multiple violations at once", () => {
    const result = validateXfnRelationships([
      "friend",
      "acquaintance",
      "co-resident",
      "neighbor",
    ]);
    expect(result.valid).toBe(false);
    expect(result.warnings).toHaveLength(2);
  });
});

describe("isValidXfnValue", () => {
  it("returns true for valid values", () => {
    expect(isValidXfnValue("friend")).toBe(true);
    expect(isValidXfnValue("met")).toBe(true);
    expect(isValidXfnValue("co-worker")).toBe(true);
    expect(isValidXfnValue("me")).toBe(true);
  });

  it("returns false for invalid values", () => {
    expect(isValidXfnValue("enemy")).toBe(false);
    expect(isValidXfnValue("nofollow")).toBe(false);
    expect(isValidXfnValue("")).toBe(false);
  });
});

// ── Builder ──────────────────────────────────────────────────────────

describe("buildRelAttribute", () => {
  it("builds from XFN values only", () => {
    expect(buildRelAttribute(["friend", "met"])).toBe("friend met");
  });

  it("combines XFN and other values", () => {
    expect(
      buildRelAttribute(["friend", "met"], ["noopener", "noreferrer"]),
    ).toBe("friend met noopener noreferrer");
  });

  it("deduplicates values", () => {
    expect(buildRelAttribute(["friend", "friend"])).toBe("friend");
  });

  it("returns empty string for empty inputs", () => {
    expect(buildRelAttribute([])).toBe("");
    expect(buildRelAttribute([], [])).toBe("");
  });

  it("filters empty strings", () => {
    expect(buildRelAttribute(["friend", "", "met"])).toBe("friend met");
  });

  it('builds rel="me" for identity links', () => {
    expect(buildRelAttribute(["me"])).toBe("me");
  });
});

// ── Parser ───────────────────────────────────────────────────────────

describe("parseRelAttribute", () => {
  it("separates XFN and non-XFN values", () => {
    const result = parseRelAttribute("nofollow friend met noopener");
    expect(result.xfn).toEqual(["friend", "met"]);
    expect(result.other).toEqual(["nofollow", "noopener"]);
  });

  it("handles XFN-only string", () => {
    const result = parseRelAttribute("friend met colleague");
    expect(result.xfn).toEqual(["friend", "met", "colleague"]);
    expect(result.other).toEqual([]);
  });

  it("handles non-XFN-only string", () => {
    const result = parseRelAttribute("nofollow noopener");
    expect(result.xfn).toEqual([]);
    expect(result.other).toEqual(["nofollow", "noopener"]);
  });

  it("handles empty string", () => {
    const result = parseRelAttribute("");
    expect(result.xfn).toEqual([]);
    expect(result.other).toEqual([]);
  });

  it("handles whitespace-only string", () => {
    const result = parseRelAttribute("   ");
    expect(result.xfn).toEqual([]);
    expect(result.other).toEqual([]);
  });

  it("handles extra whitespace between values", () => {
    const result = parseRelAttribute("  friend   met   nofollow  ");
    expect(result.xfn).toEqual(["friend", "met"]);
    expect(result.other).toEqual(["nofollow"]);
  });

  it("recognizes me as XFN", () => {
    const result = parseRelAttribute("me noopener");
    expect(result.xfn).toEqual(["me"]);
    expect(result.other).toEqual(["noopener"]);
  });

  it("recognizes hyphenated XFN values", () => {
    const result = parseRelAttribute("co-worker co-resident");
    expect(result.xfn).toEqual(["co-worker", "co-resident"]);
  });
});

// ── Extractor ────────────────────────────────────────────────────────

describe("extractXfnLinks", () => {
  it("extracts XFN link from simple anchor", () => {
    const html = '<a href="https://alice.dev" rel="friend met">Alice</a>';
    const links = extractXfnLinks(html);
    expect(links).toEqual([
      { url: "https://alice.dev", rels: ["friend", "met"] },
    ]);
  });

  it("extracts multiple XFN links", () => {
    const html =
      '<a href="https://alice.dev" rel="friend">Alice</a>' +
      '<a href="https://bob.dev" rel="colleague met">Bob</a>';
    const links = extractXfnLinks(html);
    expect(links).toHaveLength(2);
    expect(links[0].rels).toEqual(["friend"]);
    expect(links[1].rels).toEqual(["colleague", "met"]);
  });

  it("ignores links without rel attribute", () => {
    const html = '<a href="https://example.com">No rel</a>';
    expect(extractXfnLinks(html)).toEqual([]);
  });

  it("ignores links with only non-XFN rel values", () => {
    const html =
      '<a href="https://example.com" rel="nofollow noopener">Link</a>';
    expect(extractXfnLinks(html)).toEqual([]);
  });

  it("handles mixed XFN and non-XFN rel values", () => {
    const html =
      '<a href="https://alice.dev" rel="nofollow friend met noopener">Alice</a>';
    const links = extractXfnLinks(html);
    expect(links).toEqual([
      { url: "https://alice.dev", rels: ["friend", "met"] },
    ]);
  });

  it('handles rel="me" identity links', () => {
    const html = '<a href="https://twitter.com/me" rel="me">Twitter</a>';
    const links = extractXfnLinks(html);
    expect(links).toEqual([{ url: "https://twitter.com/me", rels: ["me"] }]);
  });

  it("returns empty array for HTML with no anchors", () => {
    expect(extractXfnLinks("<p>No links here</p>")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(extractXfnLinks("")).toEqual([]);
  });

  it("handles single-quoted attributes", () => {
    const html = "<a href='https://alice.dev' rel='friend'>Alice</a>";
    const links = extractXfnLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0].rels).toEqual(["friend"]);
  });
});
