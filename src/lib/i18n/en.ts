/** English message catalog — the source of truth for message keys. Values may
 * contain `{param}` placeholders filled by `t(key, { param })`. */
export const en = {
  // Common
  "common.loading": "Loading…",
  "common.scanning": "Scanning…",
  "common.close": "Close",
  "common.open": "Open",
  "common.default": "Default",
  "common.preview": "Preview",
  "common.apply": "Apply",
  "common.applied": "Applied",
  "common.rename": "Rename",
  "common.delete": "Delete",
  "common.copyPath": "Copy path",
  "common.revealInFileManager": "Reveal in file manager",
  "common.openFolder": "Open Folder",

  // Pluralized building blocks
  "count.fileOne": "{n} file",
  "count.fileMany": "{n} files",
  "count.occurrenceOne": "{n} occurrence",
  "count.occurrenceMany": "{n} occurrences",

  // App shell / activity bar
  "app.files": "Files",
  "app.tasksCalendar": "Tasks & Calendar",
  "app.search": "Search",
  "app.tags": "Tags",
  "app.settings": "Settings",
  "app.noFileOpen": "No file open",
  "app.diagram": "Diagram",

  // Tabs
  "tabs.close": "Close",
  "tabs.closeOthers": "Close others",
  "tabs.closeAll": "Close all",
  "tabs.openInNewWindow": "Open in new window",

  // File explorer
  "explorer.noFolderOpen": "No folder open",
  "explorer.newFile": "New file",
  "explorer.newFolder": "New folder",
  "explorer.newDrawing": "New drawing",
  "explorer.openFolderAction": "Open folder…",
  "explorer.refresh": "Refresh",
  "explorer.cut": "Cut",
  "explorer.cutItems": "Cut {count} items",
  "explorer.pasteHere": "Paste {name} here",
  "explorer.openWithDefault": "Open with default app",
  "explorer.openWith": "Open with {tool}",
  "explorer.copyPaths": "Copy {count} paths",
  "explorer.deleteItems": "Delete {count} items",
  "explorer.confirmDelete": "Delete {name}?",
  "explorer.itemsCount": "{count} items",
  "explorer.importFailed": "Import failed: {errors}",
  "explorer.importedOne": "Imported 1 file into {folder}",
  "explorer.importedMany": "Imported {count} files into {folder}",

  // Command palette / quick switcher
  "palette.runCommand": "Run a command…",
  "palette.noMatchingCommands": "No matching commands",
  "palette.goToFile": "Go to file…",
  "palette.openFolderFirst": "Open a folder first",
  "palette.scanningVault": "Scanning vault…",
  "palette.cantReadVault": "Couldn't read vault: {message}",
  "palette.noFilesFound": "No files found",

  // Palette commands
  "command.goToEditor": "Go to Editor",
  "command.goToAgenda": "Go to Tasks & Calendar",
  "command.goToSearch": "Go to Search",
  "command.goToSettings": "Go to Settings",
  "command.editorAction": "Editor: {name}",
  "command.settingsSection": "Settings: {name}",
  "command.openFolder": "Open Folder…",
  "command.quickOpen": "Quick Open: Go to File…",
  "command.closeActiveTab": "Close Active Tab",
  "command.closeAllTabs": "Close All Tabs",
  "command.openDailyNote": "Open Today's Daily Note",
  "command.newFromTemplate": "New Note from Template: {name}",
  "command.keyboardShortcuts": "Keyboard Shortcuts",
  "command.openInNewWindow": "Open in New Window",
  "command.toggleTheme": "Toggle Theme (Light / Dark)",
  "command.saveFile": "Save File",
  "command.saveAndCloseTab": "Save and Close Tab",
  "command.goToLine": "Go to Line {n}",

  // Search panel
  "search.openFolderToSearch": "Open a folder to search",
  "search.placeholder": "Search files…",
  "search.findReplaceTitle": "Find and replace across the vault",
  "search.replaceWith": "Replace with…",
  "search.replaceAll": "Replace all",
  "search.searching": "Searching…",
  "search.typeToSearch": "Type to search across files.",
  "search.noMatches": "No matches.",
  "search.line": "line {n}",
  "search.scopeInFile": "in {file}",
  "search.scopeAcrossFiles": "across {files}",
  "search.confirmReplace":
    'Replace every "{query}" with "{replacement}" {scope}? This cannot be undone.',
  "search.replaced": "Replaced {occurrences} in {files}.",
  "search.replaceFailed": "Replace failed: {error}",
  "search.replaceAllInFile": "Replace all in {file}",
  "search.replaceInThisFile": "Replace in this file…",

  // Agenda
  "agenda.openFolder": "Open a folder to see tasks and events",
  "agenda.emptyItem": "(empty)",
  "agenda.recurringTask": "Recurring task",
  "agenda.routines": "Routines",
  "agenda.noRoutinesPrefix": "No routines yet. Add",
  "agenda.noRoutinesSuffix": "to a task.",
  "agenda.noTasksPrefix": "No tasks yet. Use",
  "agenda.or": "or",
  "agenda.noTasksSuffix": "in your notes.",
  "agenda.overdue": "Overdue",
  "agenda.today": "Today",
  "agenda.upcoming": "Upcoming",
  "agenda.noDate": "No date",
  "agenda.nothingHere": "Nothing here.",
  "agenda.clearFilter": "Clear filter ({date})",
  /** Comma-separated one-letter labels, Sunday first. */
  "agenda.weekdayLetters": "S,M,T,W,T,F,S",

  // Tags
  "tags.openFolder": "Open a folder to see tags",
  "tags.noTagsPrefix": "No tags yet. Use",
  "tags.noTagsMid": "in a note or a frontmatter",
  "tags.noTagsSuffix": "list.",
  "tags.selectTag": "Select a tag to see its notes.",

  // Settings navigation
  "settingsNav.appearance": "Appearance",
  "settingsNav.editor": "Editor",
  "settingsNav.shortcuts": "Keyboard Shortcuts",
  "settingsNav.vault": "Vault",
  "settingsNav.integrations": "Integrations",
  "settingsNav.about": "About",

  // Settings view
  "settings.searchPlaceholder": "Search settings…",
  "settings.noResults": 'No settings match "{query}".',
  "settings.sectionsAria": "Settings sections",

  // Settings › Language
  "settings.language.title": "Language",
  "settings.language.desc":
    'Language of the app interface. "System" follows your operating system language.',
  "settings.language.label": "Language",
  "settings.language.system": "System",

  // Settings › Theme
  "settings.theme.title": "Theme",
  "settings.theme.desc":
    "A theme is a color choice, independent of light/dark mode. Each palette may support a light and/or dark variant.",
  "settings.theme.palette": "Palette",
  "settings.theme.paletteCustom": "Custom",
  "settings.theme.mode": "Mode",
  "settings.theme.modeSystem": "System",
  "settings.theme.modeLight": "Light",
  "settings.theme.modeDark": "Dark",
  "settings.theme.draculaHint":
    "Dracula only ships a dark palette, so mode is fixed to dark.",
  "settings.theme.customCss": "Custom CSS variables",
  "settings.theme.customCssHintPrefix":
    "Declarations are injected as-is into a",
  "settings.theme.customCssHintSuffix":
    "rule. Preview updates as you type; click Apply to use it across the whole app.",

  // Settings shared preview card
  "settings.preview.primary": "Primary",
  "settings.preview.secondary": "Secondary",
  "settings.preview.pangram": "The quick brown fox jumps over the lazy dog.",

  // Settings › Font
  "settings.font.title": "Font",
  "settings.font.desc":
    "Choose fonts installed on this machine for the app's interface and for the editor.",
  "settings.font.uiFont": "UI font",
  "settings.font.editorFont": "Editor font",
  "settings.font.loading": "Loading system fonts…",
  "settings.font.error": "Couldn't list system fonts: {message}",
  "settings.font.editorFontSize": "Editor font size",
  "settings.font.editorFontSizeHint": "Also Cmd/Ctrl +, − and 0 to reset.",
  "settings.font.uiZoom": "UI zoom",
  "settings.font.uiZoomHint":
    "Percent. Also Cmd/Ctrl Shift +, − and 0 to reset.",

  // Settings › Keybindings
  "settings.keybindings.title": "Keybindings",
  "settings.keybindings.desc":
    "Choose how the editor interprets keystrokes. Takes effect immediately in any open file.",
  "settings.keybindings.helixDesc":
    "Modal editing, Helix-style selection-first commands.",
  "settings.keybindings.vimDesc": "Modal editing, Vim keybindings.",
  "settings.keybindings.normalLabel": "Normal",
  "settings.keybindings.normalDesc":
    "Standard text-editor keybindings, no modes.",

  // Settings › Editor behavior
  "settings.behavior.title": "Editor Behavior",
  "settings.behavior.desc":
    "Gutter and indentation preferences for the code editor.",
  "settings.behavior.relativeLineNumbers": "Relative line numbers",
  "settings.behavior.absolute": "Absolute",
  "settings.behavior.absoluteTitle": "Every line shows its absolute number.",
  "settings.behavior.relative": "Relative",
  "settings.behavior.relativeTitle":
    "The current line shows its absolute number; every other line shows its distance from the cursor.",
  "settings.behavior.relativeHint":
    "Helix/Vim-style: handy for jumping N lines with motion commands.",
  "settings.behavior.tabSize": "Tab size",
  "settings.behavior.tabSizeHint": "Spaces per indent level and per tab stop.",

  // Settings › Fold regions
  "settings.folding.title": "Fold Regions",
  "settings.folding.desc":
    "Wrap any lines between a start and end marker to make them foldable — this is an app-specific convention, not part of Markdown. The rest of the start-marker line becomes the region's name.",
  "settings.folding.startMarker": "Start marker",
  "settings.folding.endMarker": "End marker",
  "settings.folding.eg": "e.g.",
  "settings.folding.regionName": "Region name",
  "settings.folding.expanded": "Expanded",
  "settings.folding.collapsed": "Collapsed",
  "settings.folding.linesExample": "3 lines",

  // Settings › Vault folders
  "settings.vault.title": "Vault Folders",
  "settings.vault.descPrefix":
    'Relative to the open vault. "Open Today\'s Daily Note" and "New Note from Template" live in the command palette (Cmd/Ctrl-Shift-P); templates may use',
  "settings.vault.and": "and",
  "settings.vault.descImages": ". Pasted images go to",
  "settings.vault.dailyNotesFolder": "Daily notes folder",
  "settings.vault.templatesFolder": "Templates folder",
  "settings.vault.templatesHintPrefix": "A",
  "settings.vault.templatesHintSuffix": "here seeds new daily notes.",
  "settings.vault.externalTool": "External tool",
  "settings.vault.externalToolPlaceholder":
    'e.g. "Visual Studio Code" (empty = OS default)',
  "settings.vault.externalToolHint":
    'Used by "Open with…" in the file explorer\'s right-click menu.',

  // Settings › About
  "settings.about.title": "About",
  "settings.about.desc":
    "Fuchico {version} — a keyboard-first Markdown notes app with Helix editing, tasks and agenda.",
  "settings.about.github": "Source & issues on GitHub",

  // Settings › Keyboard shortcuts
  "shortcuts.title": "Keyboard Shortcuts",
  "shortcuts.desc":
    "Everything the keyboard can do, in one place. Editor actions are rebindable: click a binding, then press the new key combination.",
  "shortcuts.searchPlaceholder": "Search shortcuts…",
  "shortcuts.editorRebindable": "Editor (rebindable)",
  "shortcuts.pressKeys": "Press keys…",
  "shortcuts.noMatch": 'No shortcuts match "{query}".',
  "shortcuts.group.global": "Global",
  "shortcuts.group.editor": "Editor",
  "shortcuts.group.explorer": "File explorer",
  "shortcuts.group.tabs": "Tabs",
  "shortcuts.fixed.commandPalette.label": "Command palette",
  "shortcuts.fixed.commandPalette.desc": "Run any app command by name.",
  "shortcuts.fixed.quickOpen.label": "Quick open file",
  "shortcuts.fixed.quickOpen.desc": "Fuzzy-find a note in the vault.",
  "shortcuts.fixed.editorFontSize.label": "Editor font size",
  "shortcuts.fixed.editorFontSize.desc":
    "Bigger / smaller / reset editor text.",
  "shortcuts.fixed.uiZoom.label": "UI zoom",
  "shortcuts.fixed.uiZoom.desc": "Zoom the whole app in / out / reset.",
  "shortcuts.fixed.helixPalette.label": "Command palette from Helix",
  "shortcuts.fixed.helixPalette.desc":
    "In Helix normal mode, : opens the command palette; :q, :w, :wq and :<line> work as aliases.",
  "shortcuts.fixed.save.label": "Save",
  "shortcuts.fixed.save.desc": "Write the current file to disk.",
  "shortcuts.fixed.findReplace.label": "Find / replace",
  "shortcuts.fixed.findReplace.desc": "Search within the current file.",
  "shortcuts.fixed.taskAutocomplete.label": "Task date / repeat autocomplete",
  "shortcuts.fixed.taskAutocomplete.desc":
    "Type @due, @today, @repeat (or 📅 / 🔁) on a task line to pick a date or rule.",
  "shortcuts.fixed.pasteImage.label": "Paste image",
  "shortcuts.fixed.pasteImage.desc":
    "Paste or drop an image to save it under attachments/ and link it.",
  "shortcuts.fixed.followLink.label": "Follow link",
  "shortcuts.fixed.followLink.desc":
    "Open the [[wikilink]] or Markdown link under the cursor.",
  "shortcuts.fixed.followLink.keys": "Click",
  "shortcuts.fixed.explorerNavigate.label": "Navigate",
  "shortcuts.fixed.explorerNavigate.desc":
    "Move selection, expand/collapse folders.",
  "shortcuts.fixed.explorerOpen.label": "Open / toggle folder",
  "shortcuts.fixed.explorerOpen.desc":
    "Open the selected file or expand/collapse the folder.",
  "shortcuts.fixed.explorerRename.label": "Rename",
  "shortcuts.fixed.explorerRename.desc": "Rename the selected entry.",
  "shortcuts.fixed.explorerDelete.label": "Delete",
  "shortcuts.fixed.explorerDelete.desc":
    "Delete the selected entry (asks for confirmation).",
  "shortcuts.fixed.explorerTypeAhead.label": "Type-ahead",
  "shortcuts.fixed.explorerTypeAhead.desc":
    "Type a name prefix to jump to the matching entry.",
  "shortcuts.fixed.explorerMenu.label": "Context menu",
  "shortcuts.fixed.explorerMenu.desc": "New file/folder, rename, delete.",
  "shortcuts.fixed.explorerMenu.keys": "Right-click",
  "shortcuts.fixed.tabMenu.label": "Tab menu",
  "shortcuts.fixed.tabMenu.desc": "Close, close others, close all.",
  "shortcuts.fixed.tabMenu.keys": "Right-click",

  // Rebindable editor actions
  "shortcutAction.openOutline.label": "Go to header",
  "shortcutAction.openOutline.desc":
    "Open the document outline (fuzzy-searchable header list).",
  "shortcutAction.toggleCheckboxAtCursor.label": "Toggle checkbox",
  "shortcutAction.toggleCheckboxAtCursor.desc":
    "Mark/unmark the checkbox on the cursor's line.",
  "shortcutAction.insertDate.label": "Insert date",
  "shortcutAction.insertDate.desc": "Insert today's date at the cursor.",
  "shortcutAction.insertDateTime.label": "Insert date & time",
  "shortcutAction.insertDateTime.desc":
    "Insert the current date and time at the cursor.",
  "shortcutAction.insertRegion.label": "Insert fold region",
  "shortcutAction.insertRegion.desc":
    "Wrap the selected lines in a foldable region (or insert an empty one at the cursor).",
  "shortcutAction.insertTable.label": "Insert table",
  "shortcutAction.insertTable.desc":
    "Insert a 2x2 Markdown table at the cursor and start editing the header.",
  "shortcutAction.toggleTaskLine.label": "Toggle task",
  "shortcutAction.toggleTaskLine.desc":
    "Turn the current line into a `- [ ]` task (or back into plain text).",
  "shortcutAction.pickDueDate.label": "Set due date…",
  "shortcutAction.pickDueDate.desc":
    "Add or change the 📅 due date on the current line via a quick-pick list.",
  "shortcutAction.pickRecurrence.label": "Set recurrence…",
  "shortcutAction.pickRecurrence.desc":
    "Add or change the 🔁 repeat rule on the current line via a quick-pick list.",
} as const;

export type Messages = typeof en;
export type MessageKey = keyof Messages;
