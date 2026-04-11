/**
 * XFN rel attribute builder and parser.
 *
 * Build `rel` attribute strings from relationship selections,
 * and parse existing `rel` strings to extract XFN values.
 *
 * @see https://gmpg.org/xfn/11
 * @module
 */

import { XFN_VALUES } from "./vocabulary.js";

/** Result of parsing a `rel` attribute string. */
export interface ParsedRel {
  /** Recognized XFN relationship values */
  xfn: string[];
  /** Non-XFN rel values (e.g. `nofollow`, `noopener`) */
  other: string[];
}

/**
 * Build a `rel` attribute string from XFN values and optional
 * other rel values.
 *
 * Deduplicates values and returns a space-separated string ready
 * for use in an HTML `rel` attribute.
 *
 * @param xfnValues - XFN relationship values (e.g. `['friend', 'met']`)
 * @param otherValues - Non-XFN rel values to include (e.g. `['noopener']`)
 * @returns Space-separated `rel` attribute string
 *
 * @example
 * ```ts
 * import { buildRelAttribute } from '@opensourcetogether/indieweb-core/xfn';
 *
 * buildRelAttribute(['friend', 'met'])
 * // 'friend met'
 *
 * buildRelAttribute(['friend', 'met'], ['noopener', 'noreferrer'])
 * // 'friend met noopener noreferrer'
 * ```
 */
export function buildRelAttribute(
  xfnValues: string[],
  otherValues: string[] = [],
): string {
  const all = [...xfnValues, ...otherValues].filter(Boolean);
  const unique = [...new Set(all)];
  return unique.join(" ");
}

/**
 * Parse a `rel` attribute string into XFN and non-XFN values.
 *
 * Splits the string on whitespace and classifies each token as
 * either a recognized XFN value or a non-XFN value.
 *
 * @param relString - The raw `rel` attribute value
 * @returns Object with `xfn` and `other` arrays
 *
 * @example
 * ```ts
 * import { parseRelAttribute } from '@opensourcetogether/indieweb-core/xfn';
 *
 * parseRelAttribute('nofollow friend met noopener')
 * // { xfn: ['friend', 'met'], other: ['nofollow', 'noopener'] }
 *
 * parseRelAttribute('')
 * // { xfn: [], other: [] }
 * ```
 */
export function parseRelAttribute(relString: string): ParsedRel {
  if (!relString || !relString.trim()) {
    return { xfn: [], other: [] };
  }

  const xfn: string[] = [];
  const other: string[] = [];
  const parts = relString
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    if ((XFN_VALUES as readonly string[]).includes(part)) {
      xfn.push(part);
    } else {
      other.push(part);
    }
  }

  return { xfn, other };
}

/** A link with XFN relationships extracted from HTML. */
export interface XfnLink {
  /** The href URL of the link */
  url: string;
  /** The XFN rel values on this link */
  rels: string[];
}

/**
 * Extract XFN relationships from an HTML string.
 *
 * Finds all `<a>` tags with `rel` attributes and returns the
 * XFN values and URLs for each link that has XFN relationships.
 *
 * @param html - HTML string to scan
 * @returns Array of objects with `url` and `rels` for each XFN link
 *
 * @example
 * ```ts
 * import { extractXfnLinks } from '@opensourcetogether/indieweb-core/xfn';
 *
 * const links = extractXfnLinks(
 *   '<a href="https://alice.dev" rel="friend met">Alice</a>'
 * );
 * // [{ url: 'https://alice.dev', rels: ['friend', 'met'] }]
 * ```
 */
export function extractXfnLinks(html: string): XfnLink[] {
  const results: XfnLink[] = [];

  // Match <a> tags with href attributes
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let anchorMatch: RegExpExecArray | null;

  while ((anchorMatch = anchorPattern.exec(html)) !== null) {
    const fullTag = anchorMatch[0];
    const href = anchorMatch[1];

    // Extract rel attribute from the tag
    const relMatch = /rel=["']([^"']*)["']/i.exec(fullTag);
    if (!relMatch) continue;

    const parsed = parseRelAttribute(relMatch[1]);
    if (parsed.xfn.length > 0) {
      results.push({ url: href, rels: parsed.xfn });
    }
  }

  return results;
}
