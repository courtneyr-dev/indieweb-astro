/**
 * EmDash IndieWeb Plugin — Descriptor Factory
 *
 * Returns a PluginDescriptor for registration in astro.config.mjs.
 * The actual runtime logic lives in sandbox-entry.ts.
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import { emdashIndieweb } from "@opensourcetogether/emdash-indieweb";
 *
 * export default defineConfig({
 *   integrations: [
 *     emdash({
 *       plugins: [emdashIndieweb({
 *         siteUrl: "https://mysite.com",
 *         author: { name: "Courtney Robertson", url: "https://courtneyr.dev" },
 *       })],
 *     }),
 *   ],
 * });
 * ```
 */
import type { PluginDescriptor } from "emdash";

/**
 * Configuration options for the IndieWeb plugin.
 *
 * @example
 * ```ts
 * const config: IndiewebPluginOptions = {
 *   siteUrl: "https://mysite.com",
 *   author: { name: "Courtney Robertson", url: "https://courtneyr.dev" },
 * };
 * ```
 */
export interface IndiewebPluginOptions {
  /** The site's canonical URL */
  siteUrl?: string;
  /** Default author for h-card and webmentions */
  author?: {
    name: string;
    url?: string;
    photo?: string;
  };
}

/**
 * Create the EmDash IndieWeb plugin descriptor.
 *
 * Provides webmention receiving/sending, h-card settings,
 * and POSSE syndication configuration via the EmDash admin.
 *
 * @example
 * ```ts
 * import { emdashIndieweb } from "@opensourcetogether/emdash-indieweb";
 *
 * emdashIndieweb({
 *   siteUrl: "https://mysite.com",
 *   author: { name: "Courtney Robertson" },
 * });
 * ```
 */
export function emdashIndieweb(
  options?: IndiewebPluginOptions,
): PluginDescriptor {
  return {
    id: "indieweb",
    version: "0.1.0",
    format: "standard",
    entrypoint: "@opensourcetogether/emdash-indieweb/sandbox",
    capabilities: [
      "content:read",
      "content:write",
      "network:request:unrestricted",
    ],
    allowedHosts: ["*"],
    storage: {
      // Document id is `${source}::${target}` so the pair is unique by
      // construction; no uniqueIndexes (string[] means one constraint per
      // column, which would wrongly reject one source mentioning two targets).
      webmentions: {
        indexes: ["source", "target", "type", "verified", "receivedAt"],
      },
      // IndieAuth server state. Document ids are SHA-256 hashes of the
      // secrets (codes/tokens), so plaintext secrets are never stored.
      indieauth_codes: {
        indexes: ["clientId", "expiresAt"],
      },
      indieauth_tokens: {
        indexes: ["clientId", "expiresAt"],
      },
      // Pending authorization transactions for the consent screen.
      indieauth_txns: {
        indexes: ["expiresAt"],
      },
    },
    adminPages: [
      {
        path: "/webmentions",
        label: "Webmentions",
        icon: "message-circle",
      },
      {
        path: "/identity",
        label: "Identity (h-card)",
        icon: "user",
      },
      {
        path: "/post-kinds",
        label: "Post Kinds",
        icon: "file-text",
      },
      {
        path: "/syndication",
        label: "Syndication (POSSE)",
        icon: "share-2",
      },
      {
        path: "/relationships",
        label: "Relationships (XFN)",
        icon: "users",
      },
      {
        path: "/api-connections",
        label: "API Connections",
        icon: "key",
      },
    ],
    adminWidgets: [
      {
        id: "webmention-status",
        title: "Webmentions",
        size: "third",
      },
    ],
  };
}
