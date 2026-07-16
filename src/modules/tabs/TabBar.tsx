import { X } from "lucide-react";
import type { Tab } from "./lib/useTabs";

type Props = {
  tabs: Tab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
};

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

export function TabBar({ tabs, activePath, onSelect, onClose }: Props) {
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
    </div>
  );
}
