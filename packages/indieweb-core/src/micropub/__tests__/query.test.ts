import { describe, it, expect } from "vitest";
import {
  buildQueryUrl,
  parseQuery,
  parseConfigResponse,
  parseSourceResponse,
  parseSyndicateToResponse,
  buildConfigResponse,
  buildSourceResponse,
} from "../query.js";

describe("buildQueryUrl", () => {
  it("builds config query URL", () => {
    const url = buildQueryUrl("https://example.com/micropub", "config");
    expect(url).toBe("https://example.com/micropub?q=config");
  });

  it("builds source query with URL", () => {
    const url = buildQueryUrl("https://example.com/micropub", "source", {
      url: "https://example.com/post/1",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("q")).toBe("source");
    expect(parsed.searchParams.get("url")).toBe("https://example.com/post/1");
  });

  it("builds source query with properties filter", () => {
    const url = buildQueryUrl("https://example.com/micropub", "source", {
      url: "https://example.com/post/1",
      properties: ["content", "category"],
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.getAll("properties[]")).toEqual([
      "content",
      "category",
    ]);
  });

  it("builds syndicate-to query", () => {
    const url = buildQueryUrl("https://example.com/micropub", "syndicate-to");
    expect(url).toBe("https://example.com/micropub?q=syndicate-to");
  });

  it("builds category query", () => {
    const url = buildQueryUrl("https://example.com/micropub", "category");
    expect(url).toBe("https://example.com/micropub?q=category");
  });
});

describe("parseQuery", () => {
  it("parses config query", () => {
    const result = parseQuery("https://example.com/micropub?q=config");
    expect(result.type).toBe("config");
  });

  it("parses source query with URL", () => {
    const result = parseQuery(
      "https://example.com/micropub?q=source&url=https://example.com/post/1",
    );
    expect(result.type).toBe("source");
    expect(result.url).toBe("https://example.com/post/1");
  });

  it("parses source query with properties", () => {
    const result = parseQuery(
      "https://example.com/micropub?q=source&url=https://example.com/post/1&properties[]=content&properties[]=category",
    );
    expect(result.properties).toEqual(["content", "category"]);
  });

  it("returns null type when q param missing", () => {
    const result = parseQuery("https://example.com/micropub");
    expect(result.type).toBeNull();
  });

  it("returns undefined properties when none specified", () => {
    const result = parseQuery("https://example.com/micropub?q=source");
    expect(result.properties).toBeUndefined();
  });
});

describe("parseConfigResponse", () => {
  it("parses config with media endpoint", () => {
    const result = parseConfigResponse({
      "media-endpoint": "https://media.example.com/upload",
    });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result["media-endpoint"]).toBe("https://media.example.com/upload");
    }
  });

  it("parses config with syndication targets", () => {
    const result = parseConfigResponse({
      "syndicate-to": [{ uid: "https://twitter.com/user", name: "Twitter" }],
    });
    expect("error" in result).toBe(false);
  });

  it("returns error for non-object", () => {
    expect("error" in parseConfigResponse(null)).toBe(true);
    expect("error" in parseConfigResponse("string")).toBe(true);
  });
});

describe("parseSourceResponse", () => {
  it("parses source with type and properties", () => {
    const result = parseSourceResponse({
      type: ["h-entry"],
      properties: { content: ["Hello"] },
    });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.type).toEqual(["h-entry"]);
      expect(result.properties.content).toEqual(["Hello"]);
    }
  });

  it("parses source without type", () => {
    const result = parseSourceResponse({
      properties: { content: ["Hello"] },
    });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.type).toBeUndefined();
    }
  });

  it("returns error for missing properties", () => {
    const result = parseSourceResponse({ type: ["h-entry"] });
    expect("error" in result).toBe(true);
  });

  it("returns error for non-object", () => {
    expect("error" in parseSourceResponse(null)).toBe(true);
  });
});

describe("parseSyndicateToResponse", () => {
  it("parses syndication targets", () => {
    const result = parseSyndicateToResponse({
      "syndicate-to": [
        {
          uid: "https://brid.gy/publish/mastodon",
          name: "Mastodon via Bridgy",
        },
      ],
    });
    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe("https://brid.gy/publish/mastodon");
    }
  });

  it("returns empty array when syndicate-to not present", () => {
    const result = parseSyndicateToResponse({});
    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result).toHaveLength(0);
    }
  });

  it("returns error for non-object", () => {
    expect("error" in (parseSyndicateToResponse(null) as any)).toBe(true);
  });
});

describe("buildConfigResponse", () => {
  it("builds config with media endpoint", () => {
    const config = buildConfigResponse({
      mediaEndpoint: "https://media.example.com/upload",
    });
    expect(config["media-endpoint"]).toBe("https://media.example.com/upload");
  });

  it("builds config with syndication targets", () => {
    const config = buildConfigResponse({
      syndicationTargets: [
        { uid: "https://twitter.com/user", name: "Twitter" },
      ],
    });
    expect(config["syndicate-to"]).toHaveLength(1);
  });

  it("builds empty config", () => {
    const config = buildConfigResponse({});
    expect(config["media-endpoint"]).toBeUndefined();
    expect(config["syndicate-to"]).toBeUndefined();
  });
});

describe("buildSourceResponse", () => {
  const post = {
    type: ["h-entry"] as string[],
    properties: {
      content: ["Hello world"],
      category: ["test", "demo"],
      published: ["2024-01-01T00:00:00Z"],
    },
  };

  it("returns full post when no properties requested", () => {
    const result = buildSourceResponse(post);
    expect(result).toEqual(post);
  });

  it("returns full post for empty properties array", () => {
    const result = buildSourceResponse(post, []);
    expect(result).toEqual(post);
  });

  it("filters to requested properties", () => {
    const result = buildSourceResponse(post, ["content"]);
    expect(result.properties).toEqual({ content: ["Hello world"] });
    expect((result.properties as any).category).toBeUndefined();
  });

  it("handles multiple requested properties", () => {
    const result = buildSourceResponse(post, ["content", "category"]);
    expect(result.properties).toEqual({
      content: ["Hello world"],
      category: ["test", "demo"],
    });
  });

  it("ignores non-existent requested properties", () => {
    const result = buildSourceResponse(post, ["nonexistent"]);
    expect(result.properties).toEqual({});
  });
});
