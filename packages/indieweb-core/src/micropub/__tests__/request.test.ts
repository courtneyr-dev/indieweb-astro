import { describe, it, expect } from "vitest";
import {
  buildFormEncodedCreate,
  buildJsonCreate,
  buildJsonUpdate,
  buildJsonAction,
  parseMicropubRequest,
  extractBearerToken,
  isCreateRequest,
  isUpdateRequest,
  isActionRequest,
  requiredScope,
} from "../request.js";

describe("buildFormEncodedCreate", () => {
  it("builds basic h-entry form body", () => {
    const body = buildFormEncodedCreate({ content: ["Hello world"] });
    const params = new URLSearchParams(body);
    expect(params.get("h")).toBe("entry");
    expect(params.get("content")).toBe("Hello world");
  });

  it("uses bracket notation for multiple values", () => {
    const body = buildFormEncodedCreate({
      category: ["indieweb", "micropub"],
    });
    const params = new URLSearchParams(body);
    expect(params.getAll("category[]")).toEqual(["indieweb", "micropub"]);
  });

  it("handles custom h type", () => {
    const body = buildFormEncodedCreate({ name: ["My Event"] }, "event");
    const params = new URLSearchParams(body);
    expect(params.get("h")).toBe("event");
  });

  it("includes mp- command properties", () => {
    const body = buildFormEncodedCreate({
      content: ["hello"],
      "mp-syndicate-to": ["https://twitter.com/user"],
    });
    const params = new URLSearchParams(body);
    expect(params.getAll("mp-syndicate-to[]")).toEqual([
      "https://twitter.com/user",
    ]);
  });

  it("skips non-string values", () => {
    const body = buildFormEncodedCreate({
      content: [{ html: "<p>hello</p>" }] as unknown as string[],
    });
    const params = new URLSearchParams(body);
    expect(params.has("content")).toBe(false);
  });
});

describe("buildJsonCreate", () => {
  it("builds h-entry JSON structure", () => {
    const json = buildJsonCreate({ content: ["Hello world"] });
    expect(json).toEqual({
      type: ["h-entry"],
      properties: { content: ["Hello world"] },
    });
  });

  it("supports custom type", () => {
    const json = buildJsonCreate({ name: ["My Event"] }, "h-event");
    expect(json.type).toEqual(["h-event"]);
  });
});

describe("buildJsonUpdate", () => {
  it("builds update with replace", () => {
    const json = buildJsonUpdate("https://example.com/post/1", {
      replace: { content: ["Updated"] },
    });
    expect(json).toEqual({
      action: "update",
      url: "https://example.com/post/1",
      replace: { content: ["Updated"] },
    });
  });

  it("builds update with add and delete", () => {
    const json = buildJsonUpdate("https://example.com/post/1", {
      add: { category: ["new"] },
      delete: { category: ["old"] },
    });
    expect(json.action).toBe("update");
    expect(json.add).toEqual({ category: ["new"] });
    expect(json.delete).toEqual({ category: ["old"] });
  });
});

describe("buildJsonAction", () => {
  it("builds delete action", () => {
    expect(buildJsonAction("delete", "https://example.com/post/1")).toEqual({
      action: "delete",
      url: "https://example.com/post/1",
    });
  });

  it("builds undelete action", () => {
    expect(buildJsonAction("undelete", "https://example.com/post/1")).toEqual({
      action: "undelete",
      url: "https://example.com/post/1",
    });
  });
});

describe("parseMicropubRequest", () => {
  describe("JSON requests", () => {
    it("parses create request", () => {
      const result = parseMicropubRequest(
        { type: ["h-entry"], properties: { content: ["hello"] } },
        "application/json",
      );
      expect("error" in result).toBe(false);
      expect(isCreateRequest(result as any)).toBe(true);
    });

    it("parses update request", () => {
      const result = parseMicropubRequest(
        {
          action: "update",
          url: "https://example.com/post/1",
          replace: { content: ["updated"] },
        },
        "application/json",
      );
      expect("error" in result).toBe(false);
      expect(isUpdateRequest(result as any)).toBe(true);
    });

    it("parses delete request", () => {
      const result = parseMicropubRequest(
        { action: "delete", url: "https://example.com/post/1" },
        "application/json",
      );
      expect("error" in result).toBe(false);
      expect(isActionRequest(result as any)).toBe(true);
    });

    it("parses undelete request", () => {
      const result = parseMicropubRequest(
        { action: "undelete", url: "https://example.com/post/1" },
        "application/json",
      );
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect((result as any).action).toBe("undelete");
      }
    });

    it("returns error for missing url in delete", () => {
      const result = parseMicropubRequest(
        { action: "delete" },
        "application/json",
      );
      expect("error" in result).toBe(true);
    });

    it("returns error for missing url in update", () => {
      const result = parseMicropubRequest(
        { action: "update", replace: { content: ["x"] } },
        "application/json",
      );
      expect("error" in result).toBe(true);
    });

    it("returns error for invalid body", () => {
      const result = parseMicropubRequest(null, "application/json");
      expect("error" in result).toBe(true);
    });

    it("returns error for unrecognized structure", () => {
      const result = parseMicropubRequest({ foo: "bar" }, "application/json");
      expect("error" in result).toBe(true);
    });
  });

  describe("form-encoded requests", () => {
    it("parses basic create", () => {
      const result = parseMicropubRequest(
        "h=entry&content=Hello+world",
        "application/x-www-form-urlencoded",
      );
      expect("error" in result).toBe(false);
      if (!("error" in result) && isCreateRequest(result)) {
        expect(result.type).toEqual(["h-entry"]);
        expect(result.properties.content).toEqual(["Hello world"]);
      }
    });

    it("parses create with bracket notation", () => {
      const result = parseMicropubRequest(
        "h=entry&content=hello&category[]=a&category[]=b",
        "application/x-www-form-urlencoded",
      );
      expect("error" in result).toBe(false);
      if (!("error" in result) && isCreateRequest(result)) {
        expect(result.properties.category).toEqual(["a", "b"]);
      }
    });

    it("defaults h to entry", () => {
      const result = parseMicropubRequest(
        "content=hello",
        "application/x-www-form-urlencoded",
      );
      expect("error" in result).toBe(false);
      if (!("error" in result) && isCreateRequest(result)) {
        expect(result.type).toEqual(["h-entry"]);
      }
    });

    it("strips access_token from properties", () => {
      const result = parseMicropubRequest(
        "h=entry&content=hello&access_token=secret",
        "application/x-www-form-urlencoded",
      );
      expect("error" in result).toBe(false);
      if (!("error" in result) && isCreateRequest(result)) {
        expect(result.properties["access_token"]).toBeUndefined();
      }
    });

    it("parses form-encoded delete", () => {
      const result = parseMicropubRequest(
        "action=delete&url=https://example.com/post/1",
        "application/x-www-form-urlencoded",
      );
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(isActionRequest(result)).toBe(true);
      }
    });
  });

  it("rejects unsupported content type", () => {
    const result = parseMicropubRequest("<xml/>", "application/xml");
    expect("error" in result).toBe(true);
  });
});

describe("extractBearerToken", () => {
  it("extracts token from Authorization header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("handles case-insensitive Bearer prefix", () => {
    expect(extractBearerToken("bearer abc123")).toBe("abc123");
  });

  it("returns null for non-Bearer auth", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("extracts token from form body", () => {
    expect(extractBearerToken(undefined, "access_token=abc123")).toBe("abc123");
  });

  it("prefers Authorization header over form body", () => {
    expect(
      extractBearerToken("Bearer header-token", "access_token=form-token"),
    ).toBe("header-token");
  });

  it("returns null when no token found", () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });
});

describe("type guards", () => {
  it("isCreateRequest identifies create", () => {
    expect(
      isCreateRequest({ type: ["h-entry"], properties: { content: ["hi"] } }),
    ).toBe(true);
  });

  it("isCreateRequest rejects non-create", () => {
    expect(
      isCreateRequest({ action: "delete", url: "https://example.com" }),
    ).toBe(false);
  });

  it("isUpdateRequest identifies update", () => {
    expect(
      isUpdateRequest({
        action: "update",
        url: "https://example.com",
        replace: {},
      }),
    ).toBe(true);
  });

  it("isActionRequest identifies delete", () => {
    expect(
      isActionRequest({ action: "delete", url: "https://example.com" }),
    ).toBe(true);
  });

  it("isActionRequest identifies undelete", () => {
    expect(
      isActionRequest({ action: "undelete", url: "https://example.com" }),
    ).toBe(true);
  });
});

describe("requiredScope", () => {
  it("returns create for create requests", () => {
    expect(
      requiredScope({ type: ["h-entry"], properties: { content: ["hi"] } }),
    ).toBe("create");
  });

  it("returns update for update requests", () => {
    expect(
      requiredScope({ action: "update", url: "https://example.com" }),
    ).toBe("update");
  });

  it("returns delete for delete requests", () => {
    expect(
      requiredScope({ action: "delete", url: "https://example.com" }),
    ).toBe("delete");
  });

  it("returns delete for undelete requests", () => {
    expect(
      requiredScope({ action: "undelete", url: "https://example.com" }),
    ).toBe("delete");
  });
});
