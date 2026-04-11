/**
 * Micropub types — covers the full Micropub protocol.
 *
 * @see https://micropub.spec.indieweb.org/
 */

/**
 * A Micropub create request in JSON format.
 *
 * All property values are arrays, matching the mf2 JSON structure.
 *
 * @example
 * ```ts
 * const post: MicropubCreateRequest = {
 *   type: ["h-entry"],
 *   properties: {
 *     content: ["Hello, world!"],
 *     category: ["indieweb", "micropub"],
 *   },
 * };
 * ```
 */
export interface MicropubCreateRequest {
  /** Microformat type (e.g. ["h-entry"]) */
  type: string[];
  /** Properties — all values must be arrays */
  properties: MicropubProperties;
}

/**
 * Micropub properties object.
 *
 * Values are always arrays, even for single values.
 * String values are plain text; objects represent HTML content
 * or media with alt text.
 *
 * @example
 * ```ts
 * const props: MicropubProperties = {
 *   content: [{ html: "<p>Hello</p>" }],
 *   photo: [{ value: "https://example.com/photo.jpg", alt: "A photo" }],
 *   category: ["tag1", "tag2"],
 * };
 * ```
 */
export interface MicropubProperties {
  /** Post text content (string or {html: string}) */
  content?: Array<string | MicropubHtmlContent>;
  /** Article title */
  name?: string[];
  /** Brief description */
  summary?: string[];
  /** Tags/categories */
  category?: string[];
  /** Publication date (ISO 8601) */
  published?: string[];
  /** Last modification date */
  updated?: string[];
  /** URL being replied to */
  "in-reply-to"?: string[];
  /** URL being liked */
  "like-of"?: string[];
  /** URL being reposted */
  "repost-of"?: string[];
  /** URL being bookmarked */
  "bookmark-of"?: string[];
  /** Photo URLs or objects with alt text */
  photo?: Array<string | MicropubMediaObject>;
  /** Video URLs or objects with alt text */
  video?: Array<string | MicropubMediaObject>;
  /** Audio URLs */
  audio?: Array<string | MicropubMediaObject>;
  /** Location (geo URI, URL, or plaintext) */
  location?: string[];
  /** Existing syndication URLs */
  syndication?: string[];
  /** POSSE syndication targets (mp- command, not stored) */
  "mp-syndicate-to"?: string[];
  /** Post slug (mp- command) */
  "mp-slug"?: string[];
  /** Post status: "published" or "draft" */
  "post-status"?: Array<"published" | "draft">;
  /** Post visibility */
  visibility?: Array<"public" | "unlisted" | "private">;
  /** Any additional properties */
  [key: string]: unknown[] | undefined;
}

/**
 * HTML content value in a Micropub request.
 *
 * @example
 * ```ts
 * const content: MicropubHtmlContent = { html: "<p>Hello <b>world</b></p>" };
 * ```
 */
export interface MicropubHtmlContent {
  html: string;
}

/**
 * Media object with alt text.
 *
 * @example
 * ```ts
 * const photo: MicropubMediaObject = {
 *   value: "https://example.com/photo.jpg",
 *   alt: "A sunset over the ocean",
 * };
 * ```
 */
export interface MicropubMediaObject {
  value: string;
  alt?: string;
}

/**
 * A Micropub update request.
 *
 * @example
 * ```ts
 * const update: MicropubUpdateRequest = {
 *   action: "update",
 *   url: "https://example.com/post/123",
 *   replace: { content: ["Updated content"] },
 *   add: { category: ["new-tag"] },
 *   delete: { category: ["old-tag"] },
 * };
 * ```
 */
export interface MicropubUpdateRequest {
  action: "update";
  /** URL of the post to update */
  url: string;
  /** Replace all values for these properties */
  replace?: Record<string, unknown[]>;
  /** Add values to these properties */
  add?: Record<string, unknown[]>;
  /** Remove properties entirely or remove specific values */
  delete?: Record<string, unknown[]> | string[];
}

/**
 * A Micropub delete or undelete request.
 *
 * @example
 * ```ts
 * const del: MicropubActionRequest = { action: "delete", url: "https://example.com/post/123" };
 * const undel: MicropubActionRequest = { action: "undelete", url: "https://example.com/post/123" };
 * ```
 */
export interface MicropubActionRequest {
  action: "delete" | "undelete";
  url: string;
}

/**
 * Union of all Micropub POST request body types.
 */
export type MicropubRequest =
  | MicropubCreateRequest
  | MicropubUpdateRequest
  | MicropubActionRequest;

/**
 * Micropub query types.
 *
 * @example
 * ```ts
 * const queryType: MicropubQueryType = "config";
 * ```
 */
export type MicropubQueryType =
  | "config"
  | "source"
  | "syndicate-to"
  | "category"
  | "contact";

/**
 * Micropub config query response.
 *
 * @example
 * ```ts
 * const config: MicropubConfigResponse = {
 *   "media-endpoint": "https://media.example.com/micropub",
 *   "syndicate-to": [{ uid: "https://twitter.com/user", name: "Twitter" }],
 * };
 * ```
 */
export interface MicropubConfigResponse {
  /** Media endpoint URL for file uploads */
  "media-endpoint"?: string;
  /** Available syndication targets */
  "syndicate-to"?: SyndicationTarget[];
  /** Any additional config */
  [key: string]: unknown;
}

/**
 * A POSSE syndication target.
 *
 * @example
 * ```ts
 * const target: SyndicationTarget = {
 *   uid: "https://brid.gy/publish/mastodon",
 *   name: "Mastodon via Bridgy",
 * };
 * ```
 */
export interface SyndicationTarget {
  /** Unique identifier URL */
  uid: string;
  /** Human-readable name */
  name: string;
  /** Service information */
  service?: {
    name: string;
    url: string;
    photo?: string;
  };
  /** User information on the service */
  user?: {
    name: string;
    url: string;
    photo?: string;
  };
}

/**
 * Micropub source query response.
 *
 * @example
 * ```ts
 * const source: MicropubSourceResponse = {
 *   type: ["h-entry"],
 *   properties: {
 *     content: ["Hello world"],
 *     category: ["test"],
 *   },
 * };
 * ```
 */
export interface MicropubSourceResponse {
  type?: string[];
  properties: MicropubProperties;
}

/**
 * Micropub error response.
 *
 * @example
 * ```ts
 * const error: MicropubError = {
 *   error: "insufficient_scope",
 *   error_description: "Token does not have create scope",
 *   scope: "create",
 * };
 * ```
 */
export interface MicropubError {
  /** Error code */
  error:
    | "invalid_request"
    | "unauthorized"
    | "forbidden"
    | "insufficient_scope";
  /** Human-readable description */
  error_description?: string;
  /** Required scope (for insufficient_scope errors) */
  scope?: string;
}

/**
 * Required scopes for Micropub operations.
 */
export type MicropubScope = "create" | "update" | "delete" | "media" | "draft";
