/**
 * Webmention JSON Feed route factory for Astro.
 *
 * Creates an Astro API route that serves all received webmentions
 * as a JSON feed, optionally filtered by target URL.
 *
 * @example
 * ```ts
 * // src/pages/webmentions.json.ts
 * import { createWebmentionFeed } from '@opensourcetogether/astro-indieweb/routes';
 * import { myStore } from '../lib/webmention-store';
 *
 * const handler = createWebmentionFeed({ store: myStore });
 * export const GET = handler.GET;
 * ```
 */
import type { WebmentionRecord } from "@opensourcetogether/indieweb-core/webmention";
import type { WebmentionStore } from "./webmention.js";

/**
 * Configuration for the webmention feed route.
 *
 * @example
 * ```ts
 * const config: WebmentionFeedConfig = {
 *   store: myStore,
 *   siteUrl: 'https://mysite.com',
 * };
 * ```
 */
export interface WebmentionFeedConfig {
  /** Storage adapter for reading webmentions */
  store: Pick<WebmentionStore, "findByTarget">;
  /** Site URL for the feed metadata */
  siteUrl?: string;
}

interface AstroAPIContext {
  request: Request;
}

/**
 * Create an Astro API route that serves webmentions as JSON.
 *
 * Returns a GET handler. Accepts a `?target=` query parameter
 * to filter webmentions by target URL.
 *
 * @example
 * ```ts
 * // src/pages/webmentions.json.ts
 * import { createWebmentionFeed } from '@opensourcetogether/astro-indieweb/routes';
 * import { myStore } from '../lib/webmention-store';
 *
 * const handler = createWebmentionFeed({ store: myStore });
 * export const GET = handler.GET;
 * ```
 */
export function createWebmentionFeed(config: WebmentionFeedConfig) {
  const { store, siteUrl } = config;

  return {
    async GET({ request }: AstroAPIContext): Promise<Response> {
      const url = new URL(request.url);
      const target = url.searchParams.get("target");

      if (!target) {
        return new Response(
          JSON.stringify({
            error: "Missing target query parameter",
            usage: "GET /webmentions.json?target=https://example.com/post/1",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const webmentions = await store.findByTarget(target);

      // Group by type for easy consumption
      const grouped: Record<string, WebmentionRecord[]> = {};
      for (const wm of webmentions) {
        if (!grouped[wm.type]) grouped[wm.type] = [];
        grouped[wm.type].push(wm);
      }

      const feed = {
        type: "feed",
        name: "Webmentions",
        ...(siteUrl && { home_page_url: siteUrl }),
        target,
        total: webmentions.length,
        grouped,
        items: webmentions,
      };

      return new Response(JSON.stringify(feed), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}
