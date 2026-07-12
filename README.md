# IndieWeb for Astro & EmDash

The comprehensive IndieWeb stack for Astro and EmDash — microformats2, post kinds, XFN, webmentions, IndieAuth, Micropub, and POSSE as reusable npm packages.

## Packages

| Package | Description |
|---------|-------------|
| `@opensourcetogether/indieweb-core` | Framework-agnostic TypeScript library for IndieWeb protocols: 28 post kinds, mf2 h-entry/h-card, XFN, webmention pipeline, IndieAuth (client + server primitives + PKCE), Micropub parsing/building/content mapping, Bridgy POSSE helpers |
| `@opensourcetogether/astro-indieweb` | Astro components and route factories for IndieWeb (webmention routes, mf2/PostKind components) |
| `@opensourcetogether/emdash-indieweb` | EmDash CMS plugin: webmention receive/send hooks, kind auto-detection + metadata enrichment, IndieAuth server routes, Bridgy syndication, six Block Kit admin pages |
| `@opensourcetogether/emdash-content-analysis` | EmDash CMS plugin: Yoast-style readability (Flesch Reading Ease) and focus-keyphrase analysis as an admin page |

## Development

pnpm workspace:

```bash
pnpm install
pnpm -r build     # builds all packages (esbuild/tsdown)
pnpm -r test      # vitest — indieweb-core (466+ tests) + content-analysis (29)
```

The [`opensourcetogether`](../opensourcetogether) site consumes these packages
via `file:` links; rebuild here (`pnpm -r build`), then reinstall there
(`npm install`) after changes.

## Consuming the EmDash plugins

```ts
// astro.config.mjs
import { emdashIndieweb } from "@opensourcetogether/emdash-indieweb";
import { emdashContentAnalysis } from "@opensourcetogether/emdash-content-analysis";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [
        emdashIndieweb({
          siteUrl: "https://example.com",
          author: { name: "Your Name", url: "https://example.com" },
        }),
        emdashContentAnalysis(),
      ],
    }),
  ],
});
```

Both plugins are standard-format and run trusted (in-process). The IndieWeb
plugin's public protocol endpoints (webmention/Micropub/IndieAuth) are wired
in the site as thin Astro routes that call the plugin's registered routes —
see the site repo's `src/pages/webmention.ts`, `micropub.ts`, and
`indieauth/` for the pattern.

## Known limitations

- POSSE executes through Bridgy webmentions; direct silo APIs (Mastodon,
  Bluesky OAuth) are deferred.
- Micropub server support covers `create`; `update`/`delete` and the media
  endpoint are deferred.
- `astro-indieweb` has no test suite yet (webmention route factories are
  exercised through indieweb-core's pipeline tests).
- Content-analysis syllable counting is an English heuristic, not a
  dictionary lookup.

## License

MIT © Courtney Robertson
