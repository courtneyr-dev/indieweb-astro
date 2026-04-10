# IndieWeb for Astro & EmDash

## Project

- **Monorepo:** `indieweb-astro`
- **License:** MIT
- **Author:** Courtney Robertson (@courtneyr_dev)
- **Goal:** The comprehensive IndieWeb stack for Astro and EmDash — microformats2, post kinds, XFN, webmentions, IndieAuth, Micropub, POSSE — as reusable npm packages.

## Architecture

Three packages, layered bottom-up:

```
packages/
├── indieweb-core/          # Framework-agnostic TypeScript library
│   └── @opensourcetogether/indieweb-core
├── astro-indieweb/         # Astro integration + components
│   └── @opensourcetogether/astro-indieweb
└── emdash-indieweb/        # EmDash plugin (wraps astro-indieweb)
    └── @opensourcetogether/emdash-indieweb
```

**Dependency flow:** emdash-indieweb → astro-indieweb → indieweb-core

## Build Order

Always build bottom-up: core → astro → emdash. Do NOT start with the EmDash plugin.

## Package 1: @opensourcetogether/indieweb-core

Pure TypeScript, zero framework dependencies. This is the engine.

### Modules

#### microformats2 (`src/mf2/`)
- `h-entry` builder: generates correct mf2 class names and properties for posts
- `h-card` builder: author/identity cards
- `h-feed` builder: feed containers
- `h-event` builder: events with RSVP support
- Output: objects with `{ classNames, properties }` that renderers consume
- Reference spec: https://microformats.org/wiki/microformats2

#### Post Kinds (`src/kinds/`)
Post kind definitions and metadata. Each kind has:
- `slug`: machine name (note, article, bookmark, like, reply, repost, rsvp, checkin, photo, video, audio, listen, watch, read, play, eat, drink, chat)
- `name`: display name
- `icon`: suggested icon identifier
- `mf2Properties`: which mf2 properties this kind uses (e.g., reply uses `in-reply-to`, like uses `like-of`)
- `requiredFields`: what content fields are required
- `optionalFields`: additional fields
- `citationRequired`: whether a URL citation is needed (true for bookmark, like, reply, repost)

Reference: `.reference/post-kinds-for-indieweb/` — port the 16 post kind definitions. Key file: `CLAUDE.md` lists all kinds and their block/API integrations.

#### XFN (`src/xfn/`)
- Full XFN 1.1 relationship vocabulary: friendship (contact, acquaintance, friend), physical (met), professional (co-worker, colleague), geographical (co-resident, neighbor), family (child, parent, sibling, spouse, kin), romantic (muse, crush, date, sweetheart)
- `rel` attribute builder: takes relationship selections, returns valid `rel` attribute string
- Mutual exclusivity validation (e.g., can't be both `friend` and `acquaintance`)
- Parsing: extract XFN rels from existing `<a>` tags

Reference: `.reference/link-extension-for-xfn/` — port the relationship vocabulary and validation logic.

#### Webmention (`src/webmention/`)
- **Send:** discover endpoint from target URL, POST source/target
- **Receive:** validate incoming webmentions (check source links to target)
- **Verify:** async verification queue logic
- **Display types:** like, reply, repost, mention, bookmark, RSVP (map from mf2 properties)
- Spec: https://www.w3.org/TR/webmention/

#### IndieAuth (`src/indieauth/`)
- Client: authorization + token endpoints discovery, code exchange
- Server: authorization endpoint logic, token issuance/verification
- Spec: https://indieauth.spec.indieweb.org/

#### Micropub (`src/micropub/`)
- Server: create/update/delete posts via Micropub protocol
- Media endpoint: handle file uploads
- Query: config, source, syndicate-to
- Spec: https://micropub.spec.indieweb.org/

#### POSSE (`src/posse/`)
- Syndication target definitions
- Syndication link storage format
- Backfeed link format (for pulling responses back)

## Package 2: @opensourcetogether/astro-indieweb

Astro integration. Depends on indieweb-core.

### Astro Components (`src/components/`)
- `<HEntry>` — wraps post content with h-entry mf2 markup. Props: kind, title, content, published, updated, author, syndication, inReplyTo, likeOf, bookmarkOf, etc.
- `<HCard>` — author/identity card. Props: name, url, photo, email, note, org, etc.
- `<HFeed>` — feed wrapper with h-feed markup. Props: name, author.
- `<PostKind>` — renders a post with kind-specific template and mf2 properties. Delegates to HEntry internally.
- `<Webmentions>` — fetches and displays webmentions for current page. Props: target (defaults to Astro.url), showLikes, showReposts, showReplies, showMentions.
- `<XFNLink>` — anchor tag with XFN rel attributes. Props: href, relationships (array of XFN values), children.
- `<RelMe>` — identity link with rel="me". Props: href, label.
- `<IndieWebHead>` — head component: webmention endpoint link, IndieAuth links, microsub link, micropub link.

### Route Factories (`src/routes/`)
- `createWebmentionEndpoint()` — returns Astro APIRoute for receiving webmentions
- `createIndieAuthEndpoint()` — authorization + token endpoints
- `createMicropubEndpoint()` — Micropub server endpoint
- `createWebmentionFeed()` — JSON feed of received webmentions

### Astro Integration (`src/integration.ts`)
- `indieweb()` function for `astro.config.mjs`
- Auto-injects `<IndieWebHead>` into pages
- Configures webmention endpoint URL
- Options: siteUrl, author (h-card data), webmention.endpoint, indieauth, micropub, syndication targets

## Package 3: @opensourcetogether/emdash-indieweb

EmDash plugin (standard format). Depends on astro-indieweb.

### Plugin Structure
- `src/index.ts` — PluginDescriptor factory. Capabilities: read:content, write:content, network:fetch.
- `src/sandbox-entry.ts` — definePlugin with hooks and routes.

### Features
- **Post Kind field type:** adds a "kind" dropdown to any EmDash collection (note, article, bookmark, like, reply, etc.)
- **XFN field extension:** adds relationship picker to link fields in the Portable Text editor
- **Webmention admin page:** view/moderate received webmentions via Block Kit UI
- **h-card settings page:** configure site-wide author identity via Block Kit UI
- **POSSE settings:** configure syndication targets
- **Hooks:**
  - `content:afterSave` — send webmentions for any URLs in published content
  - `content:afterSave` — trigger POSSE syndication
- **Routes:**
  - `webmention` — public endpoint for receiving webmentions
  - `micropub` — Micropub server
  - `admin` — Block Kit admin handler for webmention moderation + settings
- **Storage collections:** `webmentions` (indexes: source, target, type, verified, createdAt)

### Registration in astro.config.mjs
```typescript
import { emdashIndieweb } from "@opensourcetogether/emdash-indieweb";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [emdashIndieweb({
        siteUrl: "https://opensourcetogether.dev",
        author: { name: "Courtney Robertson", url: "https://courtneyr.dev" },
      })],
    }),
  ],
});
```

## Reference Repos

These WordPress plugins are the functional blueprints. Port the LOGIC, not the PHP.

| Repo | What to port |
|------|-------------|
| `.reference/post-formats-for-block-themes/` | Post format definitions, auto-detection logic, format-specific templates, chat log block concept |
| `.reference/post-kinds-for-indieweb/` | 16 post kind definitions, mf2 property mappings, external API integrations (MusicBrainz, TMDB, Open Library, RAWG), webhook support |
| `.reference/link-extension-for-xfn/` | XFN 1.1 vocabulary, mutual exclusivity validation, rel attribute builder, relationship categories |

## IndieWeb Specs (Authoritative)

- Microformats2: https://microformats.org/wiki/microformats2
- h-entry: https://microformats.org/wiki/h-entry
- h-card: https://microformats.org/wiki/h-card
- Webmention: https://www.w3.org/TR/webmention/
- IndieAuth: https://indieauth.spec.indieweb.org/
- Micropub: https://micropub.spec.indieweb.org/
- Post Kinds: https://indieweb.org/post-type-discovery
- XFN 1.1: https://gmpg.org/xfn/11
- POSSE: https://indieweb.org/POSSE
- Webmention.io API: https://github.com/aaronpk/webmention.io#api

## Development

### Commands
```bash
npm install           # Install all workspace dependencies
npm run build         # Build all packages (core → astro → emdash)
npm run test          # Run all tests
npm run lint          # Lint all packages
```

### Per-package
```bash
cd packages/indieweb-core && npm run build && npm test
cd packages/astro-indieweb && npm run build && npm test
cd packages/emdash-indieweb && npm run build && npm test
```

### Standards
- TypeScript strict mode, no `any` (use `unknown` + type guards)
- ESM only (`"type": "module"` in all package.json)
- No Node.js built-ins in indieweb-core (must work in Workers/browser)
- Vitest for testing
- MIT license on all packages
- All exported functions must have JSDoc with @example

### Dogfood Site
The opensourcetogether.dev EmDash site at `/Users/crobertson/Projects/opensourcetogether/` is the integration test target. Once packages are buildable, install them there.

## Priority Order

1. **indieweb-core: mf2 builders** (h-entry, h-card) — smallest unit, most testable
2. **indieweb-core: post kind definitions** — data-only, no logic dependencies
3. **indieweb-core: XFN vocabulary + validation** — data + validation
4. **astro-indieweb: HEntry, HCard, HFeed components** — consume core builders
5. **astro-indieweb: IndieWebHead component** — endpoint discovery links
6. **indieweb-core: webmention send/receive** — needs HTTP, more complex
7. **astro-indieweb: webmention endpoint + display** — consume core webmention
8. **emdash-indieweb: plugin scaffold** — descriptor + basic hooks
9. **indieweb-core: IndieAuth + Micropub** — most complex protocols
10. **emdash-indieweb: admin UI, post kind field, XFN field** — full plugin
