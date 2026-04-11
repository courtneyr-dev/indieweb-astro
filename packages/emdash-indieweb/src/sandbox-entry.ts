/**
 * Sandbox Entry Point — EmDash IndieWeb Plugin
 *
 * Standard-format plugin that works in both trusted (in-process)
 * and sandboxed (isolate) modes.
 *
 * Hooks:
 * - content:afterSave — send webmentions for URLs in published content
 *
 * Routes:
 * - admin — Block Kit UI for webmention moderation + h-card settings
 * - webmention — public endpoint for receiving webmentions
 *
 * @see https://www.w3.org/TR/webmention/
 */
import type { PluginContext, ContentHookEvent } from "emdash";
import {
  validateWebmention,
  sourceLinksToTarget,
  detectDisplayType,
  extractAuthor,
  extractContent,
  extractRsvpValue,
  extractLinkedUrls,
} from "@opensourcetogether/indieweb-core/webmention";
import type {
  WebmentionRecord,
  SourceMf2Entry,
} from "@opensourcetogether/indieweb-core/webmention";
import {
  getAllSlugs,
  getPostKind,
  discoverPostType,
} from "@opensourcetogether/indieweb-core/kinds";
import {
  XFN_CATEGORIES,
  validateXfnRelationships,
  buildRelAttribute,
} from "@opensourcetogether/indieweb-core/xfn";
import type { SyndicationTarget } from "@opensourcetogether/indieweb-core/posse";
import { buildApiCredentialsPage, saveApiCredentials } from "./api-admin.js";
import {
  lookupMusic,
  lookupVideo,
  lookupBook,
  lookupGame,
  lookupVenue,
  lookupPodcast,
} from "./api-lookups.js";

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getSiteUrl(ctx: PluginContext): Promise<string> {
  const kvUrl = await ctx.kv.get<string>("settings:siteUrl");
  return kvUrl || ctx.site.url;
}

function toWebmentionRecord(data: Record<string, unknown>): WebmentionRecord {
  return {
    source: data.source as string,
    target: data.target as string,
    verified: data.verified as boolean,
    type: data.type as WebmentionRecord["type"],
    authorName: data.authorName as string | undefined,
    authorUrl: data.authorUrl as string | undefined,
    authorPhoto: data.authorPhoto as string | undefined,
    content: data.content as string | undefined,
    published: data.published as string | undefined,
    receivedAt: data.receivedAt as string,
    rsvpValue: data.rsvpValue as WebmentionRecord["rsvpValue"],
  };
}

function extractTextFromContent(content: Record<string, unknown>): string {
  const body = content.body;
  if (!Array.isArray(body)) return "";

  const parts: string[] = [];
  for (const block of body) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as Record<string, unknown>;

    const children = b.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (typeof child === "object" && child !== null) {
          const c = child as Record<string, unknown>;
          if (typeof c.text === "string") parts.push(c.text);
        }
      }
    }

    const markDefs = b.markDefs;
    if (Array.isArray(markDefs)) {
      for (const mark of markDefs) {
        if (typeof mark === "object" && mark !== null) {
          const m = mark as Record<string, unknown>;
          if (typeof m.href === "string") parts.push(` ${m.href} `);
        }
      }
    }
  }

  return parts.join(" ");
}

// ─── Admin UI (Block Kit) ────────────────────────────────────────────────

async function buildWebmentionDashboardWidget(ctx: PluginContext) {
  const total = await ctx.storage.webmentions.count();
  const verified = await ctx.storage.webmentions.count({ verified: true });
  const pending = await ctx.storage.webmentions.count({ verified: false });

  return {
    blocks: [
      {
        type: "stats",
        stats: [
          { label: "Total", value: String(total) },
          { label: "Verified", value: String(verified) },
          { label: "Pending", value: String(pending) },
        ],
      },
    ],
  };
}

async function buildWebmentionsPage(ctx: PluginContext) {
  const result = await ctx.storage.webmentions.query({
    orderBy: { receivedAt: "desc" },
    limit: 50,
  });

  const mentionBlocks = result.items.flatMap((item) => {
    const wm = item.data as Record<string, unknown>;
    const wmId = item.id as string;
    const source = wm.source as string;
    const target = wm.target as string;

    return [
      {
        type: "section" as const,
        text: `**${wm.type}** from [${wm.authorName || source}](${source})\n→ ${target}${wm.content ? `\n> ${(wm.content as string).slice(0, 120)}` : ""}`,
        accessory: wm.verified
          ? {
              type: "badge" as const,
              text: "Verified",
              style: "success" as const,
            }
          : {
              type: "badge" as const,
              text: "Pending",
              style: "warning" as const,
            },
      },
      {
        type: "actions" as const,
        elements: [
          {
            type: "button" as const,
            text: "Re-verify",
            action_id: `reverify_wm_${encodeURIComponent(wmId)}|${encodeURIComponent(source)}|${encodeURIComponent(target)}`,
          },
          {
            type: "button" as const,
            text: "Delete",
            action_id: `delete_wm_${encodeURIComponent(wmId)}`,
            style: "danger" as const,
          },
        ],
      },
    ];
  });

  return {
    blocks: [
      { type: "header", text: "Webmentions" },
      {
        type: "context",
        text: "Webmentions received from other sites. Verified mentions have been confirmed to link to your content.",
      },
      { type: "divider" },
      ...(mentionBlocks.length > 0
        ? mentionBlocks
        : [{ type: "context", text: "No webmentions received yet." }]),
    ],
  };
}

async function buildIdentityPage(ctx: PluginContext) {
  const name = (await ctx.kv.get<string>("settings:authorName")) ?? "";
  const url = (await ctx.kv.get<string>("settings:authorUrl")) ?? "";
  const photo = (await ctx.kv.get<string>("settings:authorPhoto")) ?? "";
  const email = (await ctx.kv.get<string>("settings:authorEmail")) ?? "";
  const note = (await ctx.kv.get<string>("settings:authorNote")) ?? "";
  const org = (await ctx.kv.get<string>("settings:authorOrg")) ?? "";

  return {
    blocks: [
      { type: "header", text: "Identity (h-card)" },
      {
        type: "context",
        text: "Your site-wide identity used for IndieWeb authentication and author attribution.",
      },
      { type: "divider" },
      {
        type: "form",
        block_id: "identity-settings",
        fields: [
          {
            type: "text_input",
            action_id: "authorName",
            label: "Name",
            initial_value: name,
          },
          {
            type: "text_input",
            action_id: "authorUrl",
            label: "URL",
            initial_value: url,
          },
          {
            type: "text_input",
            action_id: "authorPhoto",
            label: "Photo URL",
            initial_value: photo,
          },
          {
            type: "text_input",
            action_id: "authorEmail",
            label: "Email",
            initial_value: email,
          },
          {
            type: "text_input",
            action_id: "authorOrg",
            label: "Organization",
            initial_value: org,
          },
          {
            type: "text_input",
            action_id: "authorNote",
            label: "Bio / Note",
            initial_value: note,
          },
        ],
        submit: { label: "Save Identity", action_id: "save_identity" },
      },
    ],
  };
}

async function saveIdentity(
  ctx: PluginContext,
  values: Record<string, unknown>,
) {
  const fields = [
    "authorName",
    "authorUrl",
    "authorPhoto",
    "authorEmail",
    "authorOrg",
    "authorNote",
  ];
  for (const field of fields) {
    if (typeof values[field] === "string") {
      await ctx.kv.set(`settings:${field}`, values[field]);
    }
  }
  return {
    ...(await buildIdentityPage(ctx)),
    toast: { message: "Identity saved", type: "success" as const },
  };
}

// ─── Post Kinds Admin ────────────────────────────────────────────────────

const KIND_CATEGORIES: Array<{ label: string; slugs: string[] }> = [
  {
    label: "Content",
    slugs: ["note", "article", "photo", "video", "audio", "chat"],
  },
  {
    label: "Interactions",
    slugs: [
      "reply",
      "like",
      "repost",
      "bookmark",
      "rsvp",
      "tag-reply",
      "favorite",
      "quotation",
    ],
  },
  {
    label: "Media & Life-logging",
    slugs: [
      "listen",
      "watch",
      "read",
      "play",
      "eat",
      "drink",
      "checkin",
      "jam",
      "mood",
    ],
  },
  {
    label: "Other",
    slugs: ["event", "review", "recipe", "wish", "acquisition"],
  },
];

async function buildPostKindsPage(ctx: PluginContext) {
  const enabledRaw = await ctx.kv.get<string>("settings:enabledKinds");
  const enabledKinds: string[] = enabledRaw
    ? JSON.parse(enabledRaw)
    : ["note", "article", "photo", "reply", "like", "repost", "bookmark"];

  const defaultKind =
    (await ctx.kv.get<string>("settings:defaultKind")) ?? "note";

  const kindFieldSetup = await ctx.kv.get<string>("settings:kindFieldCreated");

  const kindOptions = enabledKinds.map((slug) => ({
    label: getPostKind(slug)?.name ?? slug,
    value: slug,
  }));

  // Build categorized toggle groups
  const categoryBlocks: Array<Record<string, unknown>> = [];
  for (const cat of KIND_CATEGORIES) {
    categoryBlocks.push({
      type: "section",
      text: `**${cat.label}**`,
    });
    for (const slug of cat.slugs) {
      const kind = getPostKind(slug);
      categoryBlocks.push({
        type: "toggle",
        action_id: `kind_${slug}`,
        label: kind?.name ?? slug,
        initial_value: enabledKinds.includes(slug),
      });
    }
  }

  const setupBlocks: Array<Record<string, unknown>> = [];
  if (kindFieldSetup !== "true") {
    setupBlocks.push(
      { type: "divider" },
      {
        type: "banner",
        text: 'Post Kinds need a "Kind" field on your Posts collection to work. Click below to set it up.',
        style: "info",
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: "Set up Kind field on Posts",
            action_id: "setup_kind_field",
            style: "primary",
          },
        ],
      },
    );
  } else {
    setupBlocks.push(
      { type: "divider" },
      {
        type: "context",
        text: 'The "Kind" field is set up on your Posts collection.',
      },
    );
  }

  return {
    blocks: [
      { type: "header", text: "Post Kinds" },
      {
        type: "context",
        text: "Configure which post kinds are available. Each kind maps to microformats2 properties for IndieWeb interoperability.",
      },
      ...setupBlocks,
      { type: "divider" },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: "Enable All",
            action_id: "enable_all_kinds",
          },
          {
            type: "button",
            text: "Disable All",
            action_id: "disable_all_kinds",
          },
        ],
      },
      {
        type: "form",
        block_id: "post-kinds-settings",
        fields: [
          {
            type: "select",
            action_id: "defaultKind",
            label: "Default Kind",
            options:
              kindOptions.length > 0
                ? kindOptions
                : [{ label: "Note", value: "note" }],
            initial_value: defaultKind,
          },
          ...categoryBlocks,
        ],
        submit: { label: "Save Post Kinds", action_id: "save_post_kinds" },
      },
    ],
  };
}

async function savePostKinds(
  ctx: PluginContext,
  values: Record<string, unknown>,
) {
  const allSlugs = getAllSlugs();
  const enabledKinds = allSlugs.filter(
    (slug) => values[`kind_${slug}`] === true,
  );

  if (enabledKinds.length === 0) {
    return {
      blocks: [
        {
          type: "banner",
          text: "At least one post kind must be enabled",
          style: "error",
        },
      ],
    };
  }

  await ctx.kv.set("settings:enabledKinds", JSON.stringify(enabledKinds));

  const defaultKind = values.defaultKind as string;
  if (defaultKind && (enabledKinds as string[]).includes(defaultKind)) {
    await ctx.kv.set("settings:defaultKind", defaultKind);
  } else {
    await ctx.kv.set("settings:defaultKind", enabledKinds[0]);
  }

  return {
    ...(await buildPostKindsPage(ctx)),
    toast: { message: "Post kinds saved", type: "success" as const },
  };
}

// ─── POSSE / Syndication Admin ──────────────────────────────────────────

async function buildSyndicationPage(ctx: PluginContext) {
  const targetsRaw = await ctx.kv.get<string>("settings:syndicationTargets");
  const targets: SyndicationTarget[] = targetsRaw ? JSON.parse(targetsRaw) : [];

  const autoSyndicate =
    (await ctx.kv.get<string>("settings:autoSyndicate")) === "true";

  const targetBlocks = targets.map((target, index) => ({
    type: "section" as const,
    text: `**${target.name}**\n${target.uid}${target.service ? ` (${target.service.name})` : ""}`,
    accessory: {
      type: "button" as const,
      text: "Remove",
      action_id: `remove_target_${index}`,
      style: "danger" as const,
    },
  }));

  return {
    blocks: [
      { type: "header", text: "Syndication (POSSE)" },
      {
        type: "context",
        text: "Publish on your Own Site, Syndicate Elsewhere. Configure where to syndicate your content.",
      },
      { type: "divider" },
      {
        type: "form",
        block_id: "syndication-settings",
        fields: [
          {
            type: "toggle",
            action_id: "autoSyndicate",
            label: "Auto-syndicate new published posts",
            initial_value: autoSyndicate,
          },
        ],
        submit: {
          label: "Save Syndication Settings",
          action_id: "save_syndication_settings",
        },
      },
      { type: "divider" },
      { type: "header", text: "Syndication Targets" },
      ...(targetBlocks.length > 0
        ? targetBlocks
        : [
            {
              type: "context" as const,
              text: "No syndication targets configured. Add one below.",
            },
          ]),
      { type: "divider" },
      {
        type: "form",
        block_id: "add-syndication-target",
        fields: [
          {
            type: "text_input",
            action_id: "targetName",
            label: "Target Name",
            placeholder: "e.g. Mastodon via Bridgy",
          },
          {
            type: "text_input",
            action_id: "targetUid",
            label: "Target URL / UID",
            placeholder: "e.g. https://brid.gy/publish/mastodon",
          },
          {
            type: "text_input",
            action_id: "serviceName",
            label: "Service Name (optional)",
            placeholder: "e.g. Mastodon",
          },
          {
            type: "text_input",
            action_id: "serviceUrl",
            label: "Service URL (optional)",
            placeholder: "e.g. https://mastodon.social",
          },
        ],
        submit: {
          label: "Add Target",
          action_id: "add_syndication_target",
        },
      },
    ],
  };
}

async function saveSyndicationSettings(
  ctx: PluginContext,
  values: Record<string, unknown>,
) {
  await ctx.kv.set(
    "settings:autoSyndicate",
    values.autoSyndicate === true ? "true" : "false",
  );

  return {
    ...(await buildSyndicationPage(ctx)),
    toast: { message: "Syndication settings saved", type: "success" as const },
  };
}

async function addSyndicationTarget(
  ctx: PluginContext,
  values: Record<string, unknown>,
) {
  const name = values.targetName as string;
  const uid = values.targetUid as string;

  if (!name || !uid) {
    return {
      ...(await buildSyndicationPage(ctx)),
      toast: {
        message: "Name and URL are required",
        type: "error" as const,
      },
    };
  }

  const targetsRaw = await ctx.kv.get<string>("settings:syndicationTargets");
  const targets: SyndicationTarget[] = targetsRaw ? JSON.parse(targetsRaw) : [];

  const newTarget: SyndicationTarget = {
    uid,
    name,
    enabled: true,
  };

  const serviceName = values.serviceName as string;
  const serviceUrl = values.serviceUrl as string;
  if (serviceName || serviceUrl) {
    newTarget.service = {
      name: serviceName || name,
      url: serviceUrl || uid,
    };
  }

  targets.push(newTarget);
  await ctx.kv.set("settings:syndicationTargets", JSON.stringify(targets));

  return {
    ...(await buildSyndicationPage(ctx)),
    toast: { message: `Added ${name}`, type: "success" as const },
  };
}

async function removeSyndicationTarget(ctx: PluginContext, index: number) {
  const targetsRaw = await ctx.kv.get<string>("settings:syndicationTargets");
  const targets: SyndicationTarget[] = targetsRaw ? JSON.parse(targetsRaw) : [];

  if (index >= 0 && index < targets.length) {
    const removed = targets.splice(index, 1);
    await ctx.kv.set("settings:syndicationTargets", JSON.stringify(targets));
    return {
      ...(await buildSyndicationPage(ctx)),
      toast: {
        message: `Removed ${removed[0]?.name ?? "target"}`,
        type: "success" as const,
      },
    };
  }

  return buildSyndicationPage(ctx);
}

// ─── XFN Relationships Admin ────────────────────────────────────────────

async function buildRelationshipsPage(ctx: PluginContext) {
  const linksRaw = await ctx.kv.get<string>("settings:relMeLinks");
  const links: Array<{ url: string; label: string }> = linksRaw
    ? JSON.parse(linksRaw)
    : [];

  const xfnRaw = await ctx.kv.get<string>("settings:xfnDefaults");
  const xfnDefaults: Record<string, string[]> = xfnRaw
    ? JSON.parse(xfnRaw)
    : {};

  const linkBlocks = links.map((link, index) => ({
    type: "section" as const,
    text: `**${link.label || link.url}**\n\`rel="me"\` — ${link.url}`,
    accessory: {
      type: "button" as const,
      text: "Remove",
      action_id: `remove_relme_${index}`,
      style: "danger" as const,
    },
  }));

  // Build XFN relationship fields grouped by category
  const xfnFields: Array<{
    type: "toggle" | "select";
    action_id: string;
    label: string;
    initial_value?: boolean | string;
    options?: Array<{ label: string; value: string }>;
  }> = [];

  for (const cat of XFN_CATEGORIES) {
    const selectedValues = xfnDefaults[cat.slug] || [];

    if (cat.selectionType === "radio") {
      // Radio categories: use a select dropdown (pick one)
      xfnFields.push({
        type: "select",
        action_id: `xfn_${cat.slug}`,
        label: `${cat.label} (pick one)`,
        options: [
          { label: "None", value: "" },
          ...cat.values.map((v) => ({
            label: `${v.label} — ${v.description}`,
            value: v.value,
          })),
        ],
        initial_value: selectedValues[0] || "",
      });
    } else {
      // Checkbox categories: use toggles (pick any)
      for (const v of cat.values) {
        xfnFields.push({
          type: "toggle",
          action_id: `xfn_${cat.slug}_${v.value}`,
          label: `${cat.label}: ${v.label} — ${v.description}`,
          initial_value: selectedValues.includes(v.value),
        });
      }
    }
  }

  return {
    blocks: [
      { type: "header", text: "Relationships (XFN)" },
      {
        type: "context",
        text: 'Manage your rel="me" identity links and XFN relationship settings. Identity links verify who you are across the web. XFN defines how you relate to people you link to.',
      },
      { type: "divider" },
      { type: "header", text: "Identity Links (rel=me)" },
      ...(linkBlocks.length > 0
        ? linkBlocks
        : [
            {
              type: "context" as const,
              text: 'No rel="me" links configured. Add your social profiles below.',
            },
          ]),
      { type: "divider" },
      {
        type: "form",
        block_id: "add-relme-link",
        fields: [
          {
            type: "text_input",
            action_id: "relmeUrl",
            label: "Profile URL",
            placeholder: "e.g. https://mastodon.social/@you",
          },
          {
            type: "text_input",
            action_id: "relmeLabel",
            label: "Label (optional)",
            placeholder: "e.g. Mastodon",
          },
        ],
        submit: { label: "Add Link", action_id: "add_relme_link" },
      },
      { type: "divider" },
      { type: "header", text: "XFN Relationship Defaults" },
      {
        type: "context",
        text: "Set default XFN relationship types applied to outgoing links. These follow the XFN 1.1 spec (gmpg.org/xfn/).",
      },
      {
        type: "form",
        block_id: "xfn-settings",
        fields: xfnFields,
        submit: { label: "Save XFN Settings", action_id: "save_xfn_settings" },
      },
    ],
  };
}

async function addRelMeLink(
  ctx: PluginContext,
  values: Record<string, unknown>,
) {
  const url = values.relmeUrl as string;
  if (!url) {
    return {
      ...(await buildRelationshipsPage(ctx)),
      toast: { message: "URL is required", type: "error" as const },
    };
  }

  const linksRaw = await ctx.kv.get<string>("settings:relMeLinks");
  const links: Array<{ url: string; label: string }> = linksRaw
    ? JSON.parse(linksRaw)
    : [];

  links.push({ url, label: (values.relmeLabel as string) || "" });
  await ctx.kv.set("settings:relMeLinks", JSON.stringify(links));

  return {
    ...(await buildRelationshipsPage(ctx)),
    toast: { message: "Link added", type: "success" as const },
  };
}

async function removeRelMeLink(ctx: PluginContext, index: number) {
  const linksRaw = await ctx.kv.get<string>("settings:relMeLinks");
  const links: Array<{ url: string; label: string }> = linksRaw
    ? JSON.parse(linksRaw)
    : [];

  if (index >= 0 && index < links.length) {
    links.splice(index, 1);
    await ctx.kv.set("settings:relMeLinks", JSON.stringify(links));
  }

  return {
    ...(await buildRelationshipsPage(ctx)),
    toast: { message: "Link removed", type: "success" as const },
  };
}

async function saveXfnSettings(
  ctx: PluginContext,
  values: Record<string, unknown>,
) {
  const xfnDefaults: Record<string, string[]> = {};

  for (const cat of XFN_CATEGORIES) {
    if (cat.selectionType === "radio") {
      const val = values[`xfn_${cat.slug}`] as string;
      if (val) xfnDefaults[cat.slug] = [val];
    } else {
      const selected: string[] = [];
      for (const v of cat.values) {
        if (values[`xfn_${cat.slug}_${v.value}`] === true) {
          selected.push(v.value);
        }
      }
      if (selected.length > 0) xfnDefaults[cat.slug] = selected;
    }
  }

  await ctx.kv.set("settings:xfnDefaults", JSON.stringify(xfnDefaults));

  return {
    ...(await buildRelationshipsPage(ctx)),
    toast: { message: "XFN settings saved", type: "success" as const },
  };
}

// ─── Enhanced Webmention Page ───────────────────────────────────────────

async function deleteWebmention(ctx: PluginContext, wmId: string) {
  await ctx.storage.webmentions.delete(wmId);
  return {
    ...(await buildWebmentionsPage(ctx)),
    toast: { message: "Webmention deleted", type: "success" as const },
  };
}

async function reverifyWebmention(
  ctx: PluginContext,
  wmId: string,
  source: string,
  target: string,
) {
  if (ctx.http) {
    void verifyInBackground(ctx, wmId, source, target);
  }
  return {
    ...(await buildWebmentionsPage(ctx)),
    toast: {
      message: "Re-verification started",
      type: "success" as const,
    },
  };
}

// ─── Plugin Definition ───────────────────────────────────────────────────

export default {
  hooks: {
    "content:beforeSave": {
      priority: 100,
      timeout: 10_000,
      errorPolicy: "continue",
      handler: async (event: ContentHookEvent, ctx: PluginContext) => {
        const content = event.content as Record<string, unknown>;

        // Auto-detect post kind from content properties if not explicitly set
        if (!content.kind) {
          const mf2Props: Record<string, string[]> = {};
          const propMappings: Array<[string, string]> = [
            ["inReplyTo", "in-reply-to"],
            ["likeOf", "like-of"],
            ["repostOf", "repost-of"],
            ["bookmarkOf", "bookmark-of"],
            ["rsvp", "rsvp"],
          ];

          for (const [contentKey, mf2Key] of propMappings) {
            const val = content[contentKey];
            if (typeof val === "string" && val) {
              mf2Props[mf2Key] = [val];
            } else if (Array.isArray(val) && val.length > 0) {
              mf2Props[mf2Key] = val.filter(
                (v: unknown) => typeof v === "string",
              );
            }
          }

          if (content.photo || content.photos) mf2Props.photo = ["present"];
          if (content.video) mf2Props.video = ["present"];
          if (content.audio) mf2Props.audio = ["present"];

          const mf2Item = {
            type: ["h-entry"],
            properties: {
              ...mf2Props,
              ...(content.title ? { name: [content.title as string] } : {}),
              ...(content.content || content.body
                ? { content: ["present"] }
                : {}),
            },
          };

          const detectedKind = discoverPostType(mf2Item);
          if (detectedKind) {
            content.kind = detectedKind;
            ctx.log.info(`Auto-detected post kind: ${detectedKind}`);
          }
        }

        // Enrich metadata from external APIs when lookupQuery is present
        // but enriched metadata hasn't been stored yet
        const kind = content.kind as string | undefined;
        const lookupQuery = content.lookupQuery as string | undefined;
        if (!kind || !lookupQuery || content.lookupEnriched || !ctx.http)
          return;

        try {
          const kindToLookup: Record<string, string> = {
            listen: "music",
            jam: "music",
            watch: "video",
            read: "book",
            play: "game",
            checkin: "venue",
            eat: "venue",
            drink: "venue",
          };

          const lookupType = kindToLookup[kind];
          if (!lookupType) return;

          let results;
          switch (lookupType) {
            case "music":
              results = await lookupMusic(ctx, lookupQuery);
              break;
            case "video":
              results = await lookupVideo(ctx, lookupQuery);
              break;
            case "book":
              results = await lookupBook(
                ctx,
                lookupQuery,
                content.isbn as string | undefined,
              );
              break;
            case "game":
              results = await lookupGame(ctx, lookupQuery);
              break;
            case "venue":
              results = await lookupVenue(ctx, lookupQuery);
              break;
          }

          if (results && results.length > 0) {
            const best = results[0];
            content.lookupEnriched = true;
            content.lookupSource = best.source;
            content.lookupSourceId = best.sourceId;
            content.lookupMeta = best.meta;

            // Map enriched fields to kind-specific content fields
            if (lookupType === "music" && best.meta) {
              content.listenTrack = content.listenTrack || best.title;
              content.listenArtist = content.listenArtist || best.meta.artist;
              content.listenAlbum = content.listenAlbum || best.meta.album;
              content.listenMbid = content.listenMbid || best.meta.mbid;
            } else if (lookupType === "video" && best.meta) {
              content.watchTitle = content.watchTitle || best.title;
              content.watchYear = content.watchYear || best.year;
              content.watchPoster = content.watchPoster || best.image;
              content.watchTmdbId = content.watchTmdbId || best.meta.tmdbId;
              content.watchMediaType =
                content.watchMediaType || best.meta.mediaType;
            } else if (lookupType === "book" && best.meta) {
              content.readTitle = content.readTitle || best.title;
              content.readAuthor = content.readAuthor || best.meta.author;
              content.readIsbn = content.readIsbn || best.meta.isbn;
              content.readCover = content.readCover || best.image;
            } else if (lookupType === "game") {
              content.playTitle = content.playTitle || best.title;
              content.playCover = content.playCover || best.image;
            } else if (lookupType === "venue" && best.meta) {
              content.checkinName = content.checkinName || best.title;
              content.checkinAddress =
                content.checkinAddress || best.meta.address;
              content.checkinLocality =
                content.checkinLocality || best.meta.locality;
              content.latitude = content.latitude || best.meta.lat;
              content.longitude = content.longitude || best.meta.lng;
            }

            ctx.log.info(
              `Enriched ${kind} post with ${best.source} data: ${best.title}`,
            );
          }
        } catch (err) {
          ctx.log.warn(
            `Lookup enrichment failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    },

    "content:afterSave": {
      priority: 200,
      timeout: 15_000,
      errorPolicy: "continue",
      handler: async (event: ContentHookEvent, ctx: PluginContext) => {
        const status = event.content.status;
        if (status !== "published") return;

        const siteUrl = await getSiteUrl(ctx);
        if (!siteUrl) {
          ctx.log.warn("No site URL configured — skipping webmention send");
          return;
        }

        const textContent = extractTextFromContent(event.content);
        if (!textContent.trim()) return;

        const slug = event.content.slug as string;
        const collection = event.collection;
        const sourceUrl = `${siteUrl.replace(/\/$/, "")}/${collection}/${slug}`;

        const wrappedHtml = `<div>${textContent}</div>`;
        const targetUrls = extractLinkedUrls(wrappedHtml, sourceUrl);
        if (targetUrls.length === 0) return;

        ctx.log.info(
          `Sending webmentions from ${sourceUrl} to ${targetUrls.length} targets`,
        );

        if (!ctx.http) {
          ctx.log.warn(
            "network:fetch capability required for sending webmentions",
          );
          return;
        }

        for (const target of targetUrls) {
          try {
            const targetHost = new URL(target).hostname;
            const sourceHost = new URL(sourceUrl).hostname;
            if (targetHost === sourceHost) continue;

            const response = await ctx.http.fetch(target, {
              headers: { Accept: "text/html" },
            });
            const html = await response.text();
            const linkHeader = response.headers.get("Link");

            let endpoint: string | null = null;

            if (linkHeader) {
              const wmMatch = linkHeader.match(
                /<([^>]+)>;\s*rel="?webmention"?/i,
              );
              if (wmMatch) endpoint = new URL(wmMatch[1], target).href;
            }

            if (!endpoint) {
              const linkMatch =
                html.match(
                  /<link[^>]*rel\s*=\s*["']webmention["'][^>]*href\s*=\s*["']([^"']+)["']/i,
                ) ||
                html.match(
                  /<link[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']webmention["']/i,
                );
              if (linkMatch) endpoint = new URL(linkMatch[1], target).href;
            }

            if (!endpoint) continue;

            const body = new URLSearchParams({ source: sourceUrl, target });
            await ctx.http.fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: body.toString(),
            });

            ctx.log.info(`Sent webmention to ${endpoint} for ${target}`);
          } catch (err) {
            ctx.log.warn(
              `Failed to send webmention to ${target}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      },
    },
  },

  routes: {
    admin: {
      handler: async (
        routeCtx: { input: Record<string, unknown> },
        ctx: PluginContext,
      ) => {
        const interaction = routeCtx.input;

        if (
          interaction.type === "page_load" &&
          interaction.page === "widget:webmention-status"
        )
          return buildWebmentionDashboardWidget(ctx);

        if (
          interaction.type === "page_load" &&
          interaction.page === "/webmentions"
        )
          return buildWebmentionsPage(ctx);

        if (
          interaction.type === "page_load" &&
          interaction.page === "/identity"
        )
          return buildIdentityPage(ctx);

        if (
          interaction.type === "form_submit" &&
          interaction.action_id === "save_identity"
        )
          return saveIdentity(
            ctx,
            (interaction.values as Record<string, unknown>) ?? {},
          );

        // Post Kinds
        if (
          interaction.type === "page_load" &&
          interaction.page === "/post-kinds"
        )
          return buildPostKindsPage(ctx);

        if (
          interaction.type === "form_submit" &&
          interaction.action_id === "save_post_kinds"
        )
          return savePostKinds(
            ctx,
            (interaction.values as Record<string, unknown>) ?? {},
          );

        // Post Kinds — Enable All / Disable All
        if (
          interaction.type === "button_click" &&
          interaction.action_id === "enable_all_kinds"
        ) {
          const allSlugs = getAllSlugs();
          await ctx.kv.set("settings:enabledKinds", JSON.stringify(allSlugs));
          return {
            ...(await buildPostKindsPage(ctx)),
            toast: {
              message: `All ${allSlugs.length} kinds enabled`,
              type: "success" as const,
            },
          };
        }

        if (
          interaction.type === "button_click" &&
          interaction.action_id === "disable_all_kinds"
        ) {
          // Keep at least "note" enabled
          await ctx.kv.set("settings:enabledKinds", JSON.stringify(["note"]));
          await ctx.kv.set("settings:defaultKind", "note");
          return {
            ...(await buildPostKindsPage(ctx)),
            toast: {
              message: "All kinds disabled (Note kept as minimum)",
              type: "success" as const,
            },
          };
        }

        // Post Kinds — Set up the Kind field on Posts collection
        if (
          interaction.type === "button_click" &&
          interaction.action_id === "setup_kind_field"
        ) {
          try {
            const enabledRaw = await ctx.kv.get<string>(
              "settings:enabledKinds",
            );
            const enabledKinds: string[] = enabledRaw
              ? JSON.parse(enabledRaw)
              : [
                  "note",
                  "article",
                  "photo",
                  "reply",
                  "like",
                  "repost",
                  "bookmark",
                ];

            const options = enabledKinds.map((slug) => ({
              label: getPostKind(slug)?.name ?? slug,
              value: slug,
            }));

            await ctx.http!.fetch(
              `${ctx.site.url.replace(/\/$/, "")}/_emdash/api/schema/collections/posts/fields`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  slug: "kind",
                  label: "Kind",
                  type: "select",
                  required: false,
                  options,
                  sortOrder: 5,
                }),
              },
            );

            await ctx.kv.set("settings:kindFieldCreated", "true");

            return {
              ...(await buildPostKindsPage(ctx)),
              toast: {
                message:
                  'Kind field added to Posts — you\'ll see a "Kind" dropdown in the editor',
                type: "success" as const,
              },
            };
          } catch (err) {
            return {
              ...(await buildPostKindsPage(ctx)),
              toast: {
                message: `Failed to create field: ${err instanceof Error ? err.message : String(err)}`,
                type: "error" as const,
              },
            };
          }
        }

        // Syndication (POSSE)
        if (
          interaction.type === "page_load" &&
          interaction.page === "/syndication"
        )
          return buildSyndicationPage(ctx);

        if (
          interaction.type === "form_submit" &&
          interaction.action_id === "save_syndication_settings"
        )
          return saveSyndicationSettings(
            ctx,
            (interaction.values as Record<string, unknown>) ?? {},
          );

        if (
          interaction.type === "form_submit" &&
          interaction.action_id === "add_syndication_target"
        )
          return addSyndicationTarget(
            ctx,
            (interaction.values as Record<string, unknown>) ?? {},
          );

        // Handle dynamic syndication target removal
        if (
          interaction.type === "button_click" &&
          typeof interaction.action_id === "string" &&
          interaction.action_id.startsWith("remove_target_")
        ) {
          const index = parseInt(
            interaction.action_id.replace("remove_target_", ""),
            10,
          );
          return removeSyndicationTarget(ctx, index);
        }

        // Relationships (XFN)
        if (
          interaction.type === "page_load" &&
          interaction.page === "/relationships"
        )
          return buildRelationshipsPage(ctx);

        if (
          interaction.type === "form_submit" &&
          interaction.action_id === "add_relme_link"
        )
          return addRelMeLink(
            ctx,
            (interaction.values as Record<string, unknown>) ?? {},
          );

        if (
          interaction.type === "form_submit" &&
          interaction.action_id === "save_xfn_settings"
        )
          return saveXfnSettings(
            ctx,
            (interaction.values as Record<string, unknown>) ?? {},
          );

        // Handle dynamic rel-me link removal
        if (
          interaction.type === "button_click" &&
          typeof interaction.action_id === "string" &&
          interaction.action_id.startsWith("remove_relme_")
        ) {
          const index = parseInt(
            interaction.action_id.replace("remove_relme_", ""),
            10,
          );
          return removeRelMeLink(ctx, index);
        }

        // API Credentials
        if (
          interaction.type === "page_load" &&
          interaction.page === "/api-connections"
        )
          return buildApiCredentialsPage(ctx);

        if (
          interaction.type === "form_submit" &&
          interaction.action_id === "save_api_credentials"
        )
          return saveApiCredentials(
            ctx,
            (interaction.values as Record<string, unknown>) ?? {},
          );

        // Webmention actions
        if (
          interaction.type === "button_click" &&
          typeof interaction.action_id === "string" &&
          interaction.action_id.startsWith("delete_wm_")
        ) {
          const wmId = interaction.action_id.replace("delete_wm_", "");
          return deleteWebmention(ctx, decodeURIComponent(wmId));
        }

        if (
          interaction.type === "button_click" &&
          typeof interaction.action_id === "string" &&
          interaction.action_id.startsWith("reverify_wm_")
        ) {
          const payload = interaction.action_id.replace("reverify_wm_", "");
          const [wmId, source, target] = payload.split("|");
          if (wmId && source && target) {
            return reverifyWebmention(
              ctx,
              decodeURIComponent(wmId),
              decodeURIComponent(source),
              decodeURIComponent(target),
            );
          }
        }

        return { blocks: [] };
      },
    },

    webmention: {
      public: true,
      handler: async (
        routeCtx: { input: Record<string, unknown>; request: Request },
        ctx: PluginContext,
      ) => {
        const request = routeCtx.request;

        if (request.method === "GET") {
          const url = new URL(request.url);
          const target = url.searchParams.get("target");
          if (!target) return { error: "Missing target query parameter" };

          const result = await ctx.storage.webmentions.query({
            where: { target, verified: true },
            orderBy: { receivedAt: "desc" },
            limit: 100,
          });

          return {
            webmentions: result.items.map((item) =>
              toWebmentionRecord(item.data as Record<string, unknown>),
            ),
          };
        }

        const input = routeCtx.input;
        const source = input.source as string;
        const target = input.target as string;

        const siteUrl = await getSiteUrl(ctx);
        const hostname = siteUrl ? new URL(siteUrl).hostname : "";
        const acceptedDomains = hostname ? [hostname] : [];

        const validation = validateWebmention(
          source || "",
          target || "",
          acceptedDomains,
        );
        if (!validation.valid) return { error: validation.error };

        const id = `${encodeURIComponent(source)}::${encodeURIComponent(target)}`;

        const record: WebmentionRecord = {
          source,
          target,
          verified: false,
          type: "mention",
          receivedAt: new Date().toISOString(),
        };

        await ctx.storage.webmentions.put(
          id,
          record as unknown as Record<string, unknown>,
        );

        if (ctx.http) {
          void verifyInBackground(ctx, id, source, target);
        }

        return { status: "accepted" };
      },
    },

    // ── Lookup routes (ported from WP Post Kinds plugin) ──────────
    lookup: {
      handler: async (
        routeCtx: { input: Record<string, unknown> },
        ctx: PluginContext,
      ) => {
        if (!ctx.http) {
          return { error: "network:fetch capability required for lookups" };
        }

        const input = routeCtx.input;
        const type = input.type as string;
        const query = input.q as string;

        if (!type || !query) {
          return { error: "Missing required parameters: type, q" };
        }

        try {
          let results;
          switch (type) {
            case "music":
              results = await lookupMusic(
                ctx,
                query,
                input.artist as string | undefined,
              );
              break;
            case "video":
              results = await lookupVideo(
                ctx,
                query,
                (input.mediaType as string) ?? "multi",
              );
              break;
            case "book":
              results = await lookupBook(
                ctx,
                query,
                input.isbn as string | undefined,
              );
              break;
            case "game":
              results = await lookupGame(
                ctx,
                query,
                (input.source as string) ?? "rawg",
              );
              break;
            case "venue":
              results = await lookupVenue(
                ctx,
                query,
                input.lat as number | undefined,
                input.lng as number | undefined,
              );
              break;
            case "podcast":
              results = await lookupPodcast(ctx, query);
              break;
            default:
              return { error: `Unknown lookup type: ${type}` };
          }

          return { results };
        } catch (err) {
          ctx.log.warn(
            `Lookup failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          return {
            error: "Lookup failed",
            details: err instanceof Error ? err.message : String(err),
          };
        }
      },
    },

    // ── Setup route — registers 'kind' field on posts collection ──
    setup: {
      handler: async (
        _routeCtx: { input: Record<string, unknown> },
        ctx: PluginContext,
      ) => {
        const enabledRaw = await ctx.kv.get<string>("settings:enabledKinds");
        const enabledKinds: string[] = enabledRaw
          ? JSON.parse(enabledRaw)
          : ["note", "article", "photo", "reply", "like", "repost", "bookmark"];

        const kindOptions = enabledKinds.map((slug) => ({
          label: getPostKind(slug)?.name ?? slug,
          value: slug,
        }));

        const defaultKind =
          (await ctx.kv.get<string>("settings:defaultKind")) ?? "note";

        return {
          fields: [
            {
              slug: "kind",
              type: "select",
              label: "Post Kind",
              options: kindOptions,
              defaultValue: defaultKind,
              collection: "posts",
            },
          ],
          message: `Post kind field configured with ${enabledKinds.length} kinds`,
        };
      },
    },
  },
};

// ─── Background Verification ─────────────────────────────────────────────

async function verifyInBackground(
  ctx: PluginContext,
  id: string,
  source: string,
  target: string,
): Promise<void> {
  try {
    if (!ctx.http) return;

    const response = await ctx.http.fetch(source, {
      headers: { Accept: "text/html" },
    });

    if (response.status === 410) {
      await ctx.storage.webmentions.delete(id);
      return;
    }

    if (response.status < 200 || response.status >= 300) {
      ctx.log.warn(`Verification failed: source returned ${response.status}`);
      return;
    }

    const html = await response.text();
    const contentType = response.headers.get("Content-Type") || "text/html";

    if (!sourceLinksToTarget(html, target, contentType)) {
      await ctx.storage.webmentions.delete(id);
      ctx.log.info(
        "Deleted unverified webmention: source does not link to target",
      );
      return;
    }

    const entry = simpleParseMf2(html);
    const displayType = detectDisplayType(entry, target);
    const author = extractAuthor(entry);
    const content = extractContent(entry);
    const rsvpValue =
      displayType === "rsvp" ? extractRsvpValue(entry) : undefined;

    const record: WebmentionRecord = {
      source,
      target,
      verified: true,
      type: displayType,
      authorName: author?.name,
      authorUrl: author?.url,
      authorPhoto: author?.photo,
      content,
      published: entry.published?.[0],
      receivedAt: new Date().toISOString(),
      rsvpValue,
    };

    await ctx.storage.webmentions.put(
      id,
      record as unknown as Record<string, unknown>,
    );
    ctx.log.info(
      `Verified webmention: ${source} -> ${target} (${displayType})`,
    );
  } catch (err) {
    ctx.log.warn(
      `Verification error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function simpleParseMf2(html: string): SourceMf2Entry {
  const entry: SourceMf2Entry = {};

  const interactionProps = [
    { cls: "u-like-of", prop: "like-of" as const },
    { cls: "u-repost-of", prop: "repost-of" as const },
    { cls: "u-in-reply-to", prop: "in-reply-to" as const },
    { cls: "u-bookmark-of", prop: "bookmark-of" as const },
    { cls: "u-tag-of", prop: "tag-of" as const },
  ];

  for (const { cls, prop } of interactionProps) {
    const pattern = new RegExp(
      `class\\s*=\\s*["'][^"']*${cls}[^"']*["'][^>]*href\\s*=\\s*["']([^"']+)["']` +
        `|href\\s*=\\s*["']([^"']+)["'][^>]*class\\s*=\\s*["'][^"']*${cls}[^"']*["']`,
      "gi",
    );
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1] || match[2];
      if (url) {
        if (!entry[prop]) entry[prop] = [];
        entry[prop]!.push(url);
      }
    }
  }

  const rsvpMatch = html.match(
    /class\s*=\s*["'][^"']*p-rsvp[^"']*["'][^>]*value\s*=\s*["']([^"']+)["']/i,
  );
  if (rsvpMatch) entry.rsvp = [rsvpMatch[1]];

  const authorMatch = html.match(
    /class\s*=\s*["'][^"']*p-author[^"']*["'][^>]*>([^<]*)</i,
  );
  if (authorMatch && authorMatch[1].trim())
    entry.author = [authorMatch[1].trim()];

  const contentMatch = html.match(
    /class\s*=\s*["'][^"']*e-content[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i,
  );
  if (contentMatch) {
    const htmlContent = contentMatch[1].trim();
    const textContent = htmlContent.replace(/<[^>]+>/g, "").trim();
    entry.content = [{ html: htmlContent, value: textContent }];
  }

  const publishedMatch = html.match(
    /class\s*=\s*["'][^"']*dt-published[^"']*["'][^>]*datetime\s*=\s*["']([^"']+)["']/i,
  );
  if (publishedMatch) entry.published = [publishedMatch[1]];

  return entry;
}
