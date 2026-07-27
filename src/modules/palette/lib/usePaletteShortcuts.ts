import { useEffect } from "react";

type Options = {
  onOpenQuickSwitcher: () => void;
  onOpenCommandPalette: () => void;
};

/**
 * Registers Cmd/Ctrl+P (quick switcher) and Cmd/Ctrl+Shift+P (command
 * palette) as window-level shortcuts, so they work regardless of which
 * view/pane has focus. Neither combo is bound inside the CodeMirror
 * keymaps (see `editorSettings.ts` shortcuts + `EditorPane`'s own
 * `Mod-s`), so the event isn't swallowed before it bubbles up here.
 */
export function usePaletteShortcuts({
  onOpenQuickSwitcher,
  onOpenCommandPalette,
}: Options) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "p") return;
      e.preventDefault();
      if (e.shiftKey) {
        onOpenCommandPalette();
      } else {
        onOpenQuickSwitcher();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenQuickSwitcher, onOpenCommandPalette]);
}
