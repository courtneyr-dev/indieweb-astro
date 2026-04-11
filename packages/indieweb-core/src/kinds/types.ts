/**
 * Post kind type definitions.
 *
 * Each post kind describes a content intent (note, reply, bookmark, etc.)
 * and maps it to the correct microformats2 properties and field requirements.
 *
 * @see https://indieweb.org/post-type-discovery
 * @module
 */

/** The mf2 root class for a post kind. Most use h-entry. */
export type Mf2Root = "h-entry" | "h-event" | "h-review" | "h-recipe";

/**
 * Defines a single post kind with its metadata, mf2 property mappings,
 * and field requirements.
 */
export interface PostKindDefinition {
  /** Machine name (e.g. `"note"`, `"bookmark"`, `"listen"`) */
  slug: string;
  /** Human-readable display name */
  name: string;
  /** Icon identifier — consumers map this to their icon library */
  icon: string;
  /** The mf2 root class this kind uses (defaults to `h-entry` for most) */
  mf2Root: Mf2Root;
  /** Which mf2 property names this kind uses (e.g. `["u-in-reply-to"]`) */
  mf2Properties: string[];
  /** Fields the user must provide for this kind to be valid */
  requiredFields: string[];
  /** Additional fields the user may provide */
  optionalFields: string[];
  /** Whether a URL citation (the thing being responded to) is required */
  citationRequired: boolean;
}

/** A post kind slug — the union of all defined kind slugs. */
export type PostKindSlug =
  | "note"
  | "article"
  | "photo"
  | "video"
  | "audio"
  | "reply"
  | "like"
  | "repost"
  | "bookmark"
  | "rsvp"
  | "checkin"
  | "listen"
  | "watch"
  | "read"
  | "play"
  | "eat"
  | "drink"
  | "chat"
  | "event"
  | "review"
  | "recipe"
  | "favorite"
  | "jam"
  | "wish"
  | "mood"
  | "acquisition"
  | "tag-reply"
  | "quotation";
