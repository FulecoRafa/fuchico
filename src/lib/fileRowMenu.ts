import { Copy, Eye, FileText } from "lucide-react";
import type { ContextMenuItem } from "./ContextMenu";
import { copyPathToClipboard, revealInFileManager } from "./fileActions";

/** Shared right-click items for any list row that points at a vault file
 * (search results, tag file lists, agenda items). */
export function fileRowMenuItems(
  path: string,
  opts: { onOpen: (path: string) => void; extra?: ContextMenuItem[] },
): ContextMenuItem[] {
  return [
    { label: "Open", icon: FileText, onSelect: () => opts.onOpen(path) },
    ...(opts.extra ?? []),
    { kind: "separator" },
    {
      label: "Reveal in file manager",
      icon: Eye,
      onSelect: () => void revealInFileManager(path),
    },
    {
      label: "Copy path",
      icon: Copy,
      onSelect: () => void copyPathToClipboard(path),
    },
  ];
}
