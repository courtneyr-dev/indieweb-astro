/**
 * Re-exports TypeScript types from indieweb-core that the Astro
 * components consume. Import components directly via their .astro
 * path (e.g., `import HEntry from '@opensourcetogether/astro-indieweb/components/HEntry.astro'`).
 *
 * @example
 * ```ts
 * import type { HEntryData, HCardData } from '@opensourcetogether/astro-indieweb/components';
 * ```
 */
export type {
  HEntryData,
  HEntryOutput,
  Mf2Property,
} from "@opensourcetogether/indieweb-core/mf2";
export type {
  HCardData,
  HCardOutput,
} from "@opensourcetogether/indieweb-core/mf2";
