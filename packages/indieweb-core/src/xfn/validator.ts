/**
 * XFN relationship validation.
 *
 * Enforces the mutual exclusivity rules from XFN 1.1 and validates
 * that all values are recognized.
 *
 * @see https://gmpg.org/xfn/11
 * @module
 */

import { EXCLUSIVITY_GROUPS, XFN_VALUES } from "./vocabulary.js";

/** Result of validating a set of XFN relationships. */
export interface XfnValidationResult {
  /** Whether the combination is valid */
  valid: boolean;
  /** Human-readable warning messages for any violations */
  warnings: string[];
}

/**
 * Validate a set of XFN relationship values.
 *
 * Checks two things:
 * 1. All values are recognized XFN 1.1 values
 * 2. Mutual exclusivity rules are respected (e.g. can't pick both
 *    `friend` and `acquaintance`)
 * 3. `me` is exclusive of all other values
 *
 * @param rels - Array of XFN rel values to validate
 * @returns Validation result with `valid` flag and any `warnings`
 *
 * @example
 * ```ts
 * import { validateXfnRelationships } from '@opensourcetogether/indieweb-core/xfn';
 *
 * validateXfnRelationships(['friend', 'met'])
 * // { valid: true, warnings: [] }
 *
 * validateXfnRelationships(['friend', 'acquaintance'])
 * // { valid: false, warnings: ['Friendship: only one of contact, acquaintance, friend allowed'] }
 * ```
 */
export function validateXfnRelationships(rels: string[]): XfnValidationResult {
  const warnings: string[] = [];

  if (rels.length === 0) {
    return { valid: true, warnings };
  }

  // Check for unrecognized values
  for (const rel of rels) {
    if (!(XFN_VALUES as readonly string[]).includes(rel)) {
      warnings.push(`Unrecognized XFN value: "${rel}"`);
    }
  }

  // Check "me" exclusivity — me cannot combine with anything else
  if (rels.includes("me") && rels.length > 1) {
    warnings.push(
      '"me" is exclusive of all other XFN values and cannot be combined',
    );
  }

  // Check mutual exclusivity within groups
  for (const [groupName, groupValues] of Object.entries(EXCLUSIVITY_GROUPS)) {
    const selected = rels.filter((r) =>
      (groupValues as readonly string[]).includes(r),
    );
    if (selected.length > 1) {
      const label = groupName.charAt(0).toUpperCase() + groupName.slice(1);
      warnings.push(
        `${label}: only one of ${groupValues.join(", ")} allowed (got ${selected.join(", ")})`,
      );
    }
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Check whether a string is a valid XFN rel value.
 *
 * @param value - The string to check
 * @returns `true` if it's a recognized XFN 1.1 value
 *
 * @example
 * ```ts
 * import { isValidXfnValue } from '@opensourcetogether/indieweb-core/xfn';
 *
 * isValidXfnValue('friend')  // true
 * isValidXfnValue('enemy')   // false
 * ```
 */
export function isValidXfnValue(value: string): boolean {
  return (XFN_VALUES as readonly string[]).includes(value);
}
