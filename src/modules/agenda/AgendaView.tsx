import { ContextMenu } from "@/lib/ContextMenu";
import { fileRowMenuItems } from "@/lib/fileRowMenu";
import { t, useI18n } from "@/lib/i18n";
import { useContextMenu } from "@/lib/useContextMenu";
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

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function AgendaRow({
  item,
  onToggle,
  onOpen,
  onContextMenu,
}: {
  item: AgendaItem;
  onToggle: (item: AgendaItem) => void;
  onOpen: (item: AgendaItem) => void;
  onContextMenu: (e: React.MouseEvent, item: AgendaItem) => void;
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
      onContextMenu={(e) => onContextMenu(e, item)}
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
        {item.text || t("agenda.emptyItem")}
      </span>
      {item.time && <span className="agenda-row-time">{item.time}</span>}
      {item.recurrence && (
        <span className="agenda-row-recur" title={t("agenda.recurringTask")}>
          🔁 {item.recurrence}
          {item.recurTime ? ` ${item.recurTime}` : ""}
        </span>
      )}
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
  onContextMenu,
}: {
  title: string;
  items: AgendaItem[];
  onToggle: (item: AgendaItem) => void;
  onOpen: (item: AgendaItem) => void;
  onContextMenu: (e: React.MouseEvent, item: AgendaItem) => void;
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
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

export function AgendaView({ rootPath, onOpenItem }: Props) {
  const { locale } = useI18n();
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
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    [locale],
  );
  const weekdayLetters = t("agenda.weekdayLetters").split(",");

  const dateFiltered = selectedDate ? (byDate.get(selectedDate) ?? []) : items;
  const overdue = dateFiltered.filter(
    (i) => !i.checked && i.date && i.date < today,
  );
  const due = dateFiltered.filter((i) => i.date === (selectedDate ?? today));
  const upcoming = dateFiltered.filter((i) => i.date && i.date > today);
  const noDate = dateFiltered.filter((i) => !i.date && !i.recurrence);
  const routines = items.filter((i) => i.recurrence);

  const onOpen = (item: AgendaItem) => onOpenItem(item.file, item.line);
  const rowMenu = useContextMenu<AgendaItem>();

  if (!rootPath) {
    return <div className="agenda-empty">{t("agenda.openFolder")}</div>;
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
            {monthLabel.format(new Date(cursor.year, cursor.month, 1))}
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
          {WEEKDAY_KEYS.map((key, i) => (
            <div key={key} className="agenda-calendar-weekday">
              {weekdayLetters[i]}
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
            {t("agenda.clearFilter", { date: selectedDate })}
          </button>
        )}
        <div className="agenda-routines">
          <div className="agenda-section-title">{t("agenda.routines")}</div>
          {routines.length === 0 && (
            <div className="agenda-status">
              {t("agenda.noRoutinesPrefix")}{" "}
              <code>🔁 daily|weekdays|weekends|mon,…</code>{" "}
              {t("agenda.noRoutinesSuffix")}
            </div>
          )}
          {routines.map((item) => (
            <button
              type="button"
              key={`${item.file}:${item.line}`}
              className="agenda-routine-row"
              onClick={() => onOpen(item)}
              onContextMenu={(e) => rowMenu.open(e, item)}
            >
              <span className="agenda-routine-text">{item.text}</span>
              <span className="agenda-routine-rule">
                🔁 {item.recurrence}
                {item.recurTime ? ` ${item.recurTime}` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="agenda-list">
        {state.status === "loading" && (
          <div className="agenda-status">{t("common.scanning")}</div>
        )}
        {state.status === "error" && (
          <div className="agenda-status agenda-status-error">
            {state.message}
          </div>
        )}
        {state.status === "loaded" && items.length === 0 && (
          <div className="agenda-status">
            {t("agenda.noTasksPrefix")} <code>- [ ] …</code>,{" "}
            <code>TODO: …</code>, {t("agenda.or")} <code>📅 YYYY-MM-DD …</code>{" "}
            {t("agenda.noTasksSuffix")}
          </div>
        )}
        {state.status === "loaded" && items.length > 0 && (
          <>
            <AgendaSection
              title={t("agenda.overdue")}
              items={overdue}
              onToggle={toggle}
              onOpen={onOpen}
              onContextMenu={rowMenu.open}
            />
            <AgendaSection
              title={t("agenda.today")}
              items={due}
              onToggle={toggle}
              onOpen={onOpen}
              onContextMenu={rowMenu.open}
            />
            <AgendaSection
              title={t("agenda.upcoming")}
              items={upcoming}
              onToggle={toggle}
              onOpen={onOpen}
              onContextMenu={rowMenu.open}
            />
            <AgendaSection
              title={t("agenda.noDate")}
              items={noDate}
              onToggle={toggle}
              onOpen={onOpen}
              onContextMenu={rowMenu.open}
            />
            {overdue.length + due.length + upcoming.length + noDate.length ===
              0 && (
              <div className="agenda-status">{t("agenda.nothingHere")}</div>
            )}
          </>
        )}
      </div>
      {rowMenu.menu && (
        <ContextMenu
          x={rowMenu.menu.x}
          y={rowMenu.menu.y}
          items={fileRowMenuItems(rowMenu.menu.data.file, {
            onOpen: () => onOpen(rowMenu.menu?.data as AgendaItem),
          })}
          onClose={rowMenu.close}
        />
      )}
    </div>
  );
}
