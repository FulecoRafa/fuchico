import { describe, expect, it } from "vitest";
import { backlinksFor, type LinkRef } from "./useBacklinks";

const files = ["/v/a.md", "/v/sub/b.md", "/v/c.md"];

describe("backlinksFor", () => {
  it("resolves wikilinks and relative markdown links, grouped by source", () => {
    const refs: LinkRef[] = [
      {
        path: "/v/a.md",
        line: 3,
        target: "b|alias",
        kind: "wiki",
        context: "x",
      },
      { path: "/v/a.md", line: 3, target: "b#h", kind: "wiki", context: "x" },
      {
        path: "/v/c.md",
        line: 1,
        target: "./sub/b.md",
        kind: "markdown",
        context: "y",
      },
      { path: "/v/c.md", line: 2, target: "a", kind: "wiki", context: "z" },
      {
        path: "/v/sub/b.md",
        line: 9,
        target: "b",
        kind: "wiki",
        context: "self",
      },
    ];
    const groups = backlinksFor(refs, "/v/sub/b.md", files);
    expect(groups).toEqual([
      { path: "/v/a.md", refs: [{ line: 3, context: "x" }] },
      { path: "/v/c.md", refs: [{ line: 1, context: "y" }] },
    ]);
  });
});
