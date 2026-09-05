import { describe, expect, it } from "vitest";
import { linkForDroppedPath } from "./pathDrop";

describe("linkForDroppedPath", () => {
  const here = "/vault/notes/today.md";
  it("turns notes into wikilinks", () => {
    expect(linkForDroppedPath("/vault/sub/Inner Note.md", here)).toBe(
      "[[Inner Note]]",
    );
  });
  it("embeds images with a relative path", () => {
    expect(linkForDroppedPath("/vault/attachments/pic.png", here)).toBe(
      "![pic](../attachments/pic.png)",
    );
  });
  it("links other files relatively", () => {
    expect(linkForDroppedPath("/vault/notes/spec.pdf", here)).toBe(
      "[spec](spec.pdf)",
    );
  });
});
