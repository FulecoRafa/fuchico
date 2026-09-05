import { Copy, Eye, FileText } from "lucide-react";
import type { ContextMenuItem } from "./ContextMenu";
import { copyPathToClipboard, revealInFileManager } from "./fileActions";
import { t } from "./i18n";

/** Shared right-click items for any list row that points at a vault file
 * (search results, tag file lists, agenda items). */
export function fileRowMenuItems(
  path: string,
  opts: { onOpen: (path: string) => void; extra?: ContextMenuItem[] },
): ContextMenuItem[] {
  return [
    {
      label: t("common.open"),
      icon: FileText,
      onSelect: () => opts.onOpen(path),
    },
    ...(opts.extra ?? []),
    { kind: "separator" },
    {
      label: t("common.revealInFileManager"),
      icon: Eye,
      onSelect: () => void revealInFileManager(path),
    },
    {
      label: t("common.copyPath"),
      icon: Copy,
      onSelect: () => void copyPathToClipboard(path),
    },
  ];
}
