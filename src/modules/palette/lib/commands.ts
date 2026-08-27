import { editorSettingsStore } from "@/modules/settings/lib/editorSettings";
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
  openShortcuts: () => void;
};

function toggleThemeCommand(): AppCommand {
  return {
    id: "toggle-theme",
    title: "Toggle Theme (Light / Dark)",
    keywords: ["dark mode", "light mode", "appearance", "color scheme"],
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
      title: "Go to Editor",
      keywords: ["files", "explorer", "view"],
      run: () => ctx.setMainView("editor"),
    },
    {
      id: "go-to-agenda",
      title: "Go to Tasks & Calendar",
      keywords: ["agenda", "tasks", "calendar", "view"],
      run: () => ctx.setMainView("agenda"),
    },
    {
      id: "go-to-search",
      title: "Go to Search",
      keywords: ["find", "view"],
      run: () => ctx.setMainView("search"),
    },
    {
      id: "go-to-settings",
      title: "Go to Settings",
      keywords: ["preferences", "config", "view"],
      run: () => ctx.setMainView("settings"),
    },
    {
      id: "open-folder",
      title: "Open Folder…",
      keywords: ["vault", "workspace", "directory"],
      run: () => ctx.openFolder(),
    },
  ];

  if (ctx.hasRootPath) {
    commands.push({
      id: "quick-open-file",
      title: "Quick Open: Go to File…",
      keywords: ["switcher", "find file", "open file"],
      run: () => ctx.openQuickSwitcher(),
    });
  }

  if (ctx.hasActiveTab) {
    commands.push({
      id: "close-active-tab",
      title: "Close Active Tab",
      keywords: ["close file"],
      run: () => ctx.closeActiveTab(),
    });
  }

  if (ctx.hasOpenTabs) {
    commands.push({
      id: "close-all-tabs",
      title: "Close All Tabs",
      keywords: ["close everything"],
      run: () => ctx.closeAllTabs(),
    });
  }

  if (ctx.rootPath) {
    const root = ctx.rootPath;
    const { dailyNotesFolder, templatesFolder } = editorSettingsStore.get();
    commands.push({
      id: "open-daily-note",
      title: "Open Today's Daily Note",
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
        title: `New Note from Template: ${stem(template)}`,
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
    title: "Keyboard Shortcuts",
    keywords: ["keys", "hotkeys", "bindings", "help"],
    run: () => ctx.openShortcuts(),
  });

  commands.push(toggleThemeCommand());

  return commands;
}
