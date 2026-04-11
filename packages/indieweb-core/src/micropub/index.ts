/**
 * Micropub module — request/response helpers for the Micropub protocol.
 *
 * @example
 * ```ts
 * import {
 *   parseMicropubRequest,
 *   buildQueryUrl,
 *   discoverMicropub,
 * } from "@opensourcetogether/indieweb-core/micropub";
 * ```
 *
 * @see https://micropub.spec.indieweb.org/
 */

// Types
export type {
  MicropubCreateRequest,
  MicropubUpdateRequest,
  MicropubActionRequest,
  MicropubRequest,
  MicropubProperties,
  MicropubHtmlContent,
  MicropubMediaObject,
  MicropubQueryType,
  MicropubConfigResponse,
  MicropubSourceResponse,
  SyndicationTarget,
  MicropubError,
  MicropubScope,
} from "./types.js";

// Request building and parsing
export {
  buildFormEncodedCreate,
  buildJsonCreate,
  buildJsonUpdate,
  buildJsonAction,
  parseMicropubRequest,
  extractBearerToken,
  isCreateRequest,
  isUpdateRequest,
  isActionRequest,
  requiredScope,
} from "./request.js";

// Query building and parsing
export {
  buildQueryUrl,
  parseQuery,
  parseConfigResponse,
  parseSourceResponse,
  parseSyndicateToResponse,
  buildConfigResponse,
  buildSourceResponse,
} from "./query.js";

// Discovery
export {
  discoverMicropubFromHeaders,
  discoverMicropubFromHtml,
  discoverMicropub,
} from "./discovery.js";
