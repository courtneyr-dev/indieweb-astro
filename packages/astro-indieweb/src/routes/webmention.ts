/**
 * Webmention endpoint route factory for Astro.
 *
 * Creates an Astro API route that receives webmentions per the
 * W3C Webmention spec. Validates the incoming source/target pair
 * synchronously, queues async verification, and stores the result.
 *
 * @see https://www.w3.org/TR/webmention/#receiving-webmentions
 *
 * @example
 * ```ts
 * // src/pages/webmention.ts
 * import { createWebmentionEndpoint } from '@opensourcetogether/astro-indieweb/routes';
 *
 * const handler = createWebmentionEndpoint({
 *   acceptedDomains: ['mysite.com'],
 *   store: myWebmentionStore,
 * });
 *
 * export const POST = handler.POST;
 * export const GET = handler.GET;
 * ```
 */
import {
  validateWebmention,
  verifyWebmention,
  type WebmentionRecord,
} from "@opensourcetogether/indieweb-core/webmention";
import {
  detectDisplayType,
  extractAuthor,
  extractContent,
  extractRsvpValue,
} from "@opensourcetogether/indieweb-core/webmention";

/**
 * Storage adapter for webmentions.
 *
 * Implement this interface to persist webmentions to your
 * database, filesystem, KV store, or any other backend.
 *
 * @example
 * ```ts
 * const store: WebmentionStore = {
 *   async save(record) {
 *     await db.insert('webmentions', record);
 *   },
 *   async findByTarget(target) {
 *     return db.query('SELECT * FROM webmentions WHERE target = ?', [target]);
 *   },
 *   async findBySourceAndTarget(source, target) {
 *     return db.queryOne(
 *       'SELECT * FROM webmentions WHERE source = ? AND target = ?',
 *       [source, target]
 *     );
 *   },
 *   async delete(source, target) {
 *     await db.delete('webmentions', { source, target });
 *   },
 * };
 * ```
 */
export interface WebmentionStore {
  /** Save or update a webmention record */
  save(record: WebmentionRecord): Promise<void>;
  /** Find all verified webmentions for a target URL */
  findByTarget(target: string): Promise<WebmentionRecord[]>;
  /** Find a specific webmention by source+target pair */
  findBySourceAndTarget(
    source: string,
    target: string,
  ): Promise<WebmentionRecord | null>;
  /** Delete a webmention (for 410 Gone handling) */
  delete(source: string, target: string): Promise<void>;
}

/**
 * Configuration for the webmention endpoint.
 *
 * @example
 * ```ts
 * const config: WebmentionEndpointConfig = {
 *   acceptedDomains: ['mysite.com', 'blog.mysite.com'],
 *   store: myStore,
 * };
 * ```
 */
export interface WebmentionEndpointConfig {
  /** Domains this endpoint accepts webmentions for */
  acceptedDomains: string[];
  /** Storage adapter for persisting webmentions */
  store: WebmentionStore;
}

/**
 * Astro API context (minimal subset needed by the route).
 * Using a minimal interface avoids importing all of Astro as
 * a dependency — the real APIContext is a superset of this.
 */
interface AstroAPIContext {
  request: Request;
}

/**
 * Create an Astro API route for receiving webmentions.
 *
 * Returns `POST` and `GET` handlers:
 * - **POST** receives webmentions (source + target form data)
 * - **GET** returns webmentions for a given target URL (JSON)
 *
 * The POST handler validates synchronously and returns 202 Accepted,
 * then verifies the webmention asynchronously in the background.
 *
 * @example
 * ```ts
 * // src/pages/webmention.ts
 * import { createWebmentionEndpoint } from '@opensourcetogether/astro-indieweb/routes';
 * import { myStore } from '../lib/webmention-store';
 *
 * const handler = createWebmentionEndpoint({
 *   acceptedDomains: ['mysite.com'],
 *   store: myStore,
 * });
 *
 * export const POST = handler.POST;
 * export const GET = handler.GET;
 * ```
 */
export function createWebmentionEndpoint(config: WebmentionEndpointConfig) {
  const { acceptedDomains, store } = config;

  return {
    /**
     * POST handler — receives a webmention.
     * Expects `application/x-www-form-urlencoded` body with `source` and `target`.
     */
    async POST({ request }: AstroAPIContext): Promise<Response> {
      // Parse form body
      let source: string;
      let target: string;

      try {
        const contentType = request.headers.get("Content-Type") || "";
        if (!contentType.includes("application/x-www-form-urlencoded")) {
          return new Response(
            "Content-Type must be application/x-www-form-urlencoded",
            {
              status: 400,
            },
          );
        }

        const formData = await request.formData();
        source = (formData.get("source") as string) || "";
        target = (formData.get("target") as string) || "";
      } catch {
        return new Response("Invalid request body", { status: 400 });
      }

      // Synchronous validation (spec Section 3.2.1)
      const validation = validateWebmention(source, target, acceptedDomains);
      if (!validation.valid) {
        return new Response(validation.error, { status: 400 });
      }

      // Queue async verification and return 202 Accepted (spec recommendation)
      queueVerification(source, target, store);

      return new Response("Webmention accepted", { status: 202 });
    },

    /**
     * GET handler — returns webmentions for a target URL as JSON.
     * Query param: `?target=https://example.com/post/1`
     */
    async GET({ request }: AstroAPIContext): Promise<Response> {
      const url = new URL(request.url);
      const target = url.searchParams.get("target");

      if (!target) {
        return new Response(
          JSON.stringify({ error: "Missing target query parameter" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const webmentions = await store.findByTarget(target);

      return new Response(JSON.stringify({ webmentions }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}

/**
 * Run webmention verification in the background.
 * Fetches the source, checks it links to target, determines
 * display type, and saves or deletes the record.
 */
function queueVerification(
  source: string,
  target: string,
  store: WebmentionStore,
): void {
  // Use Promise to avoid blocking the response.
  // In serverless/edge environments, this runs in the same
  // request lifecycle. For long-running servers, it's fire-and-forget.
  void (async () => {
    try {
      const result = await verifyWebmention(source, target);

      // Handle deletion (410 Gone or source no longer links to target)
      if (result.gone) {
        await store.delete(source, target);
        return;
      }

      // Check if this is an update to an existing webmention
      const existing = await store.findBySourceAndTarget(source, target);

      if (!result.verified) {
        // Source no longer links to target — delete existing
        if (existing) {
          await store.delete(source, target);
        }
        return;
      }

      // Parse mf2 from source to determine display type.
      // Uses a simple regex-based parser — a full mf2 parser
      // (like microformats-parser) can be plugged in at the
      // integration level for richer data extraction.
      const mf2Entry = simpleParseMf2(result.sourceContent || "");
      const displayType = detectDisplayType(mf2Entry, target);
      const author = extractAuthor(mf2Entry);
      const content = extractContent(mf2Entry);
      const rsvpValue =
        displayType === "rsvp" ? extractRsvpValue(mf2Entry) : undefined;

      const record: WebmentionRecord = {
        source,
        target,
        verified: true,
        type: displayType,
        authorName: author?.name,
        authorUrl: author?.url,
        authorPhoto: author?.photo,
        content,
        published: mf2Entry.published?.[0],
        receivedAt: new Date().toISOString(),
        rsvpValue,
      };

      await store.save(record);
    } catch {
      // Verification failed — silently discard per spec recommendation
    }
  })();
}

/**
 * Simple regex-based mf2 property extraction.
 *
 * Extracts just enough to determine the webmention display type.
 * A full mf2 parser can be plugged in at the integration level
 * for richer data extraction.
 */
function simpleParseMf2(
  html: string,
): import("@opensourcetogether/indieweb-core/webmention").SourceMf2Entry {
  type SourceMf2Entry =
    import("@opensourcetogether/indieweb-core/webmention").SourceMf2Entry;
  const entry: SourceMf2Entry = {};

  // Detect interaction properties by checking for mf2 class + href combos
  const interactionProps: Array<{
    cls: string;
    prop: keyof Pick<
      SourceMf2Entry,
      "like-of" | "repost-of" | "in-reply-to" | "bookmark-of" | "tag-of"
    >;
  }> = [
    { cls: "u-like-of", prop: "like-of" },
    { cls: "u-repost-of", prop: "repost-of" },
    { cls: "u-in-reply-to", prop: "in-reply-to" },
    { cls: "u-bookmark-of", prop: "bookmark-of" },
    { cls: "u-tag-of", prop: "tag-of" },
  ];

  for (const { cls, prop } of interactionProps) {
    // Match class="...u-like-of..." href="..." or href="..." class="...u-like-of..."
    const pattern = new RegExp(
      `class\\s*=\\s*["'][^"']*${cls}[^"']*["'][^>]*href\\s*=\\s*["']([^"']+)["']|href\\s*=\\s*["']([^"']+)["'][^>]*class\\s*=\\s*["'][^"']*${cls}[^"']*["']`,
      "gi",
    );
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1] || match[2];
      if (url) {
        if (!entry[prop]) entry[prop] = [];
        entry[prop]!.push(url);
      }
    }
  }

  // RSVP value from <data> element
  const rsvpDataMatch = html.match(
    /class\s*=\s*["'][^"']*p-rsvp[^"']*["'][^>]*value\s*=\s*["']([^"']+)["']/i,
  );
  if (rsvpDataMatch) {
    entry.rsvp = [rsvpDataMatch[1]];
  } else {
    const rsvpTextMatch = html.match(
      /class\s*=\s*["'][^"']*p-rsvp[^"']*["'][^>]*>([^<]*)</i,
    );
    if (rsvpTextMatch) {
      entry.rsvp = [rsvpTextMatch[1].trim()];
    }
  }

  // Author name (simple p-author extraction)
  const authorMatch = html.match(
    /class\s*=\s*["'][^"']*p-author[^"']*["'][^>]*>([^<]*)</i,
  );
  if (authorMatch && authorMatch[1].trim()) {
    entry.author = [authorMatch[1].trim()];
  }

  // Content (e-content)
  const contentMatch = html.match(
    /class\s*=\s*["'][^"']*e-content[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i,
  );
  if (contentMatch) {
    const htmlContent = contentMatch[1].trim();
    const textContent = htmlContent.replace(/<[^>]+>/g, "").trim();
    entry.content = [{ html: htmlContent, value: textContent }];
  }

  return entry;
}
