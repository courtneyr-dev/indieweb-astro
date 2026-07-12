/**
 * EmDash Content Analysis Plugin — Descriptor Factory
 *
 * Yoast-style readability and keyphrase analysis for EmDash content.
 * Adds a "Content Analysis" admin page where any post can be scored for
 * Flesch Reading Ease, sentence/paragraph length, and keyphrase usage.
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import { emdashContentAnalysis } from "@opensourcetogether/emdash-content-analysis";
 *
 * export default defineConfig({
 *   integrations: [
 *     emdash({
 *       plugins: [emdashContentAnalysis()],
 *     }),
 *   ],
 * });
 * ```
 */
import type { PluginDescriptor } from "emdash";

/** Create the EmDash content-analysis plugin descriptor. */
export function emdashContentAnalysis(): PluginDescriptor {
  return {
    id: "content-analysis",
    version: "0.1.0",
    format: "standard",
    entrypoint: "@opensourcetogether/emdash-content-analysis/sandbox",
    capabilities: ["content:read"],
    adminPages: [
      {
        path: "/content-analysis",
        label: "Content Analysis",
        icon: "bar-chart-2",
      },
    ],
  };
}

export {
  analyzeContent,
  extractPortableText,
  fleschReadingEase,
  fleschBand,
  keyphraseDensity,
} from "./analysis.js";
export type {
  AnalysisCheck,
  AnalysisResult,
  AnalyzeInput,
  CheckStatus,
  KeyphraseStats,
} from "./analysis.js";
