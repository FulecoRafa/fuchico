import { describe, expect, it } from "vitest";
import { formatBinding } from "./fixedShortcuts";

describe("formatBinding", () => {
  it("formats modifier combos for macOS", () => {
    expect(formatBinding("Mod-Shift-p", true)).toBe("⌘⇧P");
    expect(formatBinding("Mod-s", true)).toBe("⌘S");
    expect(formatBinding("Mod-Shift-Enter", true)).toBe("⌘⇧Enter");
    expect(formatBinding("Alt-ArrowUp", true)).toBe("⌥ArrowUp");
  });

  it("formats modifier combos for Windows/Linux", () => {
    expect(formatBinding("Mod-Shift-p", false)).toBe("Ctrl+Shift+P");
    expect(formatBinding("Mod-.", false)).toBe("Ctrl+.");
  });

  it("keeps the minus key of Mod-- intact", () => {
    expect(formatBinding("Mod--", true)).toBe("⌘-");
    expect(formatBinding("Mod-Shift--", false)).toBe("Ctrl+Shift+-");
  });

  it("passes plain keys through and handles alternatives", () => {
    expect(formatBinding("F2", true)).toBe("F2");
    expect(formatBinding("Right-click", true)).toBe("Right-click");
    expect(formatBinding("Delete / Backspace", true)).toBe(
      "Delete / Backspace",
    );
    expect(formatBinding("Mod-= / Mod-- / Mod-0", false)).toBe(
      "Ctrl+= / Ctrl+- / Ctrl+0",
    );
  });
});
