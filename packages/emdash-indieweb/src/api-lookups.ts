/**
 * External API Lookup Helpers
 *
 * Ported from Post Kinds for IndieWeb WordPress plugin.
 * Each lookup function queries an external API and returns normalized results.
 * Results are cached in KV with configurable TTLs.
 */
import type { PluginContext } from "emdash";

export interface LookupResult {
  title: string;
  subtitle?: string;
  year?: string;
  image?: string;
  url?: string;
  source: string;
  sourceId?: string;
  meta?: Record<string, unknown>;
}

export async function kvCache<T>(
  ctx: PluginContext,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await ctx.kv.get<string>(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { data: T; exp: number };
      if (parsed.exp > Date.now()) return parsed.data;
    } catch {
      /* cache miss */
    }
  }
  const data = await fetcher();
  await ctx.kv.set(
    key,
    JSON.stringify({ data, exp: Date.now() + ttlSeconds * 1000 }),
  );
  return data;
}

/** MusicBrainz search — free, no API key required */
export async function lookupMusic(
  ctx: PluginContext,
  query: string,
  artist?: string,
): Promise<LookupResult[]> {
  const cacheKey = `cache:music:${query}:${artist ?? ""}`;
  return kvCache(ctx, cacheKey, 86400, async () => {
    let lucene = `recording:"${query}"`;
    if (artist) lucene += ` AND artist:"${artist}"`;

    const fetchUrl =
      "https://musicbrainz.org/ws/2/recording" +
      `?query=${encodeURIComponent(lucene)}&fmt=json&limit=10`;
    const resp = await ctx.http!.fetch(fetchUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "EmDash-IndieWeb/0.1.0 (https://opensourcetogether.dev)",
      },
    });
    const data = (await resp.json()) as Record<string, unknown>;
    const recordings = (data.recordings ?? []) as Array<
      Record<string, unknown>
    >;

    return recordings.map((r): LookupResult => {
      const artists =
        (r["artist-credit"] as Array<Record<string, unknown>> | undefined) ??
        [];
      const artistName = artists
        .map(
          (a) =>
            (a.name ??
              (a.artist &&
                (a.artist as Record<string, unknown>).name)) as string,
        )
        .join(", ");
      const releases =
        (r.releases as Array<Record<string, unknown>> | undefined) ?? [];
      const firstRelease = releases[0] as Record<string, unknown> | undefined;

      return {
        title: r.title as string,
        subtitle: artistName,
        year: firstRelease?.date
          ? String(firstRelease.date).slice(0, 4)
          : undefined,
        url: `https://musicbrainz.org/recording/${r.id as string}`,
        source: "musicbrainz",
        sourceId: r.id as string,
        meta: {
          artist: artistName,
          album: firstRelease?.title,
          mbid: r.id,
        },
      };
    });
  });
}

/** TMDB search — requires API key */
export async function lookupVideo(
  ctx: PluginContext,
  query: string,
  type: string = "multi",
): Promise<LookupResult[]> {
  const apiKey = await ctx.kv.get<string>("settings:api:tmdb:apiKey");
  if (!apiKey) return [];

  const cacheKey = `cache:video:${query}:${type}`;
  return kvCache(ctx, cacheKey, 604800, async () => {
    const endpoint = type === "multi" ? "search/multi" : `search/${type}`;
    const fetchUrl =
      `https://api.themoviedb.org/3/${endpoint}` +
      `?query=${encodeURIComponent(query)}&api_key=${apiKey}`;
    const resp = await ctx.http!.fetch(fetchUrl, {
      headers: { Accept: "application/json" },
    });
    const data = (await resp.json()) as Record<string, unknown>;
    const results = (data.results ?? []) as Array<Record<string, unknown>>;

    return results
      .filter((r) => r.media_type !== "person")
      .slice(0, 10)
      .map((r): LookupResult => {
        const isMovie = (r.media_type ?? type) === "movie";
        const title = (isMovie ? r.title : r.name) as string;
        const date = (isMovie ? r.release_date : r.first_air_date) as
          | string
          | undefined;

        return {
          title,
          subtitle: (r.overview as string | undefined)?.slice(0, 120),
          year: date?.slice(0, 4),
          image: r.poster_path
            ? `https://image.tmdb.org/t/p/w342${r.poster_path}`
            : undefined,
          source: "tmdb",
          sourceId: String(r.id),
          meta: {
            tmdbId: r.id,
            mediaType: isMovie ? "movie" : "tv",
            voteAverage: r.vote_average,
          },
        };
      });
  });
}

/** Open Library search — free, no API key required */
export async function lookupBook(
  ctx: PluginContext,
  query: string,
  isbn?: string,
): Promise<LookupResult[]> {
  const cacheKey = `cache:book:${isbn ?? query}`;
  return kvCache(ctx, cacheKey, 86400, async () => {
    let fetchUrl: string;
    if (isbn) {
      fetchUrl =
        `https://openlibrary.org/api/books` +
        `?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    } else {
      fetchUrl =
        `https://openlibrary.org/search.json` +
        `?q=${encodeURIComponent(query)}&limit=10`;
    }

    const resp = await ctx.http!.fetch(fetchUrl, {
      headers: { Accept: "application/json" },
    });
    const data = (await resp.json()) as Record<string, unknown>;

    if (isbn) {
      const key = `ISBN:${isbn}`;
      const book = (data as Record<string, Record<string, unknown>>)[key];
      if (!book) return [];
      return [
        {
          title: book.title as string,
          subtitle: (
            (book.authors as Array<Record<string, unknown>> | undefined) ?? []
          )
            .map((a) => a.name as string)
            .join(", "),
          year: book.publish_date as string | undefined,
          image: (book.cover as Record<string, string> | undefined)?.medium,
          url: book.url as string | undefined,
          source: "openlibrary",
          sourceId: isbn,
          meta: { isbn, publishers: book.publishers },
        },
      ];
    }

    const docs = (data.docs ?? []) as Array<Record<string, unknown>>;
    return docs.slice(0, 10).map(
      (d): LookupResult => ({
        title: d.title as string,
        subtitle: ((d.author_name as string[] | undefined) ?? []).join(", "),
        year: d.first_publish_year ? String(d.first_publish_year) : undefined,
        image: d.cover_i
          ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
          : undefined,
        url: `https://openlibrary.org${d.key as string}`,
        source: "openlibrary",
        sourceId: d.key as string,
        meta: {
          isbn: (d.isbn as string[] | undefined)?.[0],
          author: (d.author_name as string[] | undefined)?.[0],
          pages: d.number_of_pages_median,
        },
      }),
    );
  });
}

/** RAWG / BoardGameGeek game search */
export async function lookupGame(
  ctx: PluginContext,
  query: string,
  source: string = "rawg",
): Promise<LookupResult[]> {
  if (source === "rawg") {
    const apiKey = await ctx.kv.get<string>("settings:api:rawg:apiKey");
    if (!apiKey) return [];

    const cacheKey = `cache:game:rawg:${query}`;
    return kvCache(ctx, cacheKey, 604800, async () => {
      const fetchUrl =
        "https://api.rawg.io/api/games" +
        `?search=${encodeURIComponent(query)}&key=${apiKey}&page_size=10`;
      const resp = await ctx.http!.fetch(fetchUrl, {
        headers: { Accept: "application/json" },
      });
      const data = (await resp.json()) as Record<string, unknown>;
      const results = (data.results ?? []) as Array<Record<string, unknown>>;

      return results.map(
        (g): LookupResult => ({
          title: g.name as string,
          year: (g.released as string | undefined)?.slice(0, 4),
          image: g.background_image as string | undefined,
          source: "rawg",
          sourceId: String(g.id),
          meta: {
            rating: g.rating,
            platforms: (
              (g.platforms as Array<Record<string, unknown>> | undefined) ?? []
            ).map(
              (p) =>
                ((p.platform as Record<string, unknown> | undefined)?.name ??
                  "") as string,
            ),
          },
        }),
      );
    });
  }

  // BoardGameGeek fallback — free, XML-based
  const cacheKey = `cache:game:bgg:${query}`;
  return kvCache(ctx, cacheKey, 604800, async () => {
    const fetchUrl =
      "https://boardgamegeek.com/xmlapi2/search" +
      `?query=${encodeURIComponent(query)}&type=boardgame`;
    const resp = await ctx.http!.fetch(fetchUrl);
    const xml = await resp.text();
    const items: LookupResult[] = [];
    const itemPattern = /<item.*?id="(\d+)".*?>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemPattern.exec(xml)) !== null) {
      const id = match[1];
      const body = match[2];
      const nameMatch = body.match(/name.*?value="([^"]+)"/);
      const yearMatch = body.match(/yearpublished.*?value="([^"]+)"/);
      if (nameMatch) {
        items.push({
          title: nameMatch[1],
          year: yearMatch?.[1],
          url: `https://boardgamegeek.com/boardgame/${id}`,
          source: "bgg",
          sourceId: id,
        });
      }
      if (items.length >= 10) break;
    }
    return items;
  });
}

/** Foursquare / Nominatim venue search */
export async function lookupVenue(
  ctx: PluginContext,
  query: string,
  lat?: number,
  lng?: number,
): Promise<LookupResult[]> {
  const fsKey = await ctx.kv.get<string>("settings:api:foursquare:apiKey");
  if (fsKey) {
    const cacheKey = `cache:venue:fs:${query}:${lat}:${lng}`;
    return kvCache(ctx, cacheKey, 86400, async () => {
      const params = new URLSearchParams({ query, limit: "10" });
      if (lat !== undefined && lng !== undefined) {
        params.set("ll", `${lat},${lng}`);
      }
      const fetchUrl = "https://api.foursquare.com/v3/places/search?" + params;
      const resp = await ctx.http!.fetch(fetchUrl, {
        headers: {
          Accept: "application/json",
          Authorization: fsKey,
        },
      });
      const data = (await resp.json()) as Record<string, unknown>;
      const results = (data.results ?? []) as Array<Record<string, unknown>>;

      return results.map((v): LookupResult => {
        const location = (v.location ?? {}) as Record<string, unknown>;
        const geocodes = v.geocodes as
          | Record<string, Record<string, number>>
          | undefined;
        return {
          title: v.name as string,
          subtitle: [location.address, location.locality, location.region]
            .filter(Boolean)
            .join(", "),
          source: "foursquare",
          sourceId: v.fsq_id as string,
          meta: {
            address: location.address,
            locality: location.locality,
            region: location.region,
            country: location.country,
            lat: geocodes?.main?.latitude,
            lng: geocodes?.main?.longitude,
          },
        };
      });
    });
  }

  // Nominatim fallback — free, no API key
  const cacheKey = `cache:venue:nom:${query}`;
  return kvCache(ctx, cacheKey, 86400, async () => {
    const fetchUrl =
      "https://nominatim.openstreetmap.org/search" +
      `?q=${encodeURIComponent(query)}&format=json&limit=10`;
    const resp = await ctx.http!.fetch(fetchUrl, {
      headers: {
        "User-Agent": "EmDash-IndieWeb/0.1.0 (https://opensourcetogether.dev)",
      },
    });
    const results = (await resp.json()) as Array<Record<string, unknown>>;

    return results.map(
      (r): LookupResult => ({
        title: r.display_name as string,
        source: "nominatim",
        sourceId: String(r.osm_id),
        meta: {
          lat: parseFloat(r.lat as string),
          lng: parseFloat(r.lon as string),
          type: r.type,
        },
      }),
    );
  });
}

/** PodcastIndex search — requires API key + secret */
export async function lookupPodcast(
  ctx: PluginContext,
  query: string,
): Promise<LookupResult[]> {
  const apiKey = await ctx.kv.get<string>("settings:api:podcastindex:apiKey");
  const apiSecret = await ctx.kv.get<string>(
    "settings:api:podcastindex:apiSecret",
  );

  if (!apiKey || !apiSecret) return [];

  const cacheKey = `cache:podcast:${query}`;
  return kvCache(ctx, cacheKey, 86400, async () => {
    const now = Math.floor(Date.now() / 1000);
    const fetchUrl =
      "https://api.podcastindex.org/api/1.0/search/byterm" +
      `?q=${encodeURIComponent(query)}`;
    const resp = await ctx.http!.fetch(fetchUrl, {
      headers: {
        "X-Auth-Key": apiKey,
        "X-Auth-Date": String(now),
        "User-Agent": "EmDash-IndieWeb/0.1.0",
      },
    });
    const data = (await resp.json()) as Record<string, unknown>;
    const feeds = (data.feeds ?? []) as Array<Record<string, unknown>>;

    return feeds.slice(0, 10).map(
      (f): LookupResult => ({
        title: f.title as string,
        subtitle: f.author as string | undefined,
        image: f.image as string | undefined,
        url: f.link as string | undefined,
        source: "podcastindex",
        sourceId: String(f.id),
        meta: {
          feedUrl: f.url,
          description: (f.description as string | undefined)?.slice(0, 200),
          language: f.language,
        },
      }),
    );
  });
}
