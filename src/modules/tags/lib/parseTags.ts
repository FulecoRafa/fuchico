/**
 * Tag parsing: inline `#tag` / `#foo/bar` (nested) references plus
 * frontmatter `tags:` lists.
 *
 * Inline matching rules (mirrors the Rust `tags_scan` implementation in
 * `src-tauri/src/modules/tags/mod.rs` -- keep the two in sync):
 *  - the `#` must be preceded by start-of-line or whitespace (excludes
 *    mid-word hits and URL fragments like `example.com/#frag`);
 *  - the `#` must be followed by a letter (excludes bare `#123`, and -- since
 *    ATX headings require a space after their `#`s -- naturally excludes
 *    `# Heading` / `## Heading` too);
 *  - the tag body may contain letters, digits, `_`, `-`, and `/` (nesting),
 *    with trailing separators trimmed;
 *  - matches inside fenced code blocks or inline code spans are skipped.
 */

import { parseFrontmatter } from "@/modules/frontmatter";

export type InlineTagMatch = {
  /** Normalized tag text, without the leading `#`. */
  tag: string;
  /** Offset of the `#` character in the original content. */
  from: number;
  /** Offset just past the last character of the tag. */
  to: number;
};

const INLINE_TAG_RE = /(?<=^|\s)#(\p{L}[\p{L}\p{N}_/-]*)/gu;
const FENCE_RE = /^(\s*)(`{3,}|~{3,})/;
const CODE_SPAN_RE = /(`+)([^`]*?)\1/g;

/** Replaces inline code spans with spaces of the same length, preserving
 * the line's length/offsets so tag positions stay valid. */
function maskInlineCode(line: string): string {
  return line.replace(CODE_SPAN_RE, (m) => " ".repeat(m.length));
}

/** Finds every inline `#tag` in a single line (already stripped of fenced
 * code / inline code). Positions are relative to `line`. */
export function matchInlineTagsInLine(line: string): InlineTagMatch[] {
  const masked = maskInlineCode(line);
  const matches: InlineTagMatch[] = [];
  INLINE_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec loop
  while ((m = INLINE_TAG_RE.exec(masked))) {
    const tag = m[1].replace(/[/_-]+$/, "");
    if (!tag) continue;
    const from = m.index;
    matches.push({ tag, from, to: from + 1 + tag.length });
  }
  return matches;
}

/** Scans an entire note for inline `#tag` references, skipping fenced code
 * blocks and inline code spans. */
export function parseInlineTags(content: string): InlineTagMatch[] {
  const results: InlineTagMatch[] = [];
  const lines = content.split("\n");
  let offset = 0;
  let inFence = false;
  let fenceMarker = "";

  for (const line of lines) {
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const marker = fenceMatch[2][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
      }
      offset += line.length + 1;
      continue;
    }

    if (!inFence) {
      for (const match of matchInlineTagsInLine(line)) {
        results.push({
          tag: match.tag,
          from: offset + match.from,
          to: offset + match.to,
        });
      }
    }
    offset += line.length + 1;
  }

  return results;
}

/**
 * Reads `tags:` from a note's YAML frontmatter (the `---`-delimited block at
 * the very start of the file), delegating YAML parsing to the frontmatter
 * module (issue #23). Handles both the list forms (`tags: [a, b]` /
 * `tags:\n  - a`), which `parseFrontmatter` returns as an array, and the
 * space/comma-separated scalar form (`tags: a b` / `tags: a, b`), which it
 * returns as a single string that we split here.
 */
export function frontmatterTags(content: string): string[] {
  const raw = parseFrontmatter(content)?.data.tags;
  if (raw == null) return [];

  const tags: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const t = String(item).trim();
      if (t) tags.push(t);
    }
  } else if (typeof raw === "string") {
    for (const part of raw.split(/[\s,]+/)) {
      if (part) tags.push(part);
    }
  } else {
    const t = String(raw).trim();
    if (t) tags.push(t);
  }
  return tags;
}

/** Strips a leading `#` (frontmatter tags are sometimes written with one)
 * and trims whitespace. */
export function normalizeTag(tag: string): string {
  return tag.replace(/^#/, "").trim();
}

/** All unique tags referenced by a note: inline `#tag`s plus frontmatter
 * `tags:`. */
export function allTags(content: string): string[] {
  const set = new Set<string>();
  for (const m of parseInlineTags(content)) set.add(m.tag);
  for (const t of frontmatterTags(content)) {
    const normalized = normalizeTag(t);
    if (normalized) set.add(normalized);
  }
  return [...set];
}
