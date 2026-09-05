import { describe, expect, it } from "vitest";
import { relativePath } from "./imageAttachments";

describe("relativePath", () => {
  it("links from the note's folder to the attachments folder", () => {
    expect(relativePath("/v", "/v/attachments/a.png")).toBe(
      "attachments/a.png",
    );
    expect(relativePath("/v/sub/deep", "/v/attachments/a.png")).toBe(
      "../../attachments/a.png",
    );
    expect(relativePath("/v/attachments", "/v/attachments/a.png")).toBe(
      "a.png",
    );
  });
});
