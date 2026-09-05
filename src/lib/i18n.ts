import {
  type AppLanguage,
  editorSettingsStore,
} from "@/modules/settings/lib/editorSettings";
import { useSyncExternalStore } from "react";
import { en, type MessageKey, type Messages } from "./i18n/en";
import { ptBR } from "./i18n/ptBR";

export type { MessageKey, Messages };

/** A concrete UI locale (the language setting also allows "system"). */
export type Locale = "en" | "pt-BR";

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en,
  "pt-BR": ptBR,
};

/** Maps the language *setting* to a concrete locale; "system" follows the
 * OS/browser language (any `pt*` becomes pt-BR, everything else English). */
export function resolveLocale(language: AppLanguage): Locale {
  if (language !== "system") return language;
  const system =
    typeof navigator !== "undefined" ? (navigator.language ?? "") : "";
  return system.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}

export function getLocale(): Locale {
  return resolveLocale(editorSettingsStore.get().language);
}

/** Translates `key` in the current locale, replacing `{param}` placeholders.
 * Safe to call outside React (menus, command builders, confirm dialogs);
 * components should also call `useLocale()`/`useI18n()` so they re-render
 * when the language changes. */
export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  let message = catalogs[getLocale()][key] ?? en[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      message = message.split(`{${name}}`).join(String(value));
    }
  }
  return message;
}

/** Tiny plural helper: picks the `one`/`many` key by count and fills `{n}`. */
export function tn(n: number, one: MessageKey, many: MessageKey): string {
  return t(n === 1 ? one : many, { n });
}

/** Current locale as reactive state — language changes (or storage events
 * from another window) re-render subscribers via the settings store. */
export function useLocale(): Locale {
  return useSyncExternalStore(editorSettingsStore.subscribe, getLocale);
}

/** Convenience hook: subscribes to locale changes and hands back `t`. */
export function useI18n() {
  const locale = useLocale();
  return { t, tn, locale };
}
