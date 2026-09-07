import { t } from "@/lib/i18n";
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { css, cssCompletionSource } from "@codemirror/lang-css";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";
import { currentThemeValue, THEME_VARIABLES } from "./lib/themeVariables";

/** Completes `--variable` names (with their description and the value the
 * current palette resolves them to) both at declaration start and inside
 * `var(...)`, on top of lang-css's own property/value completions. */
function themeVariableCompletion(
  context: CompletionContext,
): CompletionResult | null {
  const word = context.matchBefore(/-{1,2}[\w-]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const line = context.state.doc.lineAt(word.from);
  const before = line.text.slice(0, word.from - line.from);
  const inVar = /var\(\s*$/.test(before);
  const atDeclStart = before.trim() === "";
  if (!inVar && !atDeclStart) return null;
  return {
    from: word.from,
    validFor: /^-{1,2}[\w-]*$/,
    options: THEME_VARIABLES.map((v) => ({
      label: v.name,
      type: "variable",
      detail: t(v.descKey),
      info: () => {
        const value = currentThemeValue(v.name);
        if (!value) return null;
        const el = document.createElement("div");
        el.className = "theme-var-info";
        if (v.kind === "color") {
          const swatch = document.createElement("span");
          swatch.className = "theme-var-swatch";
          swatch.style.background = value;
          el.appendChild(swatch);
        }
        el.appendChild(document.createTextNode(value));
        return el;
      },
      apply: inVar ? v.name : `${v.name}: `,
    })),
  };
}

const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    border: "1px solid var(--input)",
    borderRadius: "var(--radius-md)",
    fontSize: "12px",
  },
  "&.cm-focused": { outline: "none", borderColor: "var(--ring)" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.5" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--muted-foreground)",
    border: "none",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "color-mix(in oklch, var(--foreground) 5%, transparent)",
  },
  ".cm-content": { caretColor: "var(--foreground)", minHeight: "160px" },
});

type Props = {
  value: string;
  onChange: (css: string) => void;
};

/** CodeMirror-backed CSS editor for custom themes (issue #3). */
export function ThemeCssEditor({ value, onChange }: Props) {
  const extensions = useMemo(
    () => [
      css(),
      autocompletion({
        override: [themeVariableCompletion, cssCompletionSource],
        activateOnTyping: true,
      }),
      EditorView.lineWrapping,
      editorTheme,
    ],
    [],
  );
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="none"
      className="theme-css-editor"
      maxHeight="360px"
      basicSetup={{
        autocompletion: false,
        foldGutter: false,
        highlightActiveLine: true,
        lineNumbers: true,
      }}
    />
  );
}
