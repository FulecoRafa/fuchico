import { describe, expect, it } from "vitest";
import {
  allTags,
  frontmatterTags,
  matchInlineTagsInLine,
  normalizeTag,
  parseInlineTags,
} from "./parseTags";

describe("matchInlineTagsInLine", () => {
  it("matches a simple tag", () => {
    const m = matchInlineTagsInLine("some text #foo more text");
    expect(m).toHaveLength(1);
    expect(m[0].tag).toBe("foo");
  });

  it("matches a tag at the start of a line", () => {
    const m = matchInlineTagsInLine("#foo rest of line");
    expect(m).toHaveLength(1);
    expect(m[0].tag).toBe("foo");
    expect(m[0].from).toBe(0);
  });

  it("matches nested tags with slashes", () => {
    const m = matchInlineTagsInLine("see #foo/bar for details");
    expect(m).toHaveLength(1);
    expect(m[0].tag).toBe("foo/bar");
  });

  it("matches multiple tags on one line", () => {
    const m = matchInlineTagsInLine("#one and #two");
    expect(m.map((x) => x.tag)).toEqual(["one", "two"]);
  });

  it("does not match a bare ATX heading", () => {
    expect(matchInlineTagsInLine("# Heading")).toHaveLength(0);
    expect(matchInlineTagsInLine("## Sub heading")).toHaveLength(0);
    expect(matchInlineTagsInLine("###### Deep heading")).toHaveLength(0);
  });

  it("matches a tag inside a heading line after the heading text", () => {
    const m = matchInlineTagsInLine("## Heading #tag");
    expect(m).toHaveLength(1);
    expect(m[0].tag).toBe("tag");
  });

  it("does not match a URL fragment", () => {
    expect(
      matchInlineTagsInLine("see example.com/#frag for info"),
    ).toHaveLength(0);
  });

  it("does not match mid-word hits", () => {
    expect(matchInlineTagsInLine("foo#bar")).toHaveLength(0);
  });

  it("does not match a bare number", () => {
    expect(matchInlineTagsInLine("issue #123")).toHaveLength(0);
  });

  it("does not match inside an inline code span", () => {
    expect(matchInlineTagsInLine("use `#notatag` here")).toHaveLength(0);
  });

  it("trims trailing punctuation-like separators", () => {
    const m = matchInlineTagsInLine("#foo/ end");
    expect(m).toHaveLength(1);
    expect(m[0].tag).toBe("foo");
  });

  it("stops a tag at punctuation", () => {
    const m = matchInlineTagsInLine("great post, #foo, nice");
    expect(m).toHaveLength(1);
    expect(m[0].tag).toBe("foo");
  });

  it("does not match when preceded by a non-whitespace character like '('", () => {
    // Only start-of-line/whitespace count as valid preceding context, per
    // spec -- this also keeps `(#123)`-style non-tag references out.
    expect(matchInlineTagsInLine("great post (#foo).")).toHaveLength(0);
  });
});

describe("parseInlineTags", () => {
  it("skips tags inside fenced code blocks", () => {
    const content = [
      "before #real",
      "```",
      "#fake in code",
      "```",
      "after",
    ].join("\n");
    const tags = parseInlineTags(content).map((m) => m.tag);
    expect(tags).toEqual(["real"]);
  });

  it("computes correct offsets across multiple lines", () => {
    const content = "line one\nline two #tag here";
    const [match] = parseInlineTags(content);
    expect(content.slice(match.from, match.to)).toBe("#tag");
  });

  it("handles tilde fences too", () => {
    const content = ["~~~", "#fake", "~~~", "#real"].join("\n");
    const tags = parseInlineTags(content).map((m) => m.tag);
    expect(tags).toEqual(["real"]);
  });
});

describe("frontmatterTags", () => {
  it("parses an inline array", () => {
    const content = ["---", 'tags: [a, b, "c d"]', "---", "body"].join("\n");
    expect(frontmatterTags(content)).toEqual(["a", "b", "c d"]);
  });

  it("parses a block list", () => {
    const content = ["---", "tags:", "  - a", "  - b", "---", "body"].join(
      "\n",
    );
    expect(frontmatterTags(content)).toEqual(["a", "b"]);
  });

  it("parses a space-separated scalar line", () => {
    const content = ["---", "tags: a b c", "---", "body"].join("\n");
    expect(frontmatterTags(content)).toEqual(["a", "b", "c"]);
  });

  it("returns empty when there is no frontmatter", () => {
    expect(frontmatterTags("# just a note\nno frontmatter here")).toEqual([]);
  });

  it("returns empty when frontmatter has no tags key", () => {
    const content = ["---", "title: hello", "---", "body"].join("\n");
    expect(frontmatterTags(content)).toEqual([]);
  });
});

describe("normalizeTag", () => {
  it("strips a leading #", () => {
    expect(normalizeTag("#foo")).toBe("foo");
    expect(normalizeTag("foo")).toBe("foo");
  });
});

describe("allTags", () => {
  it("merges inline and frontmatter tags, deduped", () => {
    const content = [
      "---",
      "tags: [shared, fm-only]",
      "---",
      "body with #shared and #inline-only",
    ].join("\n");
    expect(new Set(allTags(content))).toEqual(
      new Set(["shared", "fm-only", "inline-only"]),
    );
  });
});
