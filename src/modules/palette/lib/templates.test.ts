import { describe, expect, it } from "vitest";
import { expandTemplate, formatDate, listTemplates, stem } from "./templates";

describe("templates", () => {
  const now = new Date(2026, 7, 27, 9, 5, 7);

  it("formats dates with the supported tokens", () => {
    expect(formatDate(now)).toBe("2026-08-27");
    expect(formatDate(now, "DD/MM/YYYY HH:mm")).toBe("27/08/2026 09:05");
  });

  it("expands template variables", () => {
    const out = expandTemplate(
      "# {{title}}\n{{date}} {{ time }} {{date:YYYY}} {{unknown}}",
      { title: "T", now },
    );
    expect(out).toBe("# T\n2026-08-27 09:05 2026 {{unknown}}");
  });

  it("lists markdown templates, excluding the reserved daily.md", () => {
    const files = [
      "/v/templates/daily.md",
      "/v/templates/meeting.md",
      "/v/templates/notes.txt",
      "/v/notes.md",
      "/v/templatesX/a.md",
    ];
    expect(listTemplates("/v", "/templates/", files)).toEqual([
      "/v/templates/meeting.md",
    ]);
    expect(stem("/v/templates/meeting.md")).toBe("meeting");
  });
});
