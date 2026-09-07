import { describe, expect, it } from "vitest";
import { renderHtml, rewriteWikilinks } from "./renderHtml";

describe("rewriteWikilinks", () => {
  it("turns wikilinks into relative html links", () => {
    expect(rewriteWikilinks("see [[Note B|alias]] and [[C#Head ing]]")).toBe(
      "see [alias](Note%20B.html) and [C#Head ing](C.html#head-ing)",
    );
    expect(rewriteWikilinks("![[pic.png]]")).toBe("![pic.png](pic.png)");
  });
});

describe("renderHtml", () => {
  it("renders a standalone document with theme vars and no frontmatter", () => {
    const html = renderHtml("---\ntitle: x\n---\n# Hi\n\n- [ ] todo\n", {
      title: "Hi",
      themeVars: { "--background": "white" },
      mode: "light",
      resolveHref: (h) => `X:${h}`,
    });
    expect(html).toContain("<title>Hi</title>");
    expect(html).toContain("--background: white;");
    expect(html).toContain("<h1>Hi</h1>");
    expect(html).toContain('<li class="task"><input type="checkbox" disabled>');
    expect(html).not.toContain("title: x");
  });
});
