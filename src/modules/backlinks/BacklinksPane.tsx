import { ContextMenu } from "@/lib/ContextMenu";
import { fileRowMenuItems } from "@/lib/fileRowMenu";
import { useI18n } from "@/lib/i18n";
import { useContextMenu } from "@/lib/useContextMenu";
import { FileText, Link2, X } from "lucide-react";
import { useBacklinks } from "./lib/useBacklinks";

type Props = {
  rootPath: string | null;
  /** The note whose incoming links are listed (the active tab). */
  targetPath: string | null;
  vaultFiles: readonly string[];
  onOpenFile: (path: string, line?: number) => void;
  onClose: () => void;
};

function basename(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.(md|markdown)$/i, "");
}

/** Docked panel listing every note that links to the active one (issue
 * #21), with the linking line as context. */
export function BacklinksPane({
  rootPath,
  targetPath,
  vaultFiles,
  onOpenFile,
  onClose,
}: Props) {
  const { t } = useI18n();
  const { index, groups } = useBacklinks(rootPath, targetPath, vaultFiles);
  const fileMenu = useContextMenu<string>();
  const total = groups.reduce((n, g) => n + g.refs.length, 0);

  return (
    <div className="backlinks-pane">
      <div className="mermaid-pane-header">
        <Link2 size={14} strokeWidth={1.75} />
        <span className="mermaid-pane-title">
          {t("backlinks.title")}
          {targetPath && total > 0 && (
            <span className="backlinks-count">{total}</span>
          )}
        </span>
        <button
          type="button"
          className="mermaid-pane-btn"
          title={t("common.close")}
          onClick={onClose}
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
      <div className="backlinks-body">
        {!targetPath ? (
          <div className="backlinks-empty">{t("backlinks.noFile")}</div>
        ) : index.status === "loading" ? (
          <div className="backlinks-empty">{t("common.scanning")}</div>
        ) : index.status === "error" ? (
          <div className="backlinks-empty">{index.message}</div>
        ) : groups.length === 0 ? (
          <div className="backlinks-empty">
            {t("backlinks.empty", { name: basename(targetPath) })}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.path} className="backlinks-group">
              <button
                type="button"
                className="backlinks-file"
                onClick={() => onOpenFile(group.path)}
                onContextMenu={(e) => fileMenu.open(e, group.path)}
                title={group.path}
              >
                <FileText size={13} strokeWidth={1.75} />
                {basename(group.path)}
              </button>
              {group.refs.map((ref) => (
                <button
                  type="button"
                  key={ref.line}
                  className="backlinks-row"
                  onClick={() => onOpenFile(group.path, ref.line)}
                  onContextMenu={(e) => fileMenu.open(e, group.path)}
                >
                  <span className="backlinks-line">{ref.line}</span>
                  <span className="backlinks-context">{ref.context}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
      {fileMenu.menu && (
        <ContextMenu
          x={fileMenu.menu.x}
          y={fileMenu.menu.y}
          items={fileRowMenuItems(fileMenu.menu.data, {
            onOpen: (p) => onOpenFile(p),
          })}
          onClose={fileMenu.close}
        />
      )}
    </div>
  );
}
