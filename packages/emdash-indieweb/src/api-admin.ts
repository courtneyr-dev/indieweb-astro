/**
 * API Credentials Admin Page (Block Kit)
 *
 * Settings page for configuring external API keys used by lookup routes.
 */
import type { PluginContext } from "emdash";

const API_FIELDS = [
  {
    action_id: "tmdbApiKey",
    kvKey: "settings:api:tmdb:apiKey",
    label: "TMDB API Key (movies and TV)",
    placeholder: "Enter your TMDB API key",
    docsUrl: "https://developer.themoviedb.org/docs/getting-started",
  },
  {
    action_id: "rawgApiKey",
    kvKey: "settings:api:rawg:apiKey",
    label: "RAWG API Key (video games)",
    placeholder: "Enter your RAWG API key",
    docsUrl: "https://rawg.io/apidocs",
  },
  {
    action_id: "lastfmApiKey",
    kvKey: "settings:api:lastfm:apiKey",
    label: "Last.fm API Key (music scrobbling)",
    placeholder: "Enter your Last.fm API key",
    docsUrl: "https://www.last.fm/api/account/create",
  },
  {
    action_id: "foursquareApiKey",
    kvKey: "settings:api:foursquare:apiKey",
    label: "Foursquare API Key (venues)",
    placeholder: "Enter your Foursquare API key",
    docsUrl:
      "https://location.foursquare.com/developer/reference/places-api-overview",
  },
  {
    action_id: "podcastIndexApiKey",
    kvKey: "settings:api:podcastindex:apiKey",
    label: "PodcastIndex API Key",
    placeholder: "Enter your PodcastIndex API key",
    docsUrl: "https://api.podcastindex.org/",
  },
  {
    action_id: "podcastIndexApiSecret",
    kvKey: "settings:api:podcastindex:apiSecret",
    label: "PodcastIndex API Secret",
    placeholder: "Paired with your API key",
    docsUrl: "https://api.podcastindex.org/",
  },
];

export async function buildApiCredentialsPage(ctx: PluginContext) {
  const formFields: Array<Record<string, unknown>> = [];
  for (const field of API_FIELDS) {
    const val = (await ctx.kv.get<string>(field.kvKey)) ?? "";
    formFields.push({
      type: "secret_input" as const,
      action_id: field.action_id,
      label: field.label,
      initial_value: val ? "configured" : "",
      placeholder: field.placeholder,
    });
  }

  return {
    blocks: [
      { type: "header", text: "API Connections" },
      {
        type: "context",
        text: "Configure API keys for external media lookup services. Free APIs (MusicBrainz, Open Library, Nominatim, BoardGameGeek) work without keys.",
      },
      { type: "divider" },
      {
        type: "context",
        text: "Get your API keys from these sites:",
      },
      {
        type: "fields",
        fields: [
          {
            label: "TMDB (movies/TV)",
            value: "developer.themoviedb.org/docs/getting-started",
          },
          { label: "RAWG (video games)", value: "rawg.io/apidocs" },
          {
            label: "Last.fm (music)",
            value: "last.fm/api/account/create",
          },
          {
            label: "Foursquare (venues)",
            value: "location.foursquare.com/developer",
          },
          { label: "PodcastIndex", value: "api.podcastindex.org" },
        ],
      },
      { type: "divider" },
      {
        type: "form",
        block_id: "api-credentials",
        fields: formFields,
        submit: {
          label: "Save API Keys",
          action_id: "save_api_credentials",
        },
      },
    ],
  };
}

export async function saveApiCredentials(
  ctx: PluginContext,
  values: Record<string, unknown>,
) {
  for (const field of API_FIELDS) {
    const val = values[field.action_id] as string;
    if (typeof val === "string" && val && val !== "configured") {
      await ctx.kv.set(field.kvKey, val);
    }
  }

  return {
    ...(await buildApiCredentialsPage(ctx)),
    toast: { message: "API keys saved", type: "success" as const },
  };
}
