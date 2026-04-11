export {
  XFN_VALUES,
  XFN_CATEGORIES,
  EXCLUSIVITY_GROUPS,
} from "./vocabulary.js";

export type {
  XfnValue,
  XfnCategory,
  XfnRelValue,
  SelectionType,
} from "./vocabulary.js";

export { validateXfnRelationships, isValidXfnValue } from "./validator.js";

export type { XfnValidationResult } from "./validator.js";

export {
  buildRelAttribute,
  parseRelAttribute,
  extractXfnLinks,
} from "./builder.js";

export type { ParsedRel, XfnLink } from "./builder.js";
