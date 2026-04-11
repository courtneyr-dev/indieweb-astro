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
    capabilities: ["read:content", "write:content", "network:fetch:any"],
    allowedHosts: ["*"],
    storage: {
      webmentions: {
        indexes: ["source", "target", "type", "verified", "receivedAt"],
        uniqueIndexes: ["source", "target"],
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
