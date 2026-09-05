import { describe, expect, it } from "vitest";
import { editorWindowLabel, editorWindowUrl } from "./editorWindow";

describe("editorWindow", () => {
  it("derives a stable, capability-safe label from the path", () => {
    const a = editorWindowLabel("/vault/notes/Café ünïcode.md");
    expect(a).toBe(editorWindowLabel("/vault/notes/Café ünïcode.md"));
    expect(a).toMatch(/^editor-[a-z0-9]+$/);
    expect(a).not.toBe(editorWindowLabel("/vault/notes/other.md"));
  });
  it("builds the route with path and root", () => {
    expect(editorWindowUrl("/v/a b.md", "/v")).toBe(
      "index.html?window=editor&path=%2Fv%2Fa+b.md&root=%2Fv",
    );
    expect(editorWindowUrl("/v/a.md", null)).toBe(
      "index.html?window=editor&path=%2Fv%2Fa.md",
    );
  });
});
