/**
 * Microformats2 h-card builder.
 *
 * Generates the CSS class names and property mappings needed to render
 * a valid h-card. Framework-agnostic — returns data, not HTML.
 *
 * @see https://microformats.org/wiki/h-card
 * @module
 */

import type { Mf2Property } from "./h-entry.js";

// ── Input types ──────────────────────────────────────────────────────

/** Data accepted by {@link buildHCard}. All fields are optional. */
export interface HCardData {
  /** Full/formatted name */
  name?: string;
  /** Given (first) name */
  givenName?: string;
  /** Family (last) name */
  familyName?: string;
  /** Additional/middle name */
  additionalName?: string;
  /** Honorific prefix (e.g. Dr., Mrs.) */
  honorificPrefix?: string;
  /** Honorific suffix (e.g. Ph.D, Esq.) */
  honorificSuffix?: string;
  /** Nickname or handle */
  nickname?: string;
  /** Homepage or representative URL */
  url?: string;
  /** Photo URL */
  photo?: string;
  /** Logo URL */
  logo?: string;
  /** Email address */
  email?: string;
  /** Phone number */
  tel?: string;
  /** Biographical note */
  note?: string;
  /** Organization name */
  org?: string;
  /** Job title */
  jobTitle?: string;
  /** Role description */
  role?: string;
  /** City/town */
  locality?: string;
  /** State/province */
  region?: string;
  /** Postal code */
  postalCode?: string;
  /** Country name */
  countryName?: string;
  /** Street address */
  streetAddress?: string;
  /** Categories or tags */
  category?: string[];
  /** Latitude (decimal) */
  latitude?: string;
  /** Longitude (decimal) */
  longitude?: string;
}

// ── Output types ─────────────────────────────────────────────────────

/** Output of {@link buildHCard}. */
export interface HCardOutput {
  /** CSS class for the root container element */
  rootClassName: string;
  /** Mapped mf2 properties, keyed by semantic name */
  properties: {
    name?: Mf2Property;
    givenName?: Mf2Property;
    familyName?: Mf2Property;
    additionalName?: Mf2Property;
    honorificPrefix?: Mf2Property;
    honorificSuffix?: Mf2Property;
    nickname?: Mf2Property;
    url?: Mf2Property;
    photo?: Mf2Property;
    logo?: Mf2Property;
    email?: Mf2Property;
    tel?: Mf2Property;
    note?: Mf2Property;
    org?: Mf2Property;
    jobTitle?: Mf2Property;
    role?: Mf2Property;
    locality?: Mf2Property;
    region?: Mf2Property;
    postalCode?: Mf2Property;
    countryName?: Mf2Property;
    streetAddress?: Mf2Property;
    category?: Mf2Property[];
    latitude?: Mf2Property;
    longitude?: Mf2Property;
  };
}

// ── Builder ──────────────────────────────────────────────────────────

/**
 * Build mf2 class names and property mappings for an h-card.
 *
 * Returns an object a renderer can consume to produce valid
 * microformats2-marked-up HTML on any framework.
 *
 * @param data - Identity data to convert into mf2 properties
 * @returns Object with `rootClassName` and `properties`
 *
 * @example
 * ```ts
 * import { buildHCard } from '@opensourcetogether/indieweb-core/mf2';
 *
 * const card = buildHCard({
 *   name: 'Courtney Robertson',
 *   url: 'https://courtneyr.dev',
 *   photo: 'https://courtneyr.dev/photo.jpg',
 *   org: 'Open Source Together',
 *   locality: 'Portland',
 *   region: 'OR',
 *   countryName: 'US',
 * });
 *
 * // card.rootClassName === 'h-card'
 * // card.properties.name?.className === 'p-name'
 * // card.properties.url?.attributes?.href === 'https://courtneyr.dev'
 * ```
 */
export function buildHCard(data: HCardData): HCardOutput {
  const properties: HCardOutput["properties"] = {};

  // ── Plain-text properties (p-*) ──

  const plainTextProps = [
    ["name", "p-name"],
    ["givenName", "p-given-name"],
    ["familyName", "p-family-name"],
    ["additionalName", "p-additional-name"],
    ["honorificPrefix", "p-honorific-prefix"],
    ["honorificSuffix", "p-honorific-suffix"],
    ["nickname", "p-nickname"],
    ["note", "p-note"],
    ["org", "p-org"],
    ["jobTitle", "p-job-title"],
    ["role", "p-role"],
    ["locality", "p-locality"],
    ["region", "p-region"],
    ["postalCode", "p-postal-code"],
    ["countryName", "p-country-name"],
    ["streetAddress", "p-street-address"],
    ["latitude", "p-latitude"],
    ["longitude", "p-longitude"],
    ["tel", "p-tel"],
  ] as const;

  for (const [key, className] of plainTextProps) {
    const value = data[key];
    if (value !== undefined) {
      (properties as Record<string, Mf2Property>)[key] = { className, value };
    }
  }

  // ── URL properties (u-*) ──

  if (data.url !== undefined) {
    properties.url = {
      className: "u-url",
      value: data.url,
      attributes: { href: data.url },
    };
  }

  if (data.photo !== undefined) {
    properties.photo = {
      className: "u-photo",
      value: data.photo,
      attributes: { src: data.photo },
    };
  }

  if (data.logo !== undefined) {
    properties.logo = {
      className: "u-logo",
      value: data.logo,
      attributes: { src: data.logo },
    };
  }

  if (data.email !== undefined) {
    const mailto = data.email.startsWith("mailto:")
      ? data.email
      : `mailto:${data.email}`;
    properties.email = {
      className: "u-email",
      value: data.email,
      attributes: { href: mailto },
    };
  }

  // ── Repeatable properties ──

  if (data.category !== undefined && data.category.length > 0) {
    properties.category = data.category.map((cat) => ({
      className: "p-category",
      value: cat,
    }));
  }

  return { rootClassName: "h-card", properties };
}
