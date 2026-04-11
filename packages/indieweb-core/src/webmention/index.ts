export type {
  WebmentionRequest,
  WebmentionSendResult,
  WebmentionEndpointDiscovery,
  WebmentionValidation,
  WebmentionVerification,
  WebmentionDisplayType,
  WebmentionRecord,
} from "./types.js";

export {
  discoverEndpointFromHeaders,
  discoverEndpointFromHtml,
  discoverEndpoint,
} from "./discovery.js";

export {
  sendWebmention,
  extractLinkedUrls,
  sendWebmentionsForPost,
} from "./sender.js";

export {
  validateWebmention,
  verifyWebmention,
  sourceLinksToTarget,
} from "./receiver.js";

export type { SourceMf2Entry, SourceMf2Author } from "./display.js";

export {
  detectDisplayType,
  extractRsvpValue,
  extractAuthor,
  extractContent,
} from "./display.js";
