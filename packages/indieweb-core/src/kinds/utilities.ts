/**
 * Post kind utility functions.
 *
 * Includes lookup helpers and the Post Type Discovery algorithm
 * from https://ptd.spec.indieweb.org/
 *
 * @module
 */

import { POST_KINDS } from "./definitions.js";
import type { PostKindDefinition, PostKindSlug } from "./types.js";

/**
 * Get a post kind definition by slug.
 *
 * @param slug - The kind slug to look up
 * @returns The kind definition, or `undefined` if not found
 *
 * @example
 * ```ts
 * import { getPostKind } from '@opensourcetogether/indieweb-core/kinds';
 *
 * const bookmark = getPostKind('bookmark');
 * // bookmark?.citationRequired === true
 * // bookmark?.mf2Properties === ['u-bookmark-of']
 * ```
 */
export function getPostKind(slug: string): PostKindDefinition | undefined {
  return POST_KINDS[slug as PostKindSlug];
}

/**
 * Get all post kind definitions as an array.
 *
 * @returns Array of all defined post kinds
 *
 * @example
 * ```ts
 * import { getAllPostKinds } from '@opensourcetogether/indieweb-core/kinds';
 *
 * const allKinds = getAllPostKinds();
 * // allKinds.length === 27
 * ```
 */
export function getAllPostKinds(): PostKindDefinition[] {
  return Object.values(POST_KINDS);
}

/**
 * Get all post kind slugs.
 *
 * @returns Array of all defined slugs
 *
 * @example
 * ```ts
 * import { getAllSlugs } from '@opensourcetogether/indieweb-core/kinds';
 *
 * const slugs = getAllSlugs();
 * // slugs includes 'note', 'article', 'reply', ...
 * ```
 */
export function getAllSlugs(): PostKindSlug[] {
  return Object.keys(POST_KINDS) as PostKindSlug[];
}

/**
 * Find all post kinds that use a given mf2 property.
 *
 * @param mf2Property - The mf2 property name (e.g. `"u-in-reply-to"`)
 * @returns Array of matching kind definitions
 *
 * @example
 * ```ts
 * import { getKindsByMf2Property } from '@opensourcetogether/indieweb-core/kinds';
 *
 * const kinds = getKindsByMf2Property('u-in-reply-to');
 * // kinds[0].slug === 'reply'
 * // kinds[1].slug === 'rsvp'
 * ```
 */
export function getKindsByMf2Property(
  mf2Property: string,
): PostKindDefinition[] {
  return getAllPostKinds().filter((kind) =>
    kind.mf2Properties.includes(mf2Property),
  );
}

/**
 * Get all post kinds that require a URL citation.
 *
 * @returns Array of kind definitions where `citationRequired` is true
 *
 * @example
 * ```ts
 * import { getCitationKinds } from '@opensourcetogether/indieweb-core/kinds';
 *
 * const kinds = getCitationKinds();
 * // ['reply', 'like', 'repost', 'bookmark', 'rsvp', 'review', 'tag-reply', 'quotation']
 * ```
 */
export function getCitationKinds(): PostKindDefinition[] {
  return getAllPostKinds().filter((kind) => kind.citationRequired);
}

/**
 * Check whether a string is a valid post kind slug.
 *
 * @param slug - The string to check
 * @returns `true` if the slug matches a defined post kind
 *
 * @example
 * ```ts
 * import { isValidSlug } from '@opensourcetogether/indieweb-core/kinds';
 *
 * isValidSlug('note')    // true
 * isValidSlug('unknown') // false
 * ```
 */
export function isValidSlug(slug: string): slug is PostKindSlug {
  return slug in POST_KINDS;
}

// ── Post Type Discovery ──────────────────────────────────────────────

/**
 * Minimal mf2 JSON structure for post type discovery.
 *
 * Mirrors the flat property map from a parsed h-entry/h-event.
 * Values are arrays of strings (as mf2 JSON uses), but single
 * strings are also accepted for convenience.
 */
export interface Mf2Properties {
  /** The mf2 type array (e.g. `['h-event']`) */
  type?: string[];
  name?: string[] | string;
  content?: Array<string | { html?: string; value?: string }> | string;
  summary?: string[] | string;
  rsvp?: string[] | string;
  "in-reply-to"?: string[] | string;
  "repost-of"?: string[] | string;
  "like-of"?: string[] | string;
  "bookmark-of"?: string[] | string;
  checkin?: string[] | string;
  video?: string[] | string;
  photo?: string[] | string;
  audio?: string[] | string;
  "listen-of"?: string[] | string;
  "watch-of"?: string[] | string;
  "read-of"?: string[] | string;
  "quotation-of"?: string[] | string;
  "tag-of"?: string[] | string;
}

/** A parsed mf2 item with type and properties. */
export interface Mf2Item {
  type?: string[];
  properties: Mf2Properties;
}

/**
 * Discover the post type from an mf2 parsed item.
 *
 * Implements the Post Type Discovery algorithm from
 * https://ptd.spec.indieweb.org/ with extensions for proposed
 * properties (listen-of, watch-of, read-of, bookmark-of, checkin,
 * quotation-of, tag-of).
 *
 * @param item - A parsed mf2 item (e.g. from a microformats2 parser)
 * @returns The discovered post kind slug
 *
 * @example
 * ```ts
 * import { discoverPostType } from '@opensourcetogether/indieweb-core/kinds';
 *
 * const type = discoverPostType({
 *   type: ['h-entry'],
 *   properties: {
 *     'in-reply-to': ['https://example.com/post'],
 *     content: ['Great post!'],
 *   },
 * });
 * // type === 'reply'
 * ```
 */
export function discoverPostType(item: Mf2Item): PostKindSlug {
  const props = item.properties;

  // Step 1: If the post is an h-event
  if (item.type?.includes("h-event")) {
    return "event";
  }

  // Step 2: RSVP
  if (hasValidValue(props.rsvp)) {
    return "rsvp";
  }

  // Step 3: Repost
  if (hasValidUrl(props["repost-of"])) {
    return "repost";
  }

  // Step 4: Like
  if (hasValidUrl(props["like-of"])) {
    return "like";
  }

  // Step 5: Bookmark (proposed, checked before reply per convention)
  if (hasValidUrl(props["bookmark-of"])) {
    return "bookmark";
  }

  // Step 6: Quotation (proposed)
  if (hasValidUrl(props["quotation-of"])) {
    return "quotation";
  }

  // Step 7: Tag reply (proposed) — has tag-of AND in-reply-to
  if (hasValidUrl(props["tag-of"]) && hasValidUrl(props["in-reply-to"])) {
    return "tag-reply";
  }

  // Step 8: Reply
  if (hasValidUrl(props["in-reply-to"])) {
    return "reply";
  }

  // Step 9: Checkin (proposed)
  if (hasValidUrl(props.checkin)) {
    return "checkin";
  }

  // Extended: Listen (proposed, scrobble)
  if (hasValidUrl(props["listen-of"])) {
    return "listen";
  }

  // Extended: Watch (proposed)
  if (hasValidUrl(props["watch-of"])) {
    return "watch";
  }

  // Extended: Read (proposed)
  if (hasValidValue(props["read-of"])) {
    return "read";
  }

  // Step 10: Video
  if (hasValidUrl(props.video)) {
    return "video";
  }

  // Step 11: Photo
  if (hasValidUrl(props.photo)) {
    return "photo";
  }

  // Step 12: Audio (proposed)
  if (hasValidUrl(props.audio)) {
    return "audio";
  }

  // Steps 13-14: Determine note vs article based on name
  const contentText = extractContentText(props);
  const nameText = extractFirstString(props.name);

  // If no name, or name is empty → note
  if (!nameText) {
    return "note";
  }

  // If name is NOT a prefix of content (after collapsing whitespace) → article
  if (contentText) {
    const normalizedName = collapseWhitespace(nameText);
    const normalizedContent = collapseWhitespace(contentText);
    if (!normalizedContent.startsWith(normalizedName)) {
      return "article";
    }
  }

  // Default: note
  return "note";
}

// ── Internal helpers ─────────────────────────────────────────────────

function hasValidUrl(value: string[] | string | undefined): boolean {
  const first = extractFirstString(value);
  return first !== undefined && first.length > 0;
}

function hasValidValue(value: string[] | string | undefined): boolean {
  const first = extractFirstString(value);
  return first !== undefined && first.length > 0;
}

function extractFirstString(
  value:
    | string[]
    | string
    | Array<string | { html?: string; value?: string }>
    | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "string") return first;
    if (typeof first === "object" && first !== null && "value" in first) {
      return first.value;
    }
  }
  return undefined;
}

function extractContentText(props: Mf2Properties): string | undefined {
  // Try content first, then summary
  if (props.content !== undefined) {
    const val = extractFirstString(props.content as string[] | string);
    if (val) return val;

    // mf2 content can be {html, value} objects
    if (Array.isArray(props.content) && props.content.length > 0) {
      const first = props.content[0];
      if (typeof first === "object" && first !== null && "value" in first) {
        return first.value;
      }
    }
  }
  return extractFirstString(props.summary);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
