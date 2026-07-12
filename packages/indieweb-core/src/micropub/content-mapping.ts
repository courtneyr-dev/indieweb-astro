/**
 * Micropub → post-field mapping.
 *
 * Converts a parsed Micropub create request into the flat, snake_case
 * field record used by the EmDash posts collection (and by any store
 * with the same IndieWeb citation-field shape). Pure data mapping —
 * no I/O, no CMS coupling beyond the field naming convention.
 *
 * @see https://micropub.spec.indieweb.org/
 */
import type {
  MicropubCreateRequest,
  MicropubHtmlContent,
  MicropubMediaObject,
} from "./types.js";

/**
 * A Portable Text block (minimal shape used for plain-text content).
 */
export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style: "normal";
  markDefs: never[];
  children: Array<{
    _type: "span";
    _key: string;
    text: string;
    marks: never[];
  }>;
}

/**
 * Result of mapping a Micropub create request to post fields.
 */
export interface MappedPost {
  /** Flat snake_case field record for the content store. */
  fields: Record<string, unknown>;
  /** Explicit slug, present only when the post has no title to derive one from. */
  slug?: string;
  /** Post status derived from `post-status` (defaults to "published"). */
  status: "published" | "draft";
  /** Category/tag names from the `category` property. */
  categories: string[];
  /** Requested syndication target UIDs from `mp-syndicate-to`. */
  syndicateTo: string[];
}

const KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomKey(length = 8): string {
  let key = "";
  for (let i = 0; i < length; i++) {
    key += KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)];
  }
  return key;
}

/**
 * Convert plain text to Portable Text blocks (one block per
 * blank-line-separated paragraph).
 *
 * @example
 * ```ts
 * const blocks = textToPortableText("Hello\n\nWorld");
 * // two blocks, each with one span
 * ```
 */
export function textToPortableText(text: string): PortableTextBlock[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const source = paragraphs.length > 0 ? paragraphs : [text.trim()];
  return source.map((paragraph) => ({
    _type: "block" as const,
    _key: randomKey(),
    style: "normal" as const,
    markDefs: [],
    children: [
      {
        _type: "span" as const,
        _key: randomKey(),
        text: paragraph,
        marks: [],
      },
    ],
  }));
}

function firstString(values: unknown[] | undefined): string | undefined {
  if (!values) return undefined;
  const first = values.find((v) => typeof v === "string" && v.trim());
  return typeof first === "string" ? first.trim() : undefined;
}

function contentToText(
  values: Array<string | MicropubHtmlContent> | undefined,
): string {
  if (!values || values.length === 0) return "";
  const first = values[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "html" in first) {
    // HTML content: strip tags for the Portable Text representation.
    return first.html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function mediaUrls(
  values: Array<string | MicropubMediaObject> | undefined,
): string[] {
  if (!values) return [];
  return values
    .map((v) => (typeof v === "string" ? v : v?.value))
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * Derive a URL-safe slug from text (first six words, lowercased).
 * @internal
 */
function slugFromText(text: string, maxWords = 6): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, maxWords)
    .join("-");
}

/**
 * Map a Micropub create request to EmDash post fields.
 *
 * Citation URLs map to their snake_case fields (`in_reply_to`,
 * `like_of`, ...), text content becomes Portable Text, and
 * lifelog/extra properties (photo, location) land in `kind_meta`.
 * Post kind is left unset — the CMS `content:beforeSave` hook
 * auto-detects it from the citation fields.
 *
 * @example
 * ```ts
 * const mapped = mapMicropubToPostFields({
 *   type: ["h-entry"],
 *   properties: { content: ["Hello world"], category: ["indieweb"] },
 * });
 * // mapped.fields.content is Portable Text; mapped.status === "published"
 * ```
 */
export function mapMicropubToPostFields(
  request: MicropubCreateRequest,
): MappedPost {
  const props = request.properties;
  const fields: Record<string, unknown> = {};

  const title = firstString(props.name);
  if (title) fields.title = title;

  const text = contentToText(props.content);
  if (text) fields.content = textToPortableText(text);

  const summary = firstString(props.summary);
  if (summary) fields.excerpt = summary;

  const citationMap: Array<[keyof typeof props & string, string]> = [
    ["in-reply-to", "in_reply_to"],
    ["like-of", "like_of"],
    ["repost-of", "repost_of"],
    ["bookmark-of", "bookmark_of"],
    ["quotation-of", "quotation_of"],
  ];
  for (const [mf2Key, fieldKey] of citationMap) {
    const value = firstString(props[mf2Key] as string[] | undefined);
    if (value) fields[fieldKey] = value;
  }

  const rsvp = firstString(props.rsvp as string[] | undefined);
  if (rsvp) fields.rsvp = rsvp;

  const kindMeta: Record<string, unknown> = {};
  const photos = mediaUrls(props.photo);
  if (photos.length > 0) kindMeta.photos = photos;
  const videos = mediaUrls(props.video);
  if (videos.length > 0) kindMeta.videos = videos;
  const audio = mediaUrls(props.audio);
  if (audio.length > 0) kindMeta.audio = audio;
  const location = firstString(props.location);
  if (location) kindMeta.location = location;

  const categories = (props.category ?? []).filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );
  if (categories.length > 0) kindMeta.categories = categories;
  if (Object.keys(kindMeta).length > 0) fields.kind_meta = kindMeta;

  const syndicateTo = (props["mp-syndicate-to"] ?? []).filter(
    (t): t is string => typeof t === "string" && t.length > 0,
  );
  const existingSyndication = (props.syndication ?? []).filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  if (syndicateTo.length > 0 || existingSyndication.length > 0) {
    fields.syndication = {
      targets: syndicateTo,
      links: existingSyndication.map((url) => ({ url })),
    };
  }

  const status =
    firstString(props["post-status"] as string[] | undefined) === "draft"
      ? ("draft" as const)
      : ("published" as const);

  // Slug: explicit mp-slug wins; otherwise only title-less posts need
  // one generated here (the CMS derives slugs from titles).
  let slug = firstString(props["mp-slug"] as string[] | undefined);
  if (!slug && !title) {
    const base = slugFromText(text) || "note";
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 14);
    slug = `${base}-${stamp}`;
  }

  return {
    fields,
    slug,
    status,
    categories,
    syndicateTo,
  };
}
