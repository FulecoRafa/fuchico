/**
 * Dependency-free parser for YAML frontmatter (`---\n…\n---`) at the very
 * start of a note. There's no `yaml`/`js-yaml` dependency in this project
 * (checked package.json), so this covers only the common frontmatter shapes
 * rather than being a general YAML parser:
 *
 *   - scalar values: `key: value` (string/number/boolean/null)
 *   - quoted strings: `key: "value"` / `key: 'value'`
 *   - inline lists: `key: [a, b, "c d"]`
 *   - block lists:
 *       key:
 *         - a
 *         - b
 *
 * Nested maps and multi-line (block scalar `|`/`>`) values are NOT
 * supported and are left as their raw string form. That's an intentional
 * scope cut for an editor-metadata feature (issue #23) rather than a
 * general-purpose YAML engine.
 */

export interface ParsedFrontmatter {
  /** Parsed key/value pairs from the frontmatter block. */
  data: Record<string, unknown>;
  /** Raw YAML text between the fences (excluding the `---` lines themselves). */
  raw: string;
  /** Character offset in the original document where the note body starts,
   * i.e. right after the closing `---` line (and its trailing newline, if
   * any). */
  bodyStart: number;
  /** 1-indexed line number of the closing `---` fence. */
  endLine: number;
}

/**
 * Parses a leading YAML frontmatter block from `text`. Returns `null` when
 * the document doesn't open with a `---` fence on line 1, or when no
 * matching closing fence (`---` or `...`) is found.
 */
export function parseFrontmatter(text: string): ParsedFrontmatter | null {
  if (!text.startsWith("---")) return null;

  const lines = text.split("\n");
  if (lines[0].trim() !== "---") return null;

  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "---" || trimmed === "...") {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) return null;

  const yamlLines = lines.slice(1, closeIdx).map((l) => l.replace(/\r$/, ""));
  const raw = yamlLines.join("\n");
  const data = parseYamlBlock(yamlLines);

  // Line start offsets, computed once over the raw text so bodyStart is
  // exact even with \r\n line endings.
  const lineOffsets: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lineOffsets.push(i + 1);
  }
  const bodyStart =
    closeIdx + 1 < lineOffsets.length ? lineOffsets[closeIdx + 1] : text.length;

  return { data, raw, bodyStart, endLine: closeIdx + 1 };
}

// ─── Minimal block-YAML parser ─────────────────────────────────────────────

function parseYamlBlock(lines: string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const KEY_RE = /^([^:\s][^:]*):[ \t]?(.*)$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      i++;
      continue;
    }

    const match = line.match(KEY_RE);
    if (!match) {
      // Not a recognizable `key: …` line (e.g. stray/nested content) --
      // skip rather than throw, keeping the parser tolerant of malformed
      // frontmatter.
      i++;
      continue;
    }

    const key = match[1].trim();
    const valueStr = match[2].trim();

    if (valueStr === "") {
      // Possibly a block list: subsequent indented `- item` lines.
      const items: unknown[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        const nextTrimmed = next.trim();
        if (nextTrimmed === "") {
          j++;
          continue;
        }
        if (nextTrimmed.startsWith("- ") || nextTrimmed === "-") {
          const itemVal =
            nextTrimmed === "-" ? "" : nextTrimmed.slice(2).trim();
          items.push(coerceScalar(stripQuotes(itemVal)));
          j++;
          continue;
        }
        break;
      }
      if (items.length > 0) {
        data[key] = items;
        i = j;
        continue;
      }
      data[key] = null;
      i++;
      continue;
    }

    if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
      const inner = valueStr.slice(1, -1).trim();
      data[key] =
        inner === ""
          ? []
          : splitTopLevelComma(inner).map((s) =>
              coerceScalar(stripQuotes(s.trim())),
            );
    } else {
      data[key] = coerceScalar(stripQuotes(valueStr));
    }
    i++;
  }

  return data;
}

function stripQuotes(s: string): string {
  if (
    s.length >= 2 &&
    ((s[0] === '"' && s[s.length - 1] === '"') ||
      (s[0] === "'" && s[s.length - 1] === "'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function coerceScalar(s: string): unknown {
  if (s === "" || s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+$/.test(s)) return Number.parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return Number.parseFloat(s);
  return s;
}

/** Splits a comma-separated inline-list body, respecting quoted segments so
 * commas inside `"a, b"` aren't treated as separators. */
function splitTopLevelComma(s: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote: string | null = null;
  for (const ch of s) {
    if (inQuote) {
      cur += ch;
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      cur += ch;
      continue;
    }
    if (ch === ",") {
      result.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result;
}
