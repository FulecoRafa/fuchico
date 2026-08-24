import { ContextMenu, type ContextMenuItem } from "@/lib/ContextMenu";
import { X } from "lucide-react";
import { useState } from "react";
import type { Tab } from "./lib/useTabs";

type Props = {
  tabs: Tab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseOthers: (path: string) => void;
  onCloseAll: () => void;
};

type MenuState = { x: number; y: number; path: string } | null;

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

export function TabBar({
  tabs,
  activePath,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
}: Props) {
  const [menu, setMenu] = useState<MenuState>(null);

  const menuItems: ContextMenuItem[] = menu
    ? [
        { label: "Close", onSelect: () => onClose(menu.path) },
        {
          label: "Close others",
          disabled: tabs.length < 2,
          onSelect: () => onCloseOthers(menu.path),
        },
        { label: "Close all", onSelect: onCloseAll },
      ]
    : [];

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.path === activePath;
        return (
          <div
            key={tab.path}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            className={isActive ? "tab tab-active" : "tab"}
            title={tab.path}
            onClick={() => onSelect(tab.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, path: tab.path });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(tab.path);
              }
            }}
          >
            {tab.dirty && <span className="tab-dirty-dot" />}
            <span className="tab-name">{basename(tab.path)}</span>
            <button
              type="button"
              className="tab-close-btn"
              title="Close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.path);
              }}
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        );
      })}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
