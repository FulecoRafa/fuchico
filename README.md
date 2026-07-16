# Fuchico

A standalone desktop notes/code editor (Tauri 2 + React 19 + CodeMirror 6) with
correct [Helix](https://helix-editor.com/) modal keybindings, markdown
live-preview styling, and a built-in Tasks & Calendar view that scans your
notes for checkboxes, `TODO:` lines, and `📅` events.

## Features

- Modal editing via `codemirror-helix`, running in a plain CM6 host with no
  competing keymaps or WYSIWYG decorations to fight with.
- Virtualized file explorer with create/rename/delete.
- Markdown live-preview styling (headings, checkboxes, callouts, fold-gutter
  arrows) and a fenced code-block toolbar with a language picker.
- Global Tasks & Calendar view: a CalDAV-style mini calendar plus a task list
  grouped into Overdue/Today/Upcoming/No-date, with in-place checkbox
  toggling and click-to-jump-to-source-line.

## Development

```
pnpm install
pnpm tauri dev
```

- `pnpm check-types` — TypeScript
- `pnpm lint` / `pnpm lint:fix` / `pnpm format` — Biome
- `cargo test` / `cargo clippy --all-targets` (from `src-tauri/`) — Rust backend
