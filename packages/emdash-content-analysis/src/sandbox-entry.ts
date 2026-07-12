/**
 * Sandbox Entry Point — EmDash Content Analysis Plugin
 *
 * Standard-format plugin that works in both trusted (in-process)
 * and sandboxed (isolate) modes.
 *
 * Routes:
 * - admin — Block Kit UI: pick a post + optional focus keyphrase,
 *   get Yoast-style readability and keyphrase checks.
 */
import type { PluginContext } from "emdash";
import { analyzeContent, extractPortableText } from "./analysis.js";
import type { AnalysisCheck, CheckStatus } from "./analysis.js";

const COLLECTION = "posts";
const PAGE_PATH = "/content-analysis";

/** Narrow an untrusted route-input value to a string, else undefined. */
function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function badgeStyle(status: CheckStatus): "success" | "warning" | "danger" {
  switch (status) {
    case "good":
      return "success";
    case "ok":
      return "warning";
    case "poor":
      return "danger";
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled check status: ${exhaustive}`);
    }
  }
}

function badgeText(status: CheckStatus): string {
  switch (status) {
    case "good":
      return "Good";
    case "ok":
      return "OK";
    case "poor":
      return "Needs work";
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled check status: ${exhaustive}`);
    }
  }
}

function checkBlocks(checks: AnalysisCheck[]) {
  return checks.map((check) => ({
    type: "section" as const,
    text: `**${check.label}**\n${check.detail}`,
    accessory: {
      type: "badge" as const,
      text: badgeText(check.status),
      style: badgeStyle(check.status),
    },
  }));
}

async function listPostOptions(ctx: PluginContext) {
  if (!ctx.content) return [];
  const result = await ctx.content.list(COLLECTION, {
    limit: 50,
    orderBy: { updatedAt: "desc" },
  });
  return result.items.map((item) => {
    const data = item.data as Record<string, unknown>;
    const title =
      (typeof data.title === "string" && data.title.trim()) ||
      item.slug ||
      item.id;
    const status = item.status === "published" ? "" : ` (${item.status})`;
    return { label: `${title}${status}`, value: item.id };
  });
}

async function buildAnalysisPage(
  ctx: PluginContext,
  state?: { postId?: string; keyphrase?: string },
) {
  const options = await listPostOptions(ctx);

  const formBlock =
    options.length > 0
      ? {
          type: "form" as const,
          block_id: "content-analysis-form",
          fields: [
            {
              type: "select" as const,
              action_id: "postId",
              label: "Post",
              options,
              ...(state?.postId ? { initial_value: state.postId } : {}),
            },
            {
              type: "text_input" as const,
              action_id: "keyphrase",
              label: "Focus keyphrase (optional)",
              placeholder: "e.g. open source community",
              initial_value: state?.keyphrase ?? "",
            },
          ],
          submit: { label: "Analyze", action_id: "analyze_content" },
        }
      : {
          type: "context" as const,
          text: "No posts found — create a post first, then analyze it here.",
        };

  return {
    blocks: [
      { type: "header", text: "Content Analysis" },
      {
        type: "context",
        text: "Readability (Flesch Reading Ease) and focus-keyphrase checks for your posts, in the spirit of Yoast SEO.",
      },
      { type: "divider" },
      formBlock,
    ],
  };
}

async function runAnalysis(ctx: PluginContext, values: Record<string, unknown>) {
  const postId = asString(values.postId);
  const keyphrase = asString(values.keyphrase)?.trim() || undefined;

  if (!postId || !ctx.content) {
    return {
      ...(await buildAnalysisPage(ctx)),
      toast: { message: "Choose a post to analyze", type: "error" as const },
    };
  }

  const item = await ctx.content.get(COLLECTION, postId);
  if (!item) {
    return {
      ...(await buildAnalysisPage(ctx)),
      toast: { message: "Post not found", type: "error" as const },
    };
  }

  const data = item.data as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title : undefined;
  const text = extractPortableText(data.content);

  if (!text.trim()) {
    return {
      ...(await buildAnalysisPage(ctx, { postId, keyphrase })),
      toast: {
        message: "This post has no body text to analyze",
        type: "error" as const,
      },
    };
  }

  const result = analyzeContent({ title, text, keyphrase });
  const page = await buildAnalysisPage(ctx, { postId, keyphrase });

  return {
    blocks: [
      ...page.blocks,
      { type: "divider" },
      {
        type: "header",
        text: `Results: ${title?.trim() || item.slug || "Untitled"}`,
      },
      {
        type: "stats",
        items: [
          { label: "Words", value: String(result.wordCount) },
          { label: "Sentences", value: String(result.sentenceCount) },
          {
            label: "Flesch score",
            value: `${result.fleschScore} (${result.fleschBand})`,
          },
          ...(result.keyphrase
            ? [
                {
                  label: "Keyphrase density",
                  value: `${result.keyphrase.density}%`,
                },
              ]
            : []),
        ],
      },
      ...checkBlocks(result.checks),
    ],
  };
}

// ─── Plugin Definition ───────────────────────────────────────────────────

export default {
  routes: {
    admin: {
      handler: async (
        routeCtx: { input: Record<string, unknown> },
        ctx: PluginContext,
      ) => {
        const interaction = routeCtx.input;

        if (
          interaction.type === "page_load" &&
          interaction.page === PAGE_PATH
        ) {
          return buildAnalysisPage(ctx);
        }

        if (
          interaction.type === "form_submit" &&
          interaction.action_id === "analyze_content"
        ) {
          return runAnalysis(
            ctx,
            (interaction.values as Record<string, unknown>) ?? {},
          );
        }

        return { blocks: [] };
      },
    },
  },
};
