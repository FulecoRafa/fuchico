import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ListTodo,
} from "lucide-react";
import { useMemo, useState } from "react";
import { type AgendaItem, useAgenda } from "./lib/useAgenda";

type Props = {
  rootPath: string | null;
  onOpenItem: (path: string, line: number) => void;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : path;
}

type CalendarCell = { key: string; iso: string | null };

function monthWeeks(year: number, month: number): CalendarCell[][] {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ key: `${year}-${month}-lead-${i}`, iso: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key: iso, iso });
  }
  let trail = 0;
  while (cells.length % 7 !== 0) {
    cells.push({ key: `${year}-${month}-trail-${trail}`, iso: null });
    trail++;
  }
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const WEEKDAY_LABELS: { key: string; label: string }[] = [
  { key: "sun", label: "S" },
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
];
const MONTH_LABEL = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

function AgendaRow({
  item,
  onToggle,
  onOpen,
}: {
  item: AgendaItem;
  onToggle: (item: AgendaItem) => void;
  onOpen: (item: AgendaItem) => void;
}) {
  return (
    // A checkbox <input> is interactive content, so this row can't be a
    // <button> (buttons can't nest interactive elements) — role+tabIndex
    // gives it the same keyboard/AT semantics instead.
    // biome-ignore lint/a11y/useSemanticElements: button cannot nest the checkbox <input>
    <div
      className="agenda-row"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
    >
      {item.kind === "task" ? (
        <input
          type="checkbox"
          className="agenda-row-checkbox"
          checked={item.checked}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggle(item)}
        />
      ) : item.kind === "event" ? (
        <CalendarClock
          size={13}
          strokeWidth={1.75}
          className="agenda-row-icon"
        />
      ) : (
        <ListTodo size={13} strokeWidth={1.75} className="agenda-row-icon" />
      )}
      <span
        className={
          item.checked ? "agenda-row-text agenda-row-done" : "agenda-row-text"
        }
      >
        {item.text || "(empty)"}
      </span>
      {item.time && <span className="agenda-row-time">{item.time}</span>}
      <span className="agenda-row-file" title={item.file}>
        {basename(item.file)}
      </span>
    </div>
  );
}

function AgendaSection({
  title,
  items,
  onToggle,
  onOpen,
}: {
  title: string;
  items: AgendaItem[];
  onToggle: (item: AgendaItem) => void;
  onOpen: (item: AgendaItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="agenda-section">
      <div className="agenda-section-title">{title}</div>
      {items.map((item) => (
        <AgendaRow
          key={`${item.file}:${item.line}`}
          item={item}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

export function AgendaView({ rootPath, onOpenItem }: Props) {
  const { state, toggle } = useAgenda(rootPath);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const items = state.status === "loaded" ? state.items : [];
  const today = todayIso();

  const byDate = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const item of items) {
      if (!item.date) continue;
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  const weeks = useMemo(() => monthWeeks(cursor.year, cursor.month), [cursor]);

  const visible = selectedDate ? (byDate.get(selectedDate) ?? []) : items;
  const overdue = visible.filter((i) => !i.checked && i.date && i.date < today);
  const due = visible.filter((i) => i.date === today);
  const upcoming = visible.filter((i) => i.date && i.date > today);
  const noDate = visible.filter((i) => !i.date);

  const onOpen = (item: AgendaItem) => onOpenItem(item.file, item.line);

  if (!rootPath) {
    return (
      <div className="agenda-empty">Open a folder to see tasks and events</div>
    );
  }

  return (
    <div className="agenda-view">
      <div className="agenda-calendar">
        <div className="agenda-calendar-header">
          <button
            type="button"
            className="agenda-nav-btn"
            onClick={() =>
              setCursor((c) =>
                c.month === 0
                  ? { year: c.year - 1, month: 11 }
                  : { year: c.year, month: c.month - 1 },
              )
            }
          >
            <ChevronLeft size={14} strokeWidth={1.75} />
          </button>
          <span className="agenda-calendar-title">
            {MONTH_LABEL.format(new Date(cursor.year, cursor.month, 1))}
          </span>
          <button
            type="button"
            className="agenda-nav-btn"
            onClick={() =>
              setCursor((c) =>
                c.month === 11
                  ? { year: c.year + 1, month: 0 }
                  : { year: c.year, month: c.month + 1 },
              )
            }
          >
            <ChevronRight size={14} strokeWidth={1.75} />
          </button>
        </div>
        <div className="agenda-calendar-grid">
          {WEEKDAY_LABELS.map(({ key, label }) => (
            <div key={key} className="agenda-calendar-weekday">
              {label}
            </div>
          ))}
          {weeks.map((week) =>
            week.map((cell) => {
              const { key, iso } = cell;
              if (!iso)
                return <div key={key} className="agenda-calendar-cell-empty" />;
              const hasItems = byDate.has(iso);
              const isToday = iso === today;
              const isSelected = iso === selectedDate;
              const day = Number(iso.slice(-2));
              return (
                <button
                  type="button"
                  key={iso}
                  className={[
                    "agenda-calendar-cell",
                    isToday && "agenda-calendar-cell-today",
                    isSelected && "agenda-calendar-cell-selected",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedDate(isSelected ? null : iso)}
                >
                  {day}
                  {hasItems && <span className="agenda-calendar-dot" />}
                </button>
              );
            }),
          )}
        </div>
        {selectedDate && (
          <button
            type="button"
            className="agenda-clear-filter"
            onClick={() => setSelectedDate(null)}
          >
            Clear filter ({selectedDate})
          </button>
        )}
      </div>

      <div className="agenda-list">
        {state.status === "loading" && (
          <div className="agenda-status">Scanning…</div>
        )}
        {state.status === "error" && (
          <div className="agenda-status agenda-status-error">
            {state.message}
          </div>
        )}
        {state.status === "loaded" && items.length === 0 && (
          <div className="agenda-status">
            No tasks yet. Use <code>- [ ] …</code>, <code>TODO: …</code>, or{" "}
            <code>📅 YYYY-MM-DD …</code> in your notes.
          </div>
        )}
        {state.status === "loaded" && items.length > 0 && (
          <>
            <AgendaSection
              title="Overdue"
              items={overdue}
              onToggle={toggle}
              onOpen={onOpen}
            />
            <AgendaSection
              title="Today"
              items={due}
              onToggle={toggle}
              onOpen={onOpen}
            />
            <AgendaSection
              title="Upcoming"
              items={upcoming}
              onToggle={toggle}
              onOpen={onOpen}
            />
            <AgendaSection
              title="No date"
              items={noDate}
              onToggle={toggle}
              onOpen={onOpen}
            />
            {overdue.length + due.length + upcoming.length + noDate.length ===
              0 && <div className="agenda-status">Nothing here.</div>}
          </>
        )}
      </div>
    </div>
  );
}
