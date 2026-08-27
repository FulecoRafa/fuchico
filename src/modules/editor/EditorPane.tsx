import { frontmatterExtension } from "@/modules/frontmatter";
import { useEditorSettings } from "@/modules/settings/lib/editorSettings";
import { StatusBar } from "@/modules/statusbar";
import { redo, undo } from "@codemirror/commands";
import { EditorView, keymap } from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { completionKeymap, editorCompletionExtension } from "./lib/completion";
import {
  computeDocStats,
  type DocStats,
  docStatsReporterExtension,
} from "./lib/docStats";
import {
  buildSharedExtensions,
  foldRegionCompartment,
  foldRegionExtensionFor,
  indentCompartment,
  indentExtensionFor,
  keybindingCompartment,
  keybindingExtensionFor,
  languageCompartment,
  lineNumberCompartment,
  lineNumbersExtensionFor,
  shortcutsCompartment,
} from "./lib/extensions";
import { headingCompletionProvider } from "./lib/headingCompletion";
import {
  type HelixMode,
  helixHandlersExtension,
  helixModeReporterExtension,
} from "./lib/helix";
import { imageAttachmentsExtension } from "./lib/imageAttachments";
import { resolveLanguage } from "./lib/languageResolver";
import {
  type MermaidOpenPayload,
  mermaidPreviewExtension,
} from "./lib/mermaidPreviewExtension";
import { scrollPersistenceExtension } from "./lib/scrollPositions";
import { shortcutsExtension } from "./lib/shortcuts";
import { tagCompletionProvider, tagsExtension } from "./lib/tags";
import { useDocument } from "./lib/useDocument";
import {
  wikilinkCompletionProvider,
  wikilinksExtension,
} from "./lib/wikilinks";
import { wordCompletionProvider } from "./lib/wordCompletion";
import { OutlineOverlay } from "./OutlineOverlay";

export type EditorPaneHandle = {
  focus: () => void;
  undo: () => void;
  redo: () => void;
};

type Props = {
  path: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
  onClose?: () => void;
  onOpenMermaid?: (payload: MermaidOpenPayload) => void;
  /** 1-based line to select/scroll to. Re-applied whenever `focusToken` changes. */
  focusLine?: number;
  focusToken?: number;
  /** Absolute paths of every Markdown file in the vault, for wikilink
   * resolution/autocomplete. Read via a ref, so updates don't reconfigure
   * the editor. */
  vaultFiles?: string[];
  /** Navigates to another file, e.g. from a clicked wikilink or relative
   * Markdown link. Mirrors `openFile` from useTabs. */
  onNavigateFile?: (path: string, focusLine?: number) => void;
  /** Every known tag in the vault, for `#` autocomplete. Read via a ref,
   * like `vaultFiles`. */
  getAllTags?: () => readonly string[];
  /** Called with the tag text (no leading `#`) when a `#tag` pill is
   * clicked, e.g. to switch to the tags panel filtered to it. */
  onTagClick?: (tag: string) => void;
  /** Vault root; pasted/dropped images are saved under `<root>/attachments`.
   * Read via a ref. */
  rootPath?: string | null;
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const EditorPane = forwardRef<EditorPaneHandle, Props>(
  function EditorPane(props, ref) {
    const {
      path,
      onDirtyChange,
      onSaved,
      onClose,
      onOpenMermaid,
      focusLine,
      focusToken,
      vaultFiles,
      onNavigateFile,
      getAllTags,
      onTagClick,
      rootPath,
    } = props;
    const { doc, onChange, save } = useDocument({ path, onDirtyChange });
    const { settings } = useEditorSettings();
    const cmRef = useRef<ReactCodeMirrorRef>(null);
    const [helixMode, setHelixMode] = useState<HelixMode | null>("normal");
    const setHelixModeRef = useRef(setHelixMode);
    setHelixModeRef.current = setHelixMode;
    const [outlineOpen, setOutlineOpen] = useState(false);
    const [docStats, setDocStats] = useState<DocStats>({
      words: 0,
      readingTimeMin: 0,
    });
    const setDocStatsRef = useRef(setDocStats);
    setDocStatsRef.current = setDocStats;
    // The compartment's initial content is read once when `extensions` is
    // built; later changes to keybindingMode are picked up by the effect
    // below via view.dispatch(reconfigure), not by re-running useMemo.
    const initialKeybindingModeRef = useRef(settings.keybindingMode);
    const initialRelativeLineNumbersRef = useRef(settings.relativeLineNumbers);
    const initialTabSizeRef = useRef(settings.tabSize);

    // Stabilize save/onSaved/onClose via refs so `extensions` never changes
    // identity — a new identity makes @uiw/react-codemirror reconfigure the
    // whole state, wiping the language compartment.
    const saveRef = useRef(save);
    saveRef.current = save;
    const onSavedRef = useRef(onSaved);
    onSavedRef.current = onSaved;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const onOpenMermaidRef = useRef(onOpenMermaid);
    onOpenMermaidRef.current = onOpenMermaid;
    const vaultFilesRef = useRef(vaultFiles);
    vaultFilesRef.current = vaultFiles;
    const onNavigateFileRef = useRef(onNavigateFile);
    onNavigateFileRef.current = onNavigateFile;
    const getAllTagsRef = useRef(getAllTags);
    getAllTagsRef.current = getAllTags;
    const onTagClickRef = useRef(onTagClick);
    onTagClickRef.current = onTagClick;
    const rootPathRef = useRef(rootPath);
    rootPathRef.current = rootPath;

    const performSave = useCallback(async () => {
      await saveRef.current();
      onSavedRef.current?.();
    }, []);
    const performSaveRef = useRef(performSave);
    performSaveRef.current = performSave;

    // Same one-time-read-then-reconfigure pattern as keybindingMode above.
    const initialShortcutsRef = useRef(settings.shortcuts);
    const initialFoldMarkersRef = useRef({
      start: settings.foldStartMarker,
      end: settings.foldEndMarker,
    });
    const openOutlineRef = useRef(() => setOutlineOpen(true));

    // `path` is read below (wikilinksExtension's currentPath) but intentionally
    // excluded from deps -- EditorPane remounts via `key={path}` in App.tsx on
    // every path change, so it's already constant for this instance's lifetime,
    // same as every other value stabilized via ref above.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
    const extensions = useMemo(
      () => [
        // Must precede the keybinding compartment: this Prec.highest keymap
        // lets Enter/arrows/Escape drive the completion popup instead of being
        // swallowed by the (also Prec.highest) modal keymap. See completion.ts.
        completionKeymap,
        // basicSetup is added before user extensions by @uiw/react-codemirror,
        // so helix must be elevated to Prec.highest to win the keymap.
        lineNumberCompartment.of(
          lineNumbersExtensionFor(initialRelativeLineNumbersRef.current),
        ),
        indentCompartment.of(indentExtensionFor(initialTabSizeRef.current)),
        keybindingCompartment.of(
          keybindingExtensionFor(initialKeybindingModeRef.current),
        ),
        shortcutsCompartment.of(
          shortcutsExtension(
            initialShortcutsRef.current,
            initialFoldMarkersRef.current,
            () => openOutlineRef.current(),
          ),
        ),
        foldRegionCompartment.of(
          foldRegionExtensionFor(
            initialFoldMarkersRef.current.start,
            initialFoldMarkersRef.current.end,
          ),
        ),
        helixHandlersExtension(() => ({
          save: () => {
            void performSaveRef.current();
          },
          close: () => onCloseRef.current?.(),
        })),
        helixModeReporterExtension((mode) => setHelixModeRef.current(mode)),
        mermaidPreviewExtension((payload) =>
          onOpenMermaidRef.current?.(payload),
        ),
        wikilinksExtension({
          getVaultFiles: () => vaultFilesRef.current ?? [],
          currentPath: path,
          onNavigate: (target, focusLine) =>
            onNavigateFileRef.current?.(target, focusLine),
        }),
        tagsExtension({
          onTagClick: (tag) => onTagClickRef.current?.(tag),
        }),
        imageAttachmentsExtension({
          currentPath: path,
          getAttachmentsDir: () =>
            rootPathRef.current ? `${rootPathRef.current}/attachments` : null,
        }),
        // Single shared autocomplete instance -- every completion feature adds
        // a provider here rather than its own autocompletion() (which conflict
        // under codemirror-helix). See lib/completion.ts.
        editorCompletionExtension([
          wikilinkCompletionProvider(() => vaultFilesRef.current ?? []),
          // `[[Note#heading]]` / `[[#heading]]` heading-reference completion.
          headingCompletionProvider(() => vaultFilesRef.current ?? []),
          // `#tag` completion from the vault-wide tag index.
          tagCompletionProvider(() => getAllTagsRef.current?.() ?? []),
          // Plain-text word completion from words already in the document.
          wordCompletionProvider(),
        ]),
        docStatsReporterExtension((stats) => setDocStatsRef.current(stats)),
        // Per-file scroll offset, across tab switches and app restarts.
        scrollPersistenceExtension(path),
        frontmatterExtension(),
        ...buildSharedExtensions(),
        languageCompartment.of([]),
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              void performSaveRef.current();
              return true;
            },
          },
        ]),
      ],
      [],
    );

    useEffect(() => {
      const view = cmRef.current?.view;
      if (!view) return;
      view.dispatch({
        effects: keybindingCompartment.reconfigure(
          keybindingExtensionFor(settings.keybindingMode),
        ),
      });
    }, [settings.keybindingMode]);

    useEffect(() => {
      const view = cmRef.current?.view;
      if (!view) return;
      view.dispatch({
        effects: lineNumberCompartment.reconfigure(
          lineNumbersExtensionFor(settings.relativeLineNumbers),
        ),
      });
    }, [settings.relativeLineNumbers]);

    useEffect(() => {
      const view = cmRef.current?.view;
      if (!view) return;
      view.dispatch({
        effects: indentCompartment.reconfigure(
          indentExtensionFor(settings.tabSize),
        ),
      });
    }, [settings.tabSize]);

    useEffect(() => {
      const view = cmRef.current?.view;
      if (!view) return;
      view.dispatch({
        effects: shortcutsCompartment.reconfigure(
          shortcutsExtension(
            settings.shortcuts,
            { start: settings.foldStartMarker, end: settings.foldEndMarker },
            () => openOutlineRef.current(),
          ),
        ),
      });
    }, [settings.shortcuts, settings.foldStartMarker, settings.foldEndMarker]);

    useEffect(() => {
      const view = cmRef.current?.view;
      if (!view) return;
      view.dispatch({
        effects: foldRegionCompartment.reconfigure(
          foldRegionExtensionFor(
            settings.foldStartMarker,
            settings.foldEndMarker,
          ),
        ),
      });
    }, [settings.foldStartMarker, settings.foldEndMarker]);

    useEffect(() => {
      if (doc.status !== "ready") return;
      let cancelled = false;
      void resolveLanguage(path).then((result) => {
        if (cancelled) return;
        const view = cmRef.current?.view;
        if (!view) return;
        view.dispatch({
          effects: languageCompartment.reconfigure(result?.ext ?? []),
        });
      });
      return () => {
        cancelled = true;
      };
    }, [path, doc.status]);

    // docStatsReporterExtension keeps stats live as the user types, but it
    // only fires on doc-changed CM transactions -- the initial load (and any
    // external reload) needs its own recompute since those replace `value`
    // without going through that listener.
    const readyContent = doc.status === "ready" ? doc.content : null;
    useEffect(() => {
      if (readyContent === null) return;
      setDocStats(computeDocStats(readyContent));
    }, [readyContent]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: focusToken is the re-trigger signal even when focusLine repeats
    useEffect(() => {
      if (!focusLine || doc.status !== "ready") return;
      const view = cmRef.current?.view;
      if (!view) return;
      const lineNumber = Math.min(Math.max(1, focusLine), view.state.doc.lines);
      const line = view.state.doc.line(lineNumber);
      view.dispatch({
        selection: { anchor: line.from, head: line.to },
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      });
      view.focus();
    }, [focusLine, focusToken, doc.status]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          cmRef.current?.view?.focus();
        },
        undo: () => {
          const view = cmRef.current?.view;
          if (view) undo(view);
        },
        redo: () => {
          const view = cmRef.current?.view;
          if (view) redo(view);
        },
      }),
      [],
    );

    if (doc.status === "loading") {
      return <div className="editor-status">Loading…</div>;
    }
    if (doc.status === "error") {
      return (
        <div className="editor-status editor-status-error">{doc.message}</div>
      );
    }
    if (doc.status === "binary" || doc.status === "toolarge") {
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      if (IMAGE_EXTENSIONS.includes(ext)) {
        return (
          <div className="editor-status">
            <img
              src={convertFileSrc(path)}
              alt={path.split("/").pop()}
              className="editor-image-preview"
            />
          </div>
        );
      }
      return (
        <div className="editor-status">
          {doc.status === "binary" ? "Binary file" : "File too large"} ·{" "}
          {formatBytes(doc.size)}
        </div>
      );
    }

    return (
      <div className="editor-pane">
        <div className="editor-canvas">
          <CodeMirror
            ref={cmRef}
            value={doc.content}
            onChange={onChange}
            extensions={extensions}
            theme="none"
            height="100%"
            className="editor-codemirror"
            basicSetup={{
              // Provided via lineNumberCompartment instead so relative mode
              // can be reconfigured at runtime (see extensions.ts).
              lineNumbers: false,
              highlightActiveLineGutter: true,
              foldGutter: false,
              bracketMatching: true,
              closeBrackets: true,
              // Wikilinks owns its own autocompletion() instance (see
              // wikilinks.ts) so its source and startCompletion share one
              // @codemirror/autocomplete module; two instances would fight.
              autocompletion: false,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
              searchKeymap: true,
            }}
          />
          {settings.keybindingMode === "helix" && helixMode && (
            <div className="helix-mode-chip" title={`Helix mode: ${helixMode}`}>
              {helixMode}
            </div>
          )}
          {outlineOpen && (
            <OutlineOverlay
              view={cmRef.current?.view ?? null}
              onClose={() => setOutlineOpen(false)}
            />
          )}
        </div>
        <StatusBar stats={docStats} />
      </div>
    );
  },
);
