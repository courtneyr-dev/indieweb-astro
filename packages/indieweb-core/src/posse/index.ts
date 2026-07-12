/**
 * POSSE (Publish on your Own Site, Syndicate Elsewhere) types.
 *
 * Data definitions for syndication targets, syndication links,
 * and backfeed references.
 *
 * @see https://indieweb.org/POSSE
 *
 * @example
 * ```ts
 * import type { SyndicationTarget, SyndicationLink } from "@opensourcetogether/indieweb-core/posse";
 * ```
 */

/**
 * A POSSE syndication target — a service you publish copies to.
 *
 * @example
 * ```ts
 * const target: SyndicationTarget = {
 *   uid: "https://brid.gy/publish/mastodon",
 *   name: "Mastodon via Bridgy",
 *   service: { name: "Mastodon", url: "https://mastodon.social" },
 * };
 * ```
 */
export interface SyndicationTarget {
  /** Unique identifier URL for this target */
  uid: string;
  /** Human-readable name */
  name: string;
  /** Service information */
  service?: {
    name: string;
    url: string;
    photo?: string;
  };
  /** Your account on the service */
  user?: {
    name: string;
    url: string;
    photo?: string;
  };
  /** Whether this target is currently enabled */
  enabled?: boolean;
}

/**
 * A syndication link — records where a post was syndicated to.
 *
 * Stored alongside post content so the original knows about its copies.
 *
 * @example
 * ```ts
 * const link: SyndicationLink = {
 *   targetUid: "https://brid.gy/publish/mastodon",
 *   syndicatedUrl: "https://mastodon.social/@user/123456",
 *   syndicatedAt: "2024-01-15T10:30:00Z",
 * };
 * ```
 */
export interface SyndicationLink {
  /** The syndication target this was published to */
  targetUid: string;
  /** URL of the syndicated copy */
  syndicatedUrl: string;
  /** When the syndication occurred */
  syndicatedAt: string;
}

/**
 * A backfeed reference — a response from a syndicated copy
 * that should be pulled back as a webmention.
 *
 * @example
 * ```ts
 * const backfeed: BackfeedLink = {
 *   sourceUrl: "https://mastodon.social/@other/789",
 *   originalPostUrl: "https://mysite.com/post/1",
 *   type: "reply",
 * };
 * ```
 */
export interface BackfeedLink {
  /** URL of the response on the silo */
  sourceUrl: string;
  /** URL of the original post on your site */
  originalPostUrl: string;
  /** Type of interaction */
  type: "like" | "reply" | "repost" | "mention";
  /** When the backfeed was received */
  receivedAt?: string;
}

/**
 * POSSE configuration for a site.
 *
 * @example
 * ```ts
 * const config: POSSEConfig = {
 *   targets: [
 *     { uid: "https://brid.gy/publish/mastodon", name: "Mastodon" },
 *   ],
 *   autoSyndicate: true,
 * };
 * ```
 */
export interface POSSEConfig {
  /** Available syndication targets */
  targets: SyndicationTarget[];
  /** Whether to auto-syndicate new published posts */
  autoSyndicate?: boolean;
}

// Bridgy Publish execution helpers
export {
  BRIDGY_WEBMENTION_ENDPOINT,
  BRIDGY_SILOS,
  isBridgyPublishTarget,
  parseBridgyResponse,
} from "./bridgy.js";
export type { BridgyPublishResult } from "./bridgy.js";
