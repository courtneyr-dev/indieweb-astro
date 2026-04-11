/**
 * Micropub request building and parsing.
 *
 * Handles conversion between form-encoded and JSON formats,
 * and provides server-side request parsing.
 *
 * @see https://micropub.spec.indieweb.org/
 */
import type {
  MicropubCreateRequest,
  MicropubUpdateRequest,
  MicropubActionRequest,
  MicropubRequest,
  MicropubProperties,
  MicropubError,
} from "./types.js";

/**
 * Build a form-encoded body for a Micropub create request.
 *
 * Converts properties to the `key=value&key[]=value` format.
 * Only supports flat string values — use JSON for HTML content
 * or media objects with alt text.
 *
 * @example
 * ```ts
 * const body = buildFormEncodedCreate({
 *   content: ["Hello world"],
 *   category: ["indieweb", "micropub"],
 * });
 * // "h=entry&content=Hello+world&category[]=indieweb&category[]=micropub"
 * ```
 */
export function buildFormEncodedCreate(
  properties: MicropubProperties,
  type: string = "entry",
): string {
  const params = new URLSearchParams();
  params.set("h", type);

  for (const [key, values] of Object.entries(properties)) {
    if (!values || key.startsWith("mp-")) continue;

    if (values.length === 1 && typeof values[0] === "string") {
      params.set(key, values[0]);
    } else {
      for (const val of values) {
        if (typeof val === "string") {
          params.append(`${key}[]`, val);
        }
      }
    }
  }

  // Handle mp- properties (commands)
  for (const [key, values] of Object.entries(properties)) {
    if (!values || !key.startsWith("mp-")) continue;
    for (const val of values) {
      if (typeof val === "string") {
        params.append(`${key}[]`, val);
      }
    }
  }

  return params.toString();
}

/**
 * Build a JSON body for a Micropub create request.
 *
 * @example
 * ```ts
 * const json = buildJsonCreate({
 *   content: ["Hello world"],
 *   category: ["indieweb"],
 * });
 * // { type: ["h-entry"], properties: { content: ["Hello world"], ... } }
 * ```
 */
export function buildJsonCreate(
  properties: MicropubProperties,
  type: string = "h-entry",
): MicropubCreateRequest {
  return {
    type: [type],
    properties,
  };
}

/**
 * Build a JSON body for a Micropub update request.
 *
 * @example
 * ```ts
 * const json = buildJsonUpdate("https://example.com/post/1", {
 *   replace: { content: ["Updated"] },
 *   add: { category: ["new-tag"] },
 * });
 * ```
 */
export function buildJsonUpdate(
  url: string,
  operations: {
    replace?: Record<string, unknown[]>;
    add?: Record<string, unknown[]>;
    delete?: Record<string, unknown[]> | string[];
  },
): MicropubUpdateRequest {
  return {
    action: "update",
    url,
    ...operations,
  };
}

/**
 * Build a JSON body for a Micropub delete or undelete request.
 *
 * @example
 * ```ts
 * const json = buildJsonAction("delete", "https://example.com/post/1");
 * // { action: "delete", url: "https://example.com/post/1" }
 * ```
 */
export function buildJsonAction(
  action: "delete" | "undelete",
  url: string,
): MicropubActionRequest {
  return { action, url };
}

/**
 * Parse a Micropub request body (JSON or form-encoded).
 *
 * Determines the request type (create, update, delete, undelete)
 * and returns a normalized MicropubRequest object.
 *
 * @example
 * ```ts
 * // Parse JSON request
 * const result = parseMicropubRequest(
 *   { type: ["h-entry"], properties: { content: ["hello"] } },
 *   "application/json"
 * );
 *
 * // Parse form-encoded request
 * const result2 = parseMicropubRequest(
 *   "h=entry&content=hello",
 *   "application/x-www-form-urlencoded"
 * );
 * ```
 */
export function parseMicropubRequest(
  body: unknown,
  contentType: string,
): MicropubRequest | MicropubError {
  if (contentType.includes("application/json")) {
    return parseJsonRequest(body);
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return parseFormRequest(typeof body === "string" ? body : String(body));
  }

  return {
    error: "invalid_request",
    error_description: `Unsupported content type: ${contentType}`,
  };
}

/**
 * Parse a JSON Micropub request body.
 * @internal
 */
function parseJsonRequest(body: unknown): MicropubRequest | MicropubError {
  if (!body || typeof body !== "object") {
    return {
      error: "invalid_request",
      error_description: "Request body must be a JSON object",
    };
  }

  const data = body as Record<string, unknown>;

  // Delete / undelete
  if (data.action === "delete" || data.action === "undelete") {
    if (typeof data.url !== "string") {
      return {
        error: "invalid_request",
        error_description: "Missing url for action request",
      };
    }
    return { action: data.action, url: data.url };
  }

  // Update
  if (data.action === "update") {
    if (typeof data.url !== "string") {
      return {
        error: "invalid_request",
        error_description: "Missing url for update request",
      };
    }
    return {
      action: "update",
      url: data.url,
      replace: data.replace as Record<string, unknown[]> | undefined,
      add: data.add as Record<string, unknown[]> | undefined,
      delete: data.delete as Record<string, unknown[]> | string[] | undefined,
    };
  }

  // Create
  if (Array.isArray(data.type) && data.properties) {
    return {
      type: data.type as string[],
      properties: data.properties as MicropubProperties,
    };
  }

  return {
    error: "invalid_request",
    error_description:
      "Request must contain type+properties (create), action+url (update/delete), or action (delete/undelete)",
  };
}

/**
 * Parse a form-encoded Micropub request body.
 * @internal
 */
function parseFormRequest(body: string): MicropubRequest | MicropubError {
  const params = new URLSearchParams(body);

  // Delete / undelete
  const action = params.get("action");
  if (action === "delete" || action === "undelete") {
    const url = params.get("url");
    if (!url) {
      return {
        error: "invalid_request",
        error_description: "Missing url for action request",
      };
    }
    return { action, url };
  }

  // Create (form-encoded only supports create, not update)
  const h = params.get("h") || "entry";
  const properties: MicropubProperties = {};

  for (const [key, value] of params.entries()) {
    if (key === "h" || key === "action" || key === "access_token") continue;

    // Handle bracket notation: category[] -> category
    const propName = key.replace(/\[\]$/, "");

    if (!properties[propName]) {
      properties[propName] = [];
    }
    (properties[propName] as unknown[]).push(value);
  }

  return {
    type: [`h-${h}`],
    properties,
  };
}

/**
 * Extract the Bearer token from an Authorization header or form body.
 *
 * @example
 * ```ts
 * extractBearerToken("Bearer abc123"); // "abc123"
 * extractBearerToken(undefined, "access_token=abc123"); // "abc123"
 * extractBearerToken(undefined); // null
 * ```
 */
export function extractBearerToken(
  authHeader?: string | null,
  formBody?: string,
): string | null {
  // Authorization header takes precedence
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  }

  // Fall back to form body parameter
  if (formBody) {
    const params = new URLSearchParams(formBody);
    return params.get("access_token");
  }

  return null;
}

/**
 * Check if a parsed request is a create request.
 *
 * @example
 * ```ts
 * if (isCreateRequest(request)) {
 *   console.log(request.type, request.properties);
 * }
 * ```
 */
export function isCreateRequest(
  req: MicropubRequest,
): req is MicropubCreateRequest {
  return "type" in req && "properties" in req;
}

/**
 * Check if a parsed request is an update request.
 *
 * @example
 * ```ts
 * if (isUpdateRequest(request)) {
 *   console.log(request.url, request.replace);
 * }
 * ```
 */
export function isUpdateRequest(
  req: MicropubRequest,
): req is MicropubUpdateRequest {
  return "action" in req && req.action === "update";
}

/**
 * Check if a parsed request is a delete or undelete request.
 *
 * @example
 * ```ts
 * if (isActionRequest(request)) {
 *   console.log(request.action, request.url);
 * }
 * ```
 */
export function isActionRequest(
  req: MicropubRequest,
): req is MicropubActionRequest {
  return (
    "action" in req && (req.action === "delete" || req.action === "undelete")
  );
}

/**
 * Determine the required scope for a Micropub request.
 *
 * @example
 * ```ts
 * requiredScope({ type: ["h-entry"], properties: { content: ["hi"] } });
 * // "create"
 *
 * requiredScope({ action: "delete", url: "..." });
 * // "delete"
 * ```
 */
export function requiredScope(
  req: MicropubRequest,
): "create" | "update" | "delete" {
  if (isCreateRequest(req)) return "create";
  if (isUpdateRequest(req)) return "update";
  return "delete";
}
