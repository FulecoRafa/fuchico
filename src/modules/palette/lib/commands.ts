import { t } from "@/lib/i18n";
import { exportAsHtml, exportAsPdf } from "@/modules/export";
import {
  editorSettingsStore,
  type ShortcutAction,
} from "@/modules/settings/lib/editorSettings";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/modules/settings/lib/settingsNav";
import { SHORTCUT_ACTIONS } from "@/modules/settings/lib/shortcutActions";
import {
  createFromTemplate,
  listTemplates,
  openDailyNote,
  stem,
} from "./templates";

export type AppCommand = {
  id: string;
  title: string;
  /** Extra terms matched (but not highlighted) so e.g. "dark mode" finds
   * "Toggle Theme". */
  keywords?: string[];
  /** Key binding hint shown right-aligned in the palette row (raw
   * "Mod-Shift-p" form; formatted per platform at render time). */
  binding?: string;
  /** Helix/vim-style `:` aliases (":q", ":w"). Matched (prefix) when the
   * palette query starts with ":", e.g. after pressing `:` in Helix normal
   * mode, and shown as a chip on the row. */
  aliases?: string[];
  run: () => void;
};

export type MainView = "editor" | "agenda" | "search" | "settings";

export type CommandContext = {
  setMainView: (view: MainView) => void;
  openFolder: () => void;
  openQuickSwitcher: () => void;
  closeActiveTab: () => void;
  closeAllTabs: () => void;
  hasRootPath: boolean;
  hasActiveTab: boolean;
  hasOpenTabs: boolean;
  /** Vault root and its Markdown files, for daily notes / templates. */
  rootPath: string | null;
  vaultFiles: readonly string[];
  openFile: (path: string) => void;
  /** Jumps to the searchable keyboard-shortcuts list in Settings. */
  openSettings: (section: SettingsSectionId) => void;
  runEditorAction: (action: ShortcutAction) => void;
  /** Detaches the active tab into its own OS window (issue #29). */
  openActiveInNewWindow: () => void;
  /** Saves the active editor tab (palette "Save File" / `:w`). */
  saveActiveFile: () => void;
  /** Shows/hides the backlinks dock panel (issue #21). */
  toggleBacklinks: () => void;
  backlinksOpen: boolean;
  /** Active tab path + live buffer, for export (issue #28). */
  activePath: string | null;
  getActiveContent: () => string | null;
};

const BUILTIN_PALETTES: {
  value: "ayu" | "dracula" | "catppuccin";
  label: string;
}[] = [
  { value: "ayu", label: "Ayu" },
  { value: "dracula", label: "Dracula" },
  { value: "catppuccin", label: "Catppuccin" },
];

/** One "Theme: X" command per built-in palette and custom theme (issue #3). */
function selectThemeCommands(): AppCommand[] {
  const { customThemes } = editorSettingsStore.get();
  return [
    ...BUILTIN_PALETTES.map((p) => ({
      id: `select-theme:${p.value}`,
      title: t("command.selectTheme", { name: p.label }),
      keywords: ["palette", "appearance", "color scheme"],
      run: () => editorSettingsStore.set({ palette: p.value }),
    })),
    ...customThemes.map((th) => ({
      id: `select-theme:${th.id}`,
      title: t("command.selectTheme", { name: th.name }),
      keywords: ["palette", "appearance", "custom theme"],
      run: () =>
        editorSettingsStore.set({ palette: "custom", customThemeId: th.id }),
    })),
  ];
}

function toggleThemeCommand(): AppCommand {
  return {
    id: "toggle-theme",
    title: t("command.toggleTheme"),
    keywords: ["dark mode", "light mode", "appearance", "color scheme"],
    aliases: [":theme"],
    run: () => {
      const { mode } = editorSettingsStore.get();
      const next = mode === "dark" ? "light" : "dark";
      editorSettingsStore.set({ mode: next });
    },
  };
}

/**
 * Builds the command palette's registry from the app's current state and
 * handlers. This is the single place new commands get added -- append an
 * `AppCommand` here (or push a small standalone builder like
 * `toggleThemeCommand`) and it shows up in the palette automatically.
 */
export function buildAppCommands(ctx: CommandContext): AppCommand[] {
  const commands: AppCommand[] = [
    {
      id: "go-to-editor",
      title: t("command.goToEditor"),
      keywords: ["files", "explorer", "view"],
      run: () => ctx.setMainView("editor"),
    },
    {
      id: "go-to-agenda",
      title: t("command.goToAgenda"),
      keywords: ["agenda", "tasks", "calendar", "view"],
      run: () => ctx.setMainView("agenda"),
    },
    {
      id: "go-to-search",
      title: t("command.goToSearch"),
      keywords: ["find", "view"],
      run: () => ctx.setMainView("search"),
    },
    {
      id: "go-to-settings",
      title: t("command.goToSettings"),
      keywords: ["preferences", "config", "view"],
      run: () => ctx.setMainView("settings"),
    },
    ...(ctx.hasActiveTab
      ? SHORTCUT_ACTIONS.map((a) => ({
          id: `editor:${a.value}`,
          title: t("command.editorAction", { name: t(a.labelKey) }),
          keywords: ["task", "insert", "editor", t(a.descKey)],
          binding: editorSettingsStore.get().shortcuts[a.value],
          run: () => ctx.runEditorAction(a.value),
        }))
      : []),
    ...SETTINGS_SECTIONS.map((s) => ({
      id: `settings:${s.id}`,
      title: t("command.settingsSection", { name: t(s.labelKey) }),
      keywords: ["preferences", "config", ...s.keywords],
      run: () => ctx.openSettings(s.id),
    })),
    {
      id: "open-folder",
      title: t("command.openFolder"),
      keywords: ["vault", "workspace", "directory"],
      run: () => ctx.openFolder(),
    },
  ];

  if (ctx.hasRootPath) {
    commands.push({
      id: "quick-open-file",
      title: t("command.quickOpen"),
      keywords: ["switcher", "find file", "open file"],
      binding: "Mod-p",
      aliases: [":o", ":open", ":e", ":edit"],
      run: () => ctx.openQuickSwitcher(),
    });
  }

  if (ctx.hasActiveTab) {
    commands.push(
      {
        id: "save-file",
        title: t("command.saveFile"),
        keywords: ["write"],
        binding: "Mod-s",
        aliases: [":w", ":write"],
        run: () => ctx.saveActiveFile(),
      },
      {
        id: "save-and-close",
        title: t("command.saveAndCloseTab"),
        keywords: ["write quit"],
        aliases: [":wq", ":x"],
        run: () => {
          ctx.saveActiveFile();
          ctx.closeActiveTab();
        },
      },
      {
        id: "close-active-tab",
        title: t("command.closeActiveTab"),
        keywords: ["close file"],
        aliases: [":q", ":quit", ":bc"],
        run: () => ctx.closeActiveTab(),
      },
    );
  }

  if (ctx.hasOpenTabs) {
    commands.push({
      id: "close-all-tabs",
      title: t("command.closeAllTabs"),
      keywords: ["close everything"],
      aliases: [":qa"],
      run: () => ctx.closeAllTabs(),
    });
  }

  if (ctx.rootPath) {
    const root = ctx.rootPath;
    const { dailyNotesFolder, templatesFolder } = editorSettingsStore.get();
    commands.push({
      id: "open-daily-note",
      title: t("command.openDailyNote"),
      keywords: ["journal", "today", "diary", "new note"],
      run: () => {
        void openDailyNote({ root, dailyNotesFolder, templatesFolder }).then(
          (path) => ctx.openFile(path),
        );
      },
    });
    for (const template of listTemplates(
      root,
      templatesFolder,
      ctx.vaultFiles,
    )) {
      commands.push({
        id: `new-from-template:${template}`,
        title: t("command.newFromTemplate", { name: stem(template) }),
        keywords: ["template", "create", "new note"],
        run: () => {
          void createFromTemplate(root, template).then((path) =>
            ctx.openFile(path),
          );
        },
      });
    }
  }

  commands.push({
    id: "keyboard-shortcuts",
    title: t("command.keyboardShortcuts"),
    keywords: ["keys", "hotkeys", "bindings", "help"],
    run: () => ctx.openSettings("shortcuts"),
  });

  if (ctx.hasActiveTab) {
    commands.push({
      id: "open-in-new-window",
      title: t("command.openInNewWindow"),
      keywords: ["detach", "window", "popout", "second monitor"],
      run: ctx.openActiveInNewWindow,
    });
  }

  if (ctx.hasRootPath) {
    commands.push({
      id: "toggle-backlinks",
      title: ctx.backlinksOpen
        ? t("command.hideBacklinks")
        : t("command.showBacklinks"),
      keywords: ["links", "references", "linked mentions", "graph"],
      aliases: [":backlinks", ":bl"],
      run: ctx.toggleBacklinks,
    });
  }

  if (ctx.activePath && /\.(md|markdown)$/i.test(ctx.activePath)) {
    const path = ctx.activePath;
    commands.push(
      {
        id: "export-html",
        title: t("command.exportHtml"),
        keywords: ["export", "html", "web page", "share"],
        aliases: [":export"],
        run: () => {
          const content = ctx.getActiveContent();
          if (content !== null) void exportAsHtml(path, content);
        },
      },
      {
        id: "export-pdf",
        title: t("command.exportPdf"),
        keywords: ["export", "pdf", "print", "share"],
        aliases: [":pdf", ":print"],
        run: () => {
          const content = ctx.getActiveContent();
          if (content !== null) void exportAsPdf(path, content);
        },
      },
    );
  }

  commands.push(toggleThemeCommand(), ...selectThemeCommands());

  return commands;
}
