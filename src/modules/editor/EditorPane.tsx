import { redo, undo } from "@codemirror/commands";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { convertFileSrc } from "@tauri-apps/api/core";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { helix } from "codemirror-helix";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildSharedExtensions,
  keybindingCompartment,
  languageCompartment,
} from "./lib/extensions";
import {
  type HelixMode,
  helixHandlersExtension,
  helixModeReporterExtension,
} from "./lib/helix";
import { resolveLanguage } from "./lib/languageResolver";
import { useDocument } from "./lib/useDocument";

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
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const EditorPane = forwardRef<EditorPaneHandle, Props>(
  function EditorPane(props, ref) {
    const { path, onDirtyChange, onSaved, onClose } = props;
    const { doc, onChange, save } = useDocument({ path, onDirtyChange });
    const cmRef = useRef<ReactCodeMirrorRef>(null);
    const [helixMode, setHelixMode] = useState<HelixMode | null>("normal");
    const setHelixModeRef = useRef(setHelixMode);
    setHelixModeRef.current = setHelixMode;

    // Stabilize save/onSaved/onClose via refs so `extensions` never changes
    // identity — a new identity makes @uiw/react-codemirror reconfigure the
    // whole state, wiping the language compartment.
    const saveRef = useRef(save);
    saveRef.current = save;
    const onSavedRef = useRef(onSaved);
    onSavedRef.current = onSaved;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const performSave = useCallback(async () => {
      await saveRef.current();
      onSavedRef.current?.();
    }, []);
    const performSaveRef = useRef(performSave);
    performSaveRef.current = performSave;

    const extensions = useMemo(
      () => [
        // basicSetup is added before user extensions by @uiw/react-codemirror,
        // so helix must be elevated to Prec.highest to win the keymap.
        keybindingCompartment.of(Prec.highest(helix())),
        helixHandlersExtension(() => ({
          save: () => {
            void performSaveRef.current();
          },
          close: () => onCloseRef.current?.(),
        })),
        helixModeReporterExtension((mode) => setHelixModeRef.current(mode)),
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
        <CodeMirror
          ref={cmRef}
          value={doc.content}
          onChange={onChange}
          extensions={extensions}
          theme="none"
          height="100%"
          className="editor-codemirror"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            foldGutter: false,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            searchKeymap: true,
          }}
        />
        {helixMode && (
          <div className="helix-mode-chip" title={`Helix mode: ${helixMode}`}>
            {helixMode}
          </div>
        )}
      </div>
    );
  },
);
