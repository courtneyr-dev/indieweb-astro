/**
 * XFN 1.1 relationship vocabulary.
 *
 * Defines every valid XFN rel value, organized by category,
 * with mutual exclusivity groups and UI metadata.
 *
 * @see https://gmpg.org/xfn/11
 * @module
 */

/** A single XFN relationship value. */
export interface XfnValue {
  /** The rel attribute value (e.g. `"friend"`, `"met"`) */
  value: string;
  /** Human-readable label */
  label: string;
  /** Short description of what the relationship means */
  description: string;
}

/** Whether a category allows one selection (radio) or many (checkbox). */
export type SelectionType = "radio" | "checkbox";

/** A category of XFN relationships. */
export interface XfnCategory {
  /** Machine name for the category */
  slug: string;
  /** Human-readable category name */
  label: string;
  /** Whether values are mutually exclusive (`radio`) or can combine (`checkbox`) */
  selectionType: SelectionType;
  /** The relationship values in this category */
  values: XfnValue[];
}

/**
 * All valid XFN 1.1 rel values as a flat array.
 *
 * @example
 * ```ts
 * import { XFN_VALUES } from '@opensourcetogether/indieweb-core/xfn';
 *
 * XFN_VALUES.includes('friend') // true
 * XFN_VALUES.includes('enemy')  // false
 * ```
 */
export const XFN_VALUES = [
  "contact",
  "acquaintance",
  "friend",
  "met",
  "co-worker",
  "colleague",
  "co-resident",
  "neighbor",
  "child",
  "parent",
  "sibling",
  "spouse",
  "kin",
  "muse",
  "crush",
  "date",
  "sweetheart",
  "me",
] as const;

/** Union type of all valid XFN values. */
export type XfnRelValue = (typeof XFN_VALUES)[number];

/**
 * Mutually exclusive groups. Within each group, only one value
 * may be selected per link.
 *
 * @example
 * ```ts
 * import { EXCLUSIVITY_GROUPS } from '@opensourcetogether/indieweb-core/xfn';
 *
 * // Can't pick both 'friend' and 'acquaintance'
 * EXCLUSIVITY_GROUPS.friendship // ['contact', 'acquaintance', 'friend']
 * ```
 */
export const EXCLUSIVITY_GROUPS = {
  friendship: ["contact", "acquaintance", "friend"],
  geographical: ["co-resident", "neighbor"],
  family: ["child", "parent", "sibling", "spouse", "kin"],
} as const;

/**
 * Complete XFN 1.1 vocabulary organized by category.
 *
 * Categories with `selectionType: 'radio'` are mutually exclusive —
 * only one value may be selected per link. Categories with
 * `selectionType: 'checkbox'` allow multiple selections.
 *
 * @example
 * ```ts
 * import { XFN_CATEGORIES } from '@opensourcetogether/indieweb-core/xfn';
 *
 * for (const category of XFN_CATEGORIES) {
 *   console.log(category.label, category.selectionType);
 *   // "Friendship" "radio"
 *   // "Physical" "checkbox"
 *   // ...
 * }
 * ```
 */
export const XFN_CATEGORIES: XfnCategory[] = [
  {
    slug: "friendship",
    label: "Friendship",
    selectionType: "radio",
    values: [
      {
        value: "contact",
        label: "Contact",
        description: "Someone you know how to get in touch with",
      },
      {
        value: "acquaintance",
        label: "Acquaintance",
        description:
          "Someone you have exchanged greetings and not much more with",
      },
      {
        value: "friend",
        label: "Friend",
        description: "Someone you are a friend to; a compatriot, a buddy",
      },
    ],
  },
  {
    slug: "physical",
    label: "Physical",
    selectionType: "checkbox",
    values: [
      {
        value: "met",
        label: "Met",
        description: "Someone you have actually met in person",
      },
    ],
  },
  {
    slug: "professional",
    label: "Professional",
    selectionType: "checkbox",
    values: [
      {
        value: "co-worker",
        label: "Co-worker",
        description: "Someone you work with or at the same organization as",
      },
      {
        value: "colleague",
        label: "Colleague",
        description: "Someone in the same field of study or activity",
      },
    ],
  },
  {
    slug: "geographical",
    label: "Geographical",
    selectionType: "radio",
    values: [
      {
        value: "co-resident",
        label: "Co-resident",
        description: "Someone you share a street address with",
      },
      {
        value: "neighbor",
        label: "Neighbor",
        description: "Someone who lives nearby",
      },
    ],
  },
  {
    slug: "family",
    label: "Family",
    selectionType: "radio",
    values: [
      {
        value: "child",
        label: "Child",
        description: "Your genetic offspring, or someone you have adopted",
      },
      {
        value: "parent",
        label: "Parent",
        description: "Your mother or father",
      },
      {
        value: "sibling",
        label: "Sibling",
        description: "Someone you share a parent with",
      },
      {
        value: "spouse",
        label: "Spouse",
        description: "Someone you are married to",
      },
      {
        value: "kin",
        label: "Kin",
        description:
          "A relative; someone you consider part of your extended family",
      },
    ],
  },
  {
    slug: "romantic",
    label: "Romantic",
    selectionType: "checkbox",
    values: [
      {
        value: "muse",
        label: "Muse",
        description: "Someone who brings you inspiration",
      },
      {
        value: "crush",
        label: "Crush",
        description: "Someone you have a crush on",
      },
      {
        value: "date",
        label: "Date",
        description: "Someone you are dating",
      },
      {
        value: "sweetheart",
        label: "Sweetheart",
        description:
          "Someone with whom you are intimate and at least somewhat committed",
      },
    ],
  },
  {
    slug: "identity",
    label: "Identity",
    selectionType: "checkbox",
    values: [
      {
        value: "me",
        label: "Me",
        description:
          "A link to yourself at a different URL. Exclusive of all other XFN values.",
      },
    ],
  },
];
