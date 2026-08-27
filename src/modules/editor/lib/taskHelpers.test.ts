import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  DUE_RE,
  dueDateOptions,
  lineTokenSpec,
  RECUR_RE,
  toggleTaskLineSpec,
} from "./taskHelpers";

function state(doc: string, cursor = doc.length) {
  return EditorState.create({ doc, selection: { anchor: cursor } });
}
function toggled(doc: string) {
  const s = state(doc);
  const spec = toggleTaskLineSpec(s);
  return spec ? s.update(spec).state.doc.toString() : doc;
}
function withToken(
  doc: string,
  re: RegExp,
  emoji: string,
  v: string,
  t?: string,
  cursor?: number,
) {
  const s = state(doc, cursor);
  return s.update(lineTokenSpec(s, re, emoji, v, t)).state.doc.toString();
}

describe("toggleTaskLineSpec", () => {
  it("turns a plain line into a task", () => {
    expect(toggled("Buy milk")).toBe("- [ ] Buy milk");
  });
  it("adds a checkbox to a list item and removes it from a task", () => {
    expect(toggled("- item")).toBe("- [ ] item");
    expect(toggled("- [ ] item")).toBe("- item");
    expect(toggled("- [x] done")).toBe("- done");
  });
  it("keeps indentation", () => {
    expect(toggled("  nested")).toBe("  - [ ] nested");
  });
});

describe("lineTokenSpec", () => {
  it("appends a date token", () => {
    expect(withToken("- [ ] call vet", DUE_RE, "📅", "2026-08-28")).toBe(
      "- [ ] call vet 📅 2026-08-28",
    );
  });
  it("replaces an existing date and keeps its time", () => {
    expect(
      withToken(
        "- [ ] x 📅 2026-01-01 10:00 tail",
        DUE_RE,
        "📅",
        "2026-02-02",
        undefined,
        3,
      ),
    ).toBe("- [ ] x 📅 2026-02-02 10:00 tail");
  });
  it("appends a recurrence token with a time", () => {
    expect(
      withToken("- [ ] trash", RECUR_RE, "🔁", "mon,wed,fri", "08:00"),
    ).toBe("- [ ] trash 🔁 mon,wed,fri 08:00");
  });
});

describe("dueDateOptions", () => {
  it("starts with today and tomorrow and ends a week out", () => {
    const opts = dueDateOptions(new Date(2026, 7, 27));
    expect(opts[0]).toMatchObject({ label: "Today", date: "2026-08-27" });
    expect(opts[1]).toMatchObject({ label: "Tomorrow", date: "2026-08-28" });
    expect(opts.at(-1)).toMatchObject({
      label: "In a week",
      date: "2026-09-03",
    });
  });
});
