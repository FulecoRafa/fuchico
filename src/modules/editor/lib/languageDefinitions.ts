import type { Extension } from "@codemirror/state";

type LanguageLoader = () => Promise<Extension>;

export interface LanguageDefinition {
  name: string;
  extensions: string[];
  loader: LanguageLoader;
  filenames?: string[];
}

// MVP language set — limited to what's already an npm dependency, so
// nothing pulls in a new package on demand.
export const LANGUAGES: LanguageDefinition[] = [
  {
    name: "JavaScript",
    extensions: ["js", "cjs", "mjs"],
    loader: () =>
      import("@codemirror/lang-javascript").then((m) => m.javascript()),
  },
  {
    name: "TypeScript",
    extensions: ["ts", "cts", "mts"],
    loader: () =>
      import("@codemirror/lang-javascript").then((m) =>
        m.javascript({ typescript: true }),
      ),
  },
  {
    name: "JavaScript React",
    extensions: ["jsx"],
    loader: () =>
      import("@codemirror/lang-javascript").then((m) =>
        m.javascript({ jsx: true }),
      ),
  },
  {
    name: "TypeScript React",
    extensions: ["tsx"],
    loader: () =>
      import("@codemirror/lang-javascript").then((m) =>
        m.javascript({ jsx: true, typescript: true }),
      ),
  },
  {
    name: "Rust",
    extensions: ["rs"],
    loader: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  },
  {
    name: "Python",
    extensions: ["py"],
    loader: () => import("@codemirror/lang-python").then((m) => m.python()),
  },
  {
    name: "JSON",
    extensions: ["json", "jsonc"],
    loader: () => import("@codemirror/lang-json").then((m) => m.json()),
  },
  {
    name: "Markdown",
    extensions: ["md", "markdown"],
    loader: () =>
      Promise.all([
        Promise.all([
          import("@codemirror/lang-markdown"),
          import("@codemirror/language-data"),
        ]).then(([{ markdown, markdownLanguage }, { languages }]) =>
          markdown({ base: markdownLanguage, codeLanguages: languages }),
        ),
        import("./markdownStyle").then((m) => m.markdownStyle),
        import("./codeBlockStyle").then((m) => m.codeBlockStyle),
      ]),
  },
  {
    name: "HTML",
    extensions: ["html", "htm"],
    loader: () => import("@codemirror/lang-html").then((m) => m.html()),
  },
  {
    name: "CSS",
    extensions: ["css"],
    loader: () => import("@codemirror/lang-css").then((m) => m.css()),
  },
];

export const extensionMap = new Map<string, LanguageDefinition>();
export const filenameMap = new Map<string, LanguageDefinition>();

for (const lang of LANGUAGES) {
  for (const ext of lang.extensions) {
    extensionMap.set(ext.toLowerCase(), lang);
  }
  for (const file of lang.filenames ?? []) {
    filenameMap.set(file.toLowerCase(), lang);
  }
}
