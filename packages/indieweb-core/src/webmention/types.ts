/**
 * Webmention types per the W3C Webmention specification.
 * @see https://www.w3.org/TR/webmention/
 */

/**
 * A webmention request payload — the source/target pair POSTed to the endpoint.
 *
 * @example
 * ```ts
 * const wm: WebmentionRequest = {
 *   source: 'https://alice.example/post/1',
 *   target: 'https://bob.example/post/2',
 * };
 * ```
 */
export interface WebmentionRequest {
  /** The URL of the page that mentions the target */
  source: string;
  /** The URL of the page being mentioned */
  target: string;
}

/**
 * Result of sending a webmention to an endpoint.
 *
 * @example
 * ```ts
 * const result: WebmentionSendResult = {
 *   success: true,
 *   status: 202,
 *   endpoint: 'https://bob.example/webmention',
 * };
 * ```
 */
export interface WebmentionSendResult {
  /** Whether the endpoint accepted the webmention (2xx) */
  success: boolean;
  /** HTTP status code from the endpoint */
  status: number;
  /** The endpoint URL that was POSTed to */
  endpoint: string;
  /** Status URL returned in the Location header (if 201) */
  location?: string;
  /** Error message if the send failed */
  error?: string;
}

/**
 * Result of discovering a webmention endpoint from a target URL.
 *
 * @example
 * ```ts
 * const result: WebmentionEndpointDiscovery = {
 *   endpoint: 'https://bob.example/webmention',
 *   method: 'link-header',
 * };
 * ```
 */
export interface WebmentionEndpointDiscovery {
  /** The resolved absolute endpoint URL, or null if not found */
  endpoint: string | null;
  /** How the endpoint was discovered */
  method: "link-header" | "html-link" | "html-a" | "none";
}

/**
 * Validation result for an incoming webmention request.
 *
 * @example
 * ```ts
 * const result: WebmentionValidation = {
 *   valid: true,
 *   source: 'https://alice.example/post/1',
 *   target: 'https://bob.example/post/2',
 * };
 * ```
 */
export interface WebmentionValidation {
  /** Whether the request passed initial validation */
  valid: boolean;
  /** The source URL (after basic validation) */
  source: string;
  /** The target URL (after basic validation) */
  target: string;
  /** Validation error if invalid */
  error?: string;
}

/**
 * Result of verifying a webmention — fetching the source and confirming
 * it links to the target.
 *
 * @example
 * ```ts
 * const result: WebmentionVerification = {
 *   verified: true,
 *   source: 'https://alice.example/post/1',
 *   target: 'https://bob.example/post/2',
 *   sourceContent: '<html>...',
 *   displayType: 'reply',
 * };
 * ```
 */
export interface WebmentionVerification {
  /** Whether the source actually links to the target */
  verified: boolean;
  /** The source URL */
  source: string;
  /** The target URL */
  target: string;
  /** Whether the source returned HTTP 410 Gone (post deleted) */
  gone?: boolean;
  /** The fetched source HTML (for extracting mf2 data) */
  sourceContent?: string;
  /** Detected display type from mf2 properties in source */
  displayType?: WebmentionDisplayType;
  /** Error message if verification failed */
  error?: string;
}

/**
 * The type of webmention as determined by mf2 properties in the source.
 * Used for display grouping (e.g., "likes", "replies", "reposts").
 *
 * @example
 * ```ts
 * const type: WebmentionDisplayType = 'like';
 * ```
 */
export type WebmentionDisplayType =
  | "like"
  | "reply"
  | "repost"
  | "bookmark"
  | "mention"
  | "rsvp"
  | "tag";

/**
 * A stored webmention record, combining the request with verification
 * and display metadata.
 *
 * @example
 * ```ts
 * const wm: WebmentionRecord = {
 *   source: 'https://alice.example/post/1',
 *   target: 'https://bob.example/post/2',
 *   verified: true,
 *   type: 'reply',
 *   authorName: 'Alice',
 *   authorUrl: 'https://alice.example',
 *   content: 'Great post!',
 *   receivedAt: '2026-04-10T12:00:00Z',
 * };
 * ```
 */
export interface WebmentionRecord {
  /** Source URL */
  source: string;
  /** Target URL on your site */
  target: string;
  /** Has this been verified? */
  verified: boolean;
  /** Display type (like, reply, repost, etc.) */
  type: WebmentionDisplayType;
  /** Author name from source h-card */
  authorName?: string;
  /** Author URL from source h-card */
  authorUrl?: string;
  /** Author photo URL from source h-card */
  authorPhoto?: string;
  /** Text content or summary from the source */
  content?: string;
  /** Published date from the source h-entry */
  published?: string;
  /** When this webmention was received */
  receivedAt: string;
  /** RSVP value if type is 'rsvp' */
  rsvpValue?: "yes" | "no" | "maybe" | "interested";
}
