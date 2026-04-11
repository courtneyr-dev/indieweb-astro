/**
 * Microformats2 h-entry builder.
 *
 * Generates the CSS class names and property mappings needed to render
 * a valid h-entry. Framework-agnostic — returns data, not HTML.
 *
 * @see https://microformats.org/wiki/h-entry
 * @module
 */

// ── Input types ──────────────────────────────────────────────────────

/** Data accepted by {@link buildHEntry}. All fields are optional. */
export interface HEntryData {
  /** Post title */
  name?: string;
  /** Short summary */
  summary?: string;
  /** Full content (may contain HTML) */
  content?: string;
  /** Plain-text version of content (used alongside HTML content) */
  contentValue?: string;
  /** Publication date in ISO 8601 format */
  published?: string;
  /** Last-updated date in ISO 8601 format */
  updated?: string;
  /** Author URL or name */
  author?: string;
  /** Permalink URL of the entry */
  url?: string;
  /** Universally unique identifier (typically the canonical URL) */
  uid?: string;
  /** Categories or tags */
  category?: string[];
  /** URLs of syndicated copies */
  syndication?: string[];
  /** URL this entry is a reply to */
  inReplyTo?: string;
  /** URL this entry is a "like" of */
  likeOf?: string;
  /** URL this entry is a bookmark of */
  bookmarkOf?: string;
  /** URL this entry is a repost of */
  repostOf?: string;
  /** RSVP response */
  rsvp?: "yes" | "no" | "maybe" | "interested";
  /** Photo URL(s) */
  photo?: string | string[];
  /** Video URL(s) */
  video?: string | string[];
}

// ── Output types ─────────────────────────────────────────────────────

/**
 * A single mf2 property mapping.
 *
 * `className` is the mf2 class to place on the HTML element.
 * `value` is the data to render inside or as an attribute.
 * `attributes` holds suggested HTML attributes (e.g. `href`, `datetime`).
 */
export interface Mf2Property {
  /** Microformats2 class name (e.g. `"p-name"`, `"u-url"`, `"dt-published"`) */
  className: string;
  /** The property value */
  value: string;
  /** Suggested HTML attributes for the element rendering this property */
  attributes?: Record<string, string>;
}

/** Output of {@link buildHEntry}. */
export interface HEntryOutput {
  /** CSS class(es) for the root container element */
  rootClassName: string;
  /** Mapped mf2 properties, keyed by semantic name */
  properties: {
    name?: Mf2Property;
    summary?: Mf2Property;
    content?: Mf2Property;
    published?: Mf2Property;
    updated?: Mf2Property;
    author?: Mf2Property;
    url?: Mf2Property;
    uid?: Mf2Property;
    category?: Mf2Property[];
    syndication?: Mf2Property[];
    inReplyTo?: Mf2Property;
    likeOf?: Mf2Property;
    bookmarkOf?: Mf2Property;
    repostOf?: Mf2Property;
    rsvp?: Mf2Property;
    photo?: Mf2Property[];
    video?: Mf2Property[];
  };
}

// ── Builder ──────────────────────────────────────────────────────────

/**
 * Build mf2 class names and property mappings for an h-entry.
 *
 * Returns an object a renderer can consume to produce valid
 * microformats2-marked-up HTML on any framework.
 *
 * @param data - Post data to convert into mf2 properties
 * @returns Object with `rootClassName` and `properties`
 *
 * @example
 * ```ts
 * import { buildHEntry } from '@opensourcetogether/indieweb-core/mf2';
 *
 * const entry = buildHEntry({
 *   name: 'Hello World',
 *   content: '<p>My first post.</p>',
 *   published: '2026-04-10T12:00:00Z',
 *   category: ['indieweb', 'intro'],
 *   url: 'https://example.com/hello',
 * });
 *
 * // entry.rootClassName === 'h-entry'
 * // entry.properties.name?.className === 'p-name'
 * // entry.properties.published?.attributes?.datetime === '2026-04-10T12:00:00Z'
 * ```
 */
export function buildHEntry(data: HEntryData): HEntryOutput {
  const properties: HEntryOutput["properties"] = {};

  if (data.name !== undefined) {
    properties.name = { className: "p-name", value: data.name };
  }

  if (data.summary !== undefined) {
    properties.summary = { className: "p-summary", value: data.summary };
  }

  if (data.content !== undefined) {
    properties.content = {
      className: "e-content",
      value: data.contentValue ?? data.content,
      attributes: { html: data.content },
    };
  }

  if (data.published !== undefined) {
    properties.published = {
      className: "dt-published",
      value: data.published,
      attributes: { datetime: data.published },
    };
  }

  if (data.updated !== undefined) {
    properties.updated = {
      className: "dt-updated",
      value: data.updated,
      attributes: { datetime: data.updated },
    };
  }

  if (data.author !== undefined) {
    properties.author = {
      className: "p-author",
      value: data.author,
      attributes: isUrl(data.author) ? { href: data.author } : undefined,
    };
  }

  if (data.url !== undefined) {
    properties.url = {
      className: "u-url",
      value: data.url,
      attributes: { href: data.url },
    };
  }

  if (data.uid !== undefined) {
    properties.uid = {
      className: "u-uid",
      value: data.uid,
      attributes: { href: data.uid },
    };
  }

  if (data.category !== undefined && data.category.length > 0) {
    properties.category = data.category.map((cat) => ({
      className: "p-category",
      value: cat,
    }));
  }

  if (data.syndication !== undefined && data.syndication.length > 0) {
    properties.syndication = data.syndication.map((url) => ({
      className: "u-syndication",
      value: url,
      attributes: { href: url },
    }));
  }

  if (data.inReplyTo !== undefined) {
    properties.inReplyTo = {
      className: "u-in-reply-to",
      value: data.inReplyTo,
      attributes: { href: data.inReplyTo },
    };
  }

  if (data.likeOf !== undefined) {
    properties.likeOf = {
      className: "u-like-of",
      value: data.likeOf,
      attributes: { href: data.likeOf },
    };
  }

  if (data.bookmarkOf !== undefined) {
    properties.bookmarkOf = {
      className: "u-bookmark-of",
      value: data.bookmarkOf,
      attributes: { href: data.bookmarkOf },
    };
  }

  if (data.repostOf !== undefined) {
    properties.repostOf = {
      className: "u-repost-of",
      value: data.repostOf,
      attributes: { href: data.repostOf },
    };
  }

  if (data.rsvp !== undefined) {
    properties.rsvp = {
      className: "p-rsvp",
      value: data.rsvp,
    };
  }

  if (data.photo !== undefined) {
    const urls = Array.isArray(data.photo) ? data.photo : [data.photo];
    if (urls.length > 0) {
      properties.photo = urls.map((url) => ({
        className: "u-photo",
        value: url,
        attributes: { src: url },
      }));
    }
  }

  if (data.video !== undefined) {
    const urls = Array.isArray(data.video) ? data.video : [data.video];
    if (urls.length > 0) {
      properties.video = urls.map((url) => ({
        className: "u-video",
        value: url,
        attributes: { src: url },
      }));
    }
  }

  return { rootClassName: "h-entry", properties };
}

/** Check whether a string looks like a URL. */
function isUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}
