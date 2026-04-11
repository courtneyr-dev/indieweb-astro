/**
 * All post kind definitions.
 *
 * Ported from the Post Kinds for IndieWeb WordPress plugin.
 * Each definition maps a content intent to its mf2 properties and fields.
 *
 * @module
 */

import type { PostKindDefinition, PostKindSlug } from "./types.js";

/**
 * Registry of all post kind definitions, keyed by slug.
 *
 * @example
 * ```ts
 * import { POST_KINDS } from '@opensourcetogether/indieweb-core/kinds';
 *
 * const reply = POST_KINDS.reply;
 * // reply.mf2Properties === ['u-in-reply-to']
 * // reply.citationRequired === true
 * ```
 */
export const POST_KINDS: Record<PostKindSlug, PostKindDefinition> = {
  // ── Simple content kinds ───────────────────────────────────────────

  note: {
    slug: "note",
    name: "Note",
    icon: "message-square",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["content"],
    optionalFields: ["photo", "video", "category"],
    citationRequired: false,
  },

  article: {
    slug: "article",
    name: "Article",
    icon: "file-text",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["name", "content"],
    optionalFields: ["summary", "photo", "category"],
    citationRequired: false,
  },

  photo: {
    slug: "photo",
    name: "Photo",
    icon: "image",
    mf2Root: "h-entry",
    mf2Properties: ["u-photo"],
    requiredFields: ["photo"],
    optionalFields: ["content", "category"],
    citationRequired: false,
  },

  video: {
    slug: "video",
    name: "Video",
    icon: "video",
    mf2Root: "h-entry",
    mf2Properties: ["u-video"],
    requiredFields: ["video"],
    optionalFields: ["content", "photo", "category"],
    citationRequired: false,
  },

  audio: {
    slug: "audio",
    name: "Audio",
    icon: "headphones",
    mf2Root: "h-entry",
    mf2Properties: ["u-audio"],
    requiredFields: ["audio"],
    optionalFields: ["content", "category"],
    citationRequired: false,
  },

  // ── Response / interaction kinds ───────────────────────────────────

  reply: {
    slug: "reply",
    name: "Reply",
    icon: "reply",
    mf2Root: "h-entry",
    mf2Properties: ["u-in-reply-to"],
    requiredFields: ["content", "inReplyTo"],
    optionalFields: ["category"],
    citationRequired: true,
  },

  like: {
    slug: "like",
    name: "Like",
    icon: "heart",
    mf2Root: "h-entry",
    mf2Properties: ["u-like-of"],
    requiredFields: ["likeOf"],
    optionalFields: ["content", "category"],
    citationRequired: true,
  },

  repost: {
    slug: "repost",
    name: "Repost",
    icon: "repeat",
    mf2Root: "h-entry",
    mf2Properties: ["u-repost-of"],
    requiredFields: ["repostOf"],
    optionalFields: ["content", "category"],
    citationRequired: true,
  },

  bookmark: {
    slug: "bookmark",
    name: "Bookmark",
    icon: "bookmark",
    mf2Root: "h-entry",
    mf2Properties: ["u-bookmark-of"],
    requiredFields: ["bookmarkOf"],
    optionalFields: ["name", "content", "category"],
    citationRequired: true,
  },

  rsvp: {
    slug: "rsvp",
    name: "RSVP",
    icon: "calendar-check",
    mf2Root: "h-entry",
    mf2Properties: ["u-in-reply-to", "p-rsvp"],
    requiredFields: ["inReplyTo", "rsvp"],
    optionalFields: ["content", "category"],
    citationRequired: true,
  },

  // ── Location kind ──────────────────────────────────────────────────

  checkin: {
    slug: "checkin",
    name: "Check-in",
    icon: "map-pin",
    mf2Root: "h-entry",
    mf2Properties: ["u-checkin"],
    requiredFields: ["checkinName"],
    optionalFields: [
      "content",
      "checkinUrl",
      "checkinAddress",
      "checkinLocality",
      "checkinRegion",
      "checkinCountry",
      "latitude",
      "longitude",
      "photo",
      "category",
    ],
    citationRequired: false,
  },

  // ── Life-logging kinds ─────────────────────────────────────────────

  listen: {
    slug: "listen",
    name: "Listen",
    icon: "music",
    mf2Root: "h-entry",
    mf2Properties: ["u-listen-of"],
    requiredFields: ["listenTrack"],
    optionalFields: [
      "listenArtist",
      "listenAlbum",
      "listenCover",
      "listenUrl",
      "listenMbid",
      "listenRating",
      "content",
      "category",
    ],
    citationRequired: false,
  },

  watch: {
    slug: "watch",
    name: "Watch",
    icon: "tv",
    mf2Root: "h-entry",
    mf2Properties: ["u-watch-of"],
    requiredFields: ["watchTitle"],
    optionalFields: [
      "watchYear",
      "watchPoster",
      "watchTmdbId",
      "watchImdbId",
      "watchStatus",
      "watchRating",
      "watchReview",
      "watchMediaType",
      "watchDirector",
      "watchSeason",
      "watchEpisode",
      "watchEpisodeTitle",
      "content",
      "category",
    ],
    citationRequired: false,
  },

  read: {
    slug: "read",
    name: "Read",
    icon: "book-open",
    mf2Root: "h-entry",
    mf2Properties: ["p-read-of"],
    requiredFields: ["readTitle"],
    optionalFields: [
      "readAuthor",
      "readIsbn",
      "readCover",
      "readStatus",
      "readProgress",
      "readPages",
      "readUrl",
      "readPublisher",
      "readRating",
      "readStartedAt",
      "readFinishedAt",
      "readReview",
      "content",
      "category",
    ],
    citationRequired: false,
  },

  play: {
    slug: "play",
    name: "Play",
    icon: "gamepad-2",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["playTitle"],
    optionalFields: [
      "playPlatform",
      "playStatus",
      "playHours",
      "playCover",
      "playRating",
      "playReview",
      "playUrl",
      "content",
      "category",
    ],
    citationRequired: false,
  },

  eat: {
    slug: "eat",
    name: "Eat",
    icon: "utensils",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["eatName"],
    optionalFields: [
      "eatType",
      "eatPhoto",
      "eatRating",
      "eatLocationName",
      "eatLocationLocality",
      "eatCuisine",
      "eatNotes",
      "content",
      "category",
    ],
    citationRequired: false,
  },

  drink: {
    slug: "drink",
    name: "Drink",
    icon: "coffee",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["drinkName"],
    optionalFields: [
      "drinkType",
      "drinkBrewery",
      "drinkPhoto",
      "drinkRating",
      "drinkLocationName",
      "drinkLocationLocality",
      "drinkNotes",
      "content",
      "category",
    ],
    citationRequired: false,
  },

  chat: {
    slug: "chat",
    name: "Chat",
    icon: "messages-square",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["content"],
    optionalFields: ["category"],
    citationRequired: false,
  },

  // ── Non-h-entry kinds ──────────────────────────────────────────────

  event: {
    slug: "event",
    name: "Event",
    icon: "calendar",
    mf2Root: "h-event",
    mf2Properties: [
      "dt-start",
      "dt-end",
      "dt-duration",
      "p-location",
      "p-description",
    ],
    requiredFields: ["name", "eventStart"],
    optionalFields: [
      "eventEnd",
      "eventDuration",
      "eventLocation",
      "eventUrl",
      "content",
      "category",
    ],
    citationRequired: false,
  },

  review: {
    slug: "review",
    name: "Review",
    icon: "star",
    mf2Root: "h-review",
    mf2Properties: ["p-rating", "p-best", "p-worst", "p-item", "e-content"],
    requiredFields: ["reviewItemName", "reviewRating"],
    optionalFields: [
      "reviewItemUrl",
      "reviewBest",
      "reviewWorst",
      "content",
      "category",
    ],
    citationRequired: true,
  },

  recipe: {
    slug: "recipe",
    name: "Recipe",
    icon: "chef-hat",
    mf2Root: "h-recipe",
    mf2Properties: [
      "p-ingredient",
      "p-yield",
      "e-instructions",
      "dt-duration",
      "u-photo",
    ],
    requiredFields: ["name", "content"],
    optionalFields: [
      "recipeIngredient",
      "recipeYield",
      "recipeDuration",
      "recipeNutrition",
      "photo",
      "summary",
      "category",
    ],
    citationRequired: false,
  },

  // ── Extended life-logging kinds ────────────────────────────────────

  favorite: {
    slug: "favorite",
    name: "Favorite",
    icon: "star",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["favoriteName"],
    optionalFields: ["favoriteUrl", "favoriteRating", "content", "category"],
    citationRequired: false,
  },

  jam: {
    slug: "jam",
    name: "Jam",
    icon: "disc",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["jamTrack"],
    optionalFields: [
      "jamArtist",
      "jamAlbum",
      "jamCover",
      "jamUrl",
      "content",
      "category",
    ],
    citationRequired: false,
  },

  wish: {
    slug: "wish",
    name: "Wish",
    icon: "gift",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["wishName"],
    optionalFields: [
      "wishUrl",
      "wishPhoto",
      "wishType",
      "wishPriority",
      "content",
      "category",
    ],
    citationRequired: false,
  },

  mood: {
    slug: "mood",
    name: "Mood",
    icon: "smile",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["moodLabel"],
    optionalFields: ["moodEmoji", "moodRating", "content", "category"],
    citationRequired: false,
  },

  acquisition: {
    slug: "acquisition",
    name: "Acquisition",
    icon: "package",
    mf2Root: "h-entry",
    mf2Properties: [],
    requiredFields: ["acquisitionName"],
    optionalFields: [
      "acquisitionUrl",
      "acquisitionPhoto",
      "acquisitionPrice",
      "acquisitionRating",
      "content",
      "category",
    ],
    citationRequired: false,
  },

  // ── Response variant kinds ─────────────────────────────────────────

  "tag-reply": {
    slug: "tag-reply",
    name: "Tag Reply",
    icon: "tag",
    mf2Root: "h-entry",
    mf2Properties: ["u-tag-of", "u-in-reply-to"],
    requiredFields: ["tagOf", "inReplyTo"],
    optionalFields: ["summary", "category"],
    citationRequired: true,
  },

  quotation: {
    slug: "quotation",
    name: "Quotation",
    icon: "quote",
    mf2Root: "h-entry",
    mf2Properties: ["u-quotation-of"],
    requiredFields: ["quotationOf", "content"],
    optionalFields: ["name", "category"],
    citationRequired: true,
  },
};
