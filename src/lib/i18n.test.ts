import { describe, expect, it } from "vitest";
import { resolveLocale, t, tn } from "./i18n";
import { en } from "./i18n/en";
import { ptBR } from "./i18n/ptBR";

describe("i18n catalogs", () => {
  // The compiler already enforces this (`ptBR: Record<MessageKey, string>`),
  // but assert it at runtime too so a bad cast can't slip through.
  it("pt-BR has every key of en and nothing else", () => {
    expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort());
  });

  it("no message is empty", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en ${key}`).not.toBe("");
    }
    for (const [key, value] of Object.entries(ptBR)) {
      expect(value.trim(), `pt-BR ${key}`).not.toBe("");
    }
  });

  it("pt-BR keeps every {param} placeholder used by en", () => {
    const params = (msg: string) => (msg.match(/\{\w+\}/g) ?? []).sort();
    for (const [key, value] of Object.entries(en)) {
      expect(params(ptBR[key as keyof typeof en]), key).toEqual(params(value));
    }
  });
});

describe("t()", () => {
  it("interpolates params", () => {
    // Default language is "system" and tests run with an English (or absent)
    // navigator.language, so the English catalog is active here.
    expect(t("search.line", { n: 7 })).toBe("line 7");
    expect(t("explorer.confirmDelete", { name: '"a.md"' })).toBe(
      'Delete "a.md"?',
    );
  });

  it("tn() picks the singular/plural key", () => {
    expect(tn(1, "count.fileOne", "count.fileMany")).toBe("1 file");
    expect(tn(3, "count.fileOne", "count.fileMany")).toBe("3 files");
  });
});

describe("resolveLocale", () => {
  it("passes explicit languages through", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("pt-BR")).toBe("pt-BR");
  });

  it('resolves "system" to a supported locale', () => {
    expect(["en", "pt-BR"]).toContain(resolveLocale("system"));
  });
});
