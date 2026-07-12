import { describe, expect, it } from "vitest";
import {
  analyzeContent,
  containsKeyphrase,
  countSyllables,
  extractPortableText,
  fleschBand,
  fleschReadingEase,
  keyphraseDensity,
  splitParagraphs,
  splitSentences,
  splitWords,
} from "../analysis.js";

describe("splitWords", () => {
  it("splits on whitespace and punctuation", () => {
    expect(splitWords("Hello, world! It's fine.")).toEqual([
      "Hello",
      "world",
      "It's",
      "fine",
    ]);
  });

  it("returns empty array for empty text", () => {
    expect(splitWords("")).toEqual([]);
    expect(splitWords("  ... !!! ")).toEqual([]);
  });
});

describe("splitSentences", () => {
  it("splits on terminal punctuation", () => {
    const text = "First sentence. Second one! Third?";
    expect(splitSentences(text)).toHaveLength(3);
  });

  it("treats blank lines as sentence boundaries", () => {
    expect(splitSentences("no punctuation here\n\nsecond block")).toHaveLength(
      2,
    );
  });

  it("ignores empty fragments", () => {
    expect(splitSentences("One.  \n\n  ")).toHaveLength(1);
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines", () => {
    expect(splitParagraphs("a\n\nb\n\n\nc")).toEqual(["a", "b", "c"]);
  });
});

describe("countSyllables", () => {
  it("counts common words", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("water")).toBe(2);
    expect(countSyllables("beautiful")).toBe(3);
    expect(countSyllables("syllable")).toBe(3);
  });

  it("handles silent e", () => {
    expect(countSyllables("make")).toBe(1);
    expect(countSyllables("table")).toBe(2);
  });

  it("handles -ed endings", () => {
    expect(countSyllables("walked")).toBe(1);
    expect(countSyllables("wanted")).toBe(2);
  });

  it("returns at least 1 for any word", () => {
    expect(countSyllables("hmm")).toBe(1);
  });

  it("returns 0 for non-alphabetic input", () => {
    expect(countSyllables("123")).toBe(0);
  });
});

describe("fleschReadingEase", () => {
  it("scores simple text as easy", () => {
    const simple = "The cat sat. The dog ran. We had fun. It was good.";
    expect(fleschReadingEase(simple)).toBeGreaterThan(80);
  });

  it("scores dense text as harder than simple text", () => {
    const simple = "The cat sat. The dog ran. We had fun.";
    const dense =
      "Notwithstanding considerable organizational complexities, interdepartmental communication methodologies necessitate comprehensive reevaluation procedures alongside institutional accountability frameworks.";
    expect(fleschReadingEase(dense)).toBeLessThan(fleschReadingEase(simple));
  });

  it("returns 0 for empty text", () => {
    expect(fleschReadingEase("")).toBe(0);
  });

  it("clamps to the 0-100 range", () => {
    const score = fleschReadingEase("Go. Do. Be.");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("fleschBand", () => {
  it("maps scores to bands", () => {
    expect(fleschBand(95)).toBe("very easy");
    expect(fleschBand(65)).toBe("standard");
    expect(fleschBand(10)).toBe("very difficult");
  });
});

describe("keyphraseDensity", () => {
  it("counts single-word keyphrases case-insensitively", () => {
    const stats = keyphraseDensity(
      "IndieWeb is great. I love the indieweb movement.",
      "IndieWeb",
    );
    expect(stats.count).toBe(2);
  });

  it("matches multi-word phrases in order", () => {
    const text = "Open source together. We build open source together daily.";
    expect(keyphraseDensity(text, "open source together").count).toBe(2);
    expect(keyphraseDensity(text, "source open").count).toBe(0);
  });

  it("does not match partial words", () => {
    expect(keyphraseDensity("The catalog is long", "cat").count).toBe(0);
  });

  it("computes density per 100 words", () => {
    // 10 words, 1 occurrence => 10%
    const text = "alpha beta gamma delta epsilon zeta eta theta iota focus";
    expect(keyphraseDensity(text, "focus").density).toBe(10);
  });

  it("returns zeros for empty inputs", () => {
    expect(keyphraseDensity("", "x")).toEqual({ count: 0, density: 0 });
    expect(keyphraseDensity("some text", "")).toEqual({ count: 0, density: 0 });
  });
});

describe("containsKeyphrase", () => {
  it("detects presence", () => {
    expect(containsKeyphrase("My Open Source Story", "open source")).toBe(true);
    expect(containsKeyphrase("My Story", "open source")).toBe(false);
  });
});

describe("extractPortableText", () => {
  it("joins block children and paragraphs", () => {
    const blocks = [
      {
        _type: "block",
        children: [{ text: "Hello " }, { text: "world." }],
      },
      {
        _type: "block",
        children: [{ text: "Second paragraph." }],
      },
    ];
    expect(extractPortableText(blocks)).toBe(
      "Hello world.\n\nSecond paragraph.",
    );
  });

  it("skips malformed blocks", () => {
    expect(
      extractPortableText([null, 42, { children: "nope" }, { children: [] }]),
    ).toBe("");
    expect(extractPortableText("not an array")).toBe("");
  });
});

describe("analyzeContent", () => {
  const longText = Array.from(
    { length: 40 },
    () => "The quick brown fox jumps over the lazy dog near the river bank.",
  ).join(" ");

  it("reports word count, flesch, sentence and paragraph checks", () => {
    const result = analyzeContent({ text: longText });
    expect(result.wordCount).toBeGreaterThan(300);
    expect(result.checks.map((c) => c.id)).toEqual([
      "word-count",
      "flesch",
      "sentence-length",
      "paragraph-length",
    ]);
    expect(result.checks.find((c) => c.id === "word-count")?.status).toBe(
      "good",
    );
  });

  it("adds keyphrase checks when a keyphrase is given", () => {
    const result = analyzeContent({
      title: "Fox watching",
      text: longText,
      keyphrase: "brown fox",
    });
    const ids = result.checks.map((c) => c.id);
    expect(ids).toContain("keyphrase-density");
    expect(ids).toContain("keyphrase-title");
    expect(ids).toContain("keyphrase-intro");
    expect(result.keyphrase?.count).toBe(40);
  });

  it("flags a missing keyphrase as poor density", () => {
    const result = analyzeContent({
      text: "Nothing relevant here at all.",
      keyphrase: "quantum computing",
    });
    expect(
      result.checks.find((c) => c.id === "keyphrase-density")?.status,
    ).toBe("poor");
  });

  it("treats title-less posts as acceptable for the title check", () => {
    const result = analyzeContent({
      text: "A note about open source.",
      keyphrase: "open source",
    });
    expect(result.checks.find((c) => c.id === "keyphrase-title")?.status).toBe(
      "ok",
    );
  });

  it("flags long paragraphs", () => {
    const oneParagraph = Array.from(
      { length: 30 },
      () => "word word word word word word",
    ).join(" ");
    const result = analyzeContent({ text: oneParagraph });
    expect(
      result.checks.find((c) => c.id === "paragraph-length")?.status,
    ).not.toBe("good");
  });
});
