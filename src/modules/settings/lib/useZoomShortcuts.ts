import { useEffect } from "react";
import {
  clampEditorFontSize,
  clampUiScale,
  EDITOR_FONT_SIZE_DEFAULT,
  editorSettingsStore,
  UI_SCALE_DEFAULT,
} from "./editorSettings";

const UI_SCALE_STEP = 0.1;

/** Global zoom shortcuts (issue #5): Mod +/-/0 sizes the editor content,
 * Mod-Shift +/-/0 zooms the app UI. Captured on window so they win over
 * CodeMirror/helix keymaps and the WebView's own zoom. */
export function useZoomShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      // Shift turns "=" into "+" and "-" into "_" on most layouts.
      const dir =
        e.key === "=" || e.key === "+"
          ? 1
          : e.key === "-" || e.key === "_"
            ? -1
            : e.key === "0"
              ? 0
              : null;
      if (dir === null) return;
      e.preventDefault();
      e.stopPropagation();
      const settings = editorSettingsStore.get();
      if (e.shiftKey) {
        editorSettingsStore.set({
          uiScale:
            dir === 0
              ? UI_SCALE_DEFAULT
              : clampUiScale(settings.uiScale + dir * UI_SCALE_STEP),
        });
      } else {
        editorSettingsStore.set({
          editorFontSize:
            dir === 0
              ? EDITOR_FONT_SIZE_DEFAULT
              : clampEditorFontSize(settings.editorFontSize + dir),
        });
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
