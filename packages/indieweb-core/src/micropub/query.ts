/**
 * Micropub query building and parsing.
 *
 * Handles the q= query parameter for configuration, source,
 * syndication targets, categories, and contacts.
 *
 * @see https://micropub.spec.indieweb.org/#querying
 */
import type {
  MicropubQueryType,
  MicropubConfigResponse,
  MicropubSourceResponse,
  SyndicationTarget,
  MicropubError,
} from "./types.js";

/**
 * Build a Micropub query URL.
 *
 * @example
 * ```ts
 * buildQueryUrl("https://example.com/micropub", "config");
 * // "https://example.com/micropub?q=config"
 *
 * buildQueryUrl("https://example.com/micropub", "source", {
 *   url: "https://example.com/post/1",
 *   properties: ["content", "category"],
 * });
 * // "https://example.com/micropub?q=source&url=...&properties[]=content&properties[]=category"
 * ```
 */
export function buildQueryUrl(
  endpoint: string,
  query: MicropubQueryType,
  params?: {
    url?: string;
    properties?: string[];
  },
): string {
  const url = new URL(endpoint);
  url.searchParams.set("q", query);

  if (params?.url) {
    url.searchParams.set("url", params.url);
  }

  if (params?.properties) {
    for (const prop of params.properties) {
      url.searchParams.append("properties[]", prop);
    }
  }

  return url.toString();
}

/**
 * Parse a Micropub query from a request URL.
 *
 * @example
 * ```ts
 * const query = parseQuery("https://example.com/micropub?q=source&url=https://example.com/post/1");
 * // { type: "source", url: "https://example.com/post/1" }
 * ```
 */
export function parseQuery(requestUrl: string): {
  type: MicropubQueryType | null;
  url?: string;
  properties?: string[];
} {
  const url = new URL(requestUrl);
  const q = url.searchParams.get("q") as MicropubQueryType | null;
  const targetUrl = url.searchParams.get("url") || undefined;
  const properties = url.searchParams.getAll("properties[]");

  return {
    type: q,
    url: targetUrl,
    properties: properties.length > 0 ? properties : undefined,
  };
}

/**
 * Parse a config query response.
 *
 * @example
 * ```ts
 * const config = parseConfigResponse({
 *   "media-endpoint": "https://media.example.com/upload",
 *   "syndicate-to": [{ uid: "https://twitter.com/user", name: "Twitter" }],
 * });
 * ```
 */
export function parseConfigResponse(
  json: unknown,
): MicropubConfigResponse | MicropubError {
  if (!json || typeof json !== "object") {
    return {
      error: "invalid_request",
      error_description: "Config response must be a JSON object",
    };
  }

  return json as MicropubConfigResponse;
}

/**
 * Parse a source query response.
 *
 * @example
 * ```ts
 * const source = parseSourceResponse({
 *   type: ["h-entry"],
 *   properties: { content: ["Hello world"] },
 * });
 * ```
 */
export function parseSourceResponse(
  json: unknown,
): MicropubSourceResponse | MicropubError {
  if (!json || typeof json !== "object") {
    return {
      error: "invalid_request",
      error_description: "Source response must be a JSON object",
    };
  }

  const data = json as Record<string, unknown>;

  if (!data.properties || typeof data.properties !== "object") {
    return {
      error: "invalid_request",
      error_description: "Source response must contain properties",
    };
  }

  return {
    type: Array.isArray(data.type) ? (data.type as string[]) : undefined,
    properties: data.properties as MicropubSourceResponse["properties"],
  };
}

/**
 * Parse a syndicate-to query response.
 *
 * @example
 * ```ts
 * const targets = parseSyndicateToResponse({
 *   "syndicate-to": [
 *     { uid: "https://brid.gy/publish/mastodon", name: "Mastodon via Bridgy" },
 *   ],
 * });
 * ```
 */
export function parseSyndicateToResponse(
  json: unknown,
): SyndicationTarget[] | MicropubError {
  if (!json || typeof json !== "object") {
    return {
      error: "invalid_request",
      error_description: "Syndicate-to response must be a JSON object",
    };
  }

  const data = json as Record<string, unknown>;
  const targets = data["syndicate-to"];

  if (!Array.isArray(targets)) {
    return [];
  }

  return targets as SyndicationTarget[];
}

/**
 * Build a Micropub config response object.
 *
 * Server-side helper for constructing the config query response.
 *
 * @example
 * ```ts
 * const response = buildConfigResponse({
 *   mediaEndpoint: "https://media.example.com/upload",
 *   syndicationTargets: [
 *     { uid: "https://brid.gy/publish/mastodon", name: "Mastodon" },
 *   ],
 * });
 * ```
 */
export function buildConfigResponse(config: {
  mediaEndpoint?: string;
  syndicationTargets?: SyndicationTarget[];
}): MicropubConfigResponse {
  const response: MicropubConfigResponse = {};

  if (config.mediaEndpoint) {
    response["media-endpoint"] = config.mediaEndpoint;
  }
  if (config.syndicationTargets) {
    response["syndicate-to"] = config.syndicationTargets;
  }

  return response;
}

/**
 * Build a Micropub source response for a single post.
 *
 * Server-side helper. Filters properties if specific ones were requested.
 *
 * @example
 * ```ts
 * const response = buildSourceResponse(
 *   { type: ["h-entry"], properties: { content: ["Hello"], category: ["test"] } },
 *   ["content"]  // only return content property
 * );
 * // { properties: { content: ["Hello"] } }
 * ```
 */
export function buildSourceResponse(
  post: MicropubSourceResponse,
  requestedProperties?: string[],
): MicropubSourceResponse {
  if (!requestedProperties || requestedProperties.length === 0) {
    return post;
  }

  const filtered: Record<string, unknown[]> = {};
  for (const prop of requestedProperties) {
    if (post.properties[prop]) {
      filtered[prop] = post.properties[prop] as unknown[];
    }
  }

  return { properties: filtered };
}
