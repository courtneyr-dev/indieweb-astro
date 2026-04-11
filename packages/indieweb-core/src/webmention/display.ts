/**
 * Webmention display type detection from microformats2 properties.
 *
 * When a verified webmention's source HTML is parsed for mf2 data,
 * the h-entry properties determine how to display it: as a like,
 * reply, repost, bookmark, RSVP, tag, or plain mention.
 *
 * @see https://indieweb.org/webmention#Display
 */
import type { WebmentionDisplayType } from "./types.js";

/**
 * Parsed microformats2 properties from a source h-entry.
 * This is a simplified view — just the properties needed
 * to determine the webmention display type.
 *
 * @example
 * ```ts
 * const mf2: SourceMf2Entry = {
 *   'like-of': ['https://bob.example/post/2'],
 *   author: [{ name: 'Alice', url: 'https://alice.example' }],
 * };
 * ```
 */
export interface SourceMf2Entry {
  /** The URL(s) this entry is a reply to */
  "in-reply-to"?: string[];
  /** The URL(s) this entry likes */
  "like-of"?: string[];
  /** The URL(s) this entry reposts */
  "repost-of"?: string[];
  /** The URL(s) this entry bookmarks */
  "bookmark-of"?: string[];
  /** The URL(s) this entry tags */
  "tag-of"?: string[];
  /** RSVP value (yes, no, maybe, interested) */
  rsvp?: string[];
  /** Content of the entry */
  content?: Array<string | { html?: string; value?: string }>;
  /** Author h-card(s) */
  author?: Array<string | SourceMf2Author>;
  /** Entry name/title */
  name?: string[];
  /** Entry URL */
  url?: string[];
  /** Published datetime */
  published?: string[];
  /** Entry photo(s) */
  photo?: string[];
}

/**
 * Author data extracted from a source h-card.
 *
 * @example
 * ```ts
 * const author: SourceMf2Author = {
 *   name: 'Alice',
 *   url: 'https://alice.example',
 *   photo: 'https://alice.example/photo.jpg',
 * };
 * ```
 */
export interface SourceMf2Author {
  name?: string;
  url?: string;
  photo?: string;
}

/**
 * Determine the display type for a webmention based on mf2 properties.
 *
 * Checks properties in priority order:
 * 1. `rsvp` → 'rsvp'
 * 2. `repost-of` → 'repost'
 * 3. `like-of` → 'like'
 * 4. `bookmark-of` → 'bookmark'
 * 5. `tag-of` → 'tag'
 * 6. `in-reply-to` → 'reply'
 * 7. fallback → 'mention'
 *
 * The `target` URL is checked against the property values to confirm
 * the interaction is actually directed at the target, not a different URL.
 *
 * @example
 * ```ts
 * const type = detectDisplayType(
 *   { 'like-of': ['https://bob.example/post/2'] },
 *   'https://bob.example/post/2'
 * );
 * // 'like'
 * ```
 */
export function detectDisplayType(
  entry: SourceMf2Entry,
  target: string,
): WebmentionDisplayType {
  const normalizedTarget = target.split("#")[0];

  // RSVP (highest priority — it's also a reply, but RSVP is more specific)
  if (hasProperty(entry.rsvp)) {
    return "rsvp";
  }

  // Repost
  if (propertyMatchesTarget(entry["repost-of"], normalizedTarget)) {
    return "repost";
  }

  // Like
  if (propertyMatchesTarget(entry["like-of"], normalizedTarget)) {
    return "like";
  }

  // Bookmark
  if (propertyMatchesTarget(entry["bookmark-of"], normalizedTarget)) {
    return "bookmark";
  }

  // Tag
  if (propertyMatchesTarget(entry["tag-of"], normalizedTarget)) {
    return "tag";
  }

  // Reply
  if (propertyMatchesTarget(entry["in-reply-to"], normalizedTarget)) {
    return "reply";
  }

  // Default: plain mention
  return "mention";
}

/**
 * Extract the RSVP value from a source h-entry.
 *
 * @example
 * ```ts
 * const value = extractRsvpValue({ rsvp: ['yes'] });
 * // 'yes'
 * ```
 */
export function extractRsvpValue(
  entry: SourceMf2Entry,
): "yes" | "no" | "maybe" | "interested" | undefined {
  if (!entry.rsvp || entry.rsvp.length === 0) return undefined;

  const value = entry.rsvp[0].toLowerCase();
  if (
    value === "yes" ||
    value === "no" ||
    value === "maybe" ||
    value === "interested"
  ) {
    return value;
  }
  return undefined;
}

/**
 * Extract author information from a source h-entry.
 *
 * Handles both string authors (just a name) and full h-card objects.
 *
 * @example
 * ```ts
 * const author = extractAuthor({
 *   author: [{ name: 'Alice', url: 'https://alice.example' }],
 * });
 * // { name: 'Alice', url: 'https://alice.example' }
 * ```
 */
export function extractAuthor(
  entry: SourceMf2Entry,
): SourceMf2Author | undefined {
  if (!entry.author || entry.author.length === 0) return undefined;

  const first = entry.author[0];
  if (typeof first === "string") {
    return { name: first };
  }
  return first;
}

/**
 * Extract the text content from a source h-entry.
 *
 * Prefers the plain text `value` over raw HTML.
 *
 * @example
 * ```ts
 * const text = extractContent({
 *   content: [{ html: '<p>Great post!</p>', value: 'Great post!' }],
 * });
 * // 'Great post!'
 * ```
 */
export function extractContent(entry: SourceMf2Entry): string | undefined {
  if (!entry.content || entry.content.length === 0) return undefined;

  const first = entry.content[0];
  if (typeof first === "string") return first;
  return first.value || first.html;
}

/**
 * Check if a mf2 property array contains a URL matching the target.
 */
function propertyMatchesTarget(
  values: string[] | undefined,
  target: string,
): boolean {
  if (!values || values.length === 0) return false;
  return values.some((v) => v.split("#")[0] === target);
}

/**
 * Check if a property has any values.
 */
function hasProperty(values: unknown[] | undefined): boolean {
  return values !== undefined && values.length > 0;
}
