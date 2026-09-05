import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  startCompletion,
} from "@codemirror/autocomplete";
import {
  type ChangeSpec,
  EditorSelection,
  type EditorState,
  type TransactionSpec,
} from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { CompletionProvider } from "./completion";

/** Task helpers (issue #45): the agenda scanner recognises `- [ ] …`,
 * `📅 YYYY-MM-DD [HH:MM]` and `🔁 rule [HH:MM]`. These helpers write that
 * canonical form so nobody has to type the emoji by hand. */

export const DUE_RE = /📅\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/u;
export const RECUR_RE =
  /🔁\s*(daily|weekdays|weekends|[a-z]{3}(?:,[a-z]{3})*)(?:\s+(\d{2}:\d{2}))?/iu;
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(?:\[([ xX])\]\s*)?/;

export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Quick-pick due dates offered by the completion popup / palette. */
export function dueDateOptions(
  now = new Date(),
): { label: string; date: string; detail: string }[] {
  const out = [
    { label: "Today", date: isoDate(now) },
    { label: "Tomorrow", date: isoDate(addDays(now, 1)) },
  ];
  for (let i = 2; i <= 7; i++) {
    const d = addDays(now, i);
    out.push({
      label: i === 7 ? "In a week" : WEEKDAYS[d.getDay()],
      date: isoDate(d),
    });
  }
  return out.map((o) => ({ ...o, detail: o.date }));
}

export const RECURRENCE_OPTIONS: {
  label: string;
  rule: string;
  detail: string;
}[] = [
  { label: "Daily", rule: "daily", detail: "every day" },
  { label: "Weekdays", rule: "weekdays", detail: "Mon–Fri" },
  { label: "Weekends", rule: "weekends", detail: "Sat–Sun" },
  { label: "Weekly (Mon)", rule: "mon", detail: "every Monday" },
  { label: "Mon, Wed, Fri", rule: "mon,wed,fri", detail: "" },
  { label: "Tue, Thu", rule: "tue,thu", detail: "" },
];

/** Add or remove the `[ ]` checkbox on every selected line. Plain lines
 * become `- [ ] …`, list items get a checkbox, task lines lose it. */
export function toggleTaskLineSpec(state: EditorState): TransactionSpec | null {
  const changes: ChangeSpec[] = [];
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) {
      if (seen.has(n)) continue;
      seen.add(n);
      const line = state.doc.line(n);
      if (line.text.trim() === "" && first !== last) continue;
      const m = LIST_RE.exec(line.text);
      if (!m) {
        const indent = /^\s*/.exec(line.text)?.[0] ?? "";
        changes.push({ from: line.from + indent.length, insert: "- [ ] " });
      } else if (m[3] !== undefined) {
        // task -> plain list item
        changes.push({
          from: line.from,
          to: line.from + m[0].length,
          insert: `${m[1]}${m[2]} `,
        });
      } else {
        changes.push({ from: line.from + m[0].length, insert: "[ ] " });
      }
    }
  }
  if (changes.length === 0) return null;
  return { changes, userEvent: "input" };
}

export function toggleTaskLine(view: EditorView): boolean {
  const spec = toggleTaskLineSpec(view.state);
  if (!spec) return false;
  view.dispatch(spec);
  return true;
}

/** Replace the line's `📅 …`/`🔁 …` token with `emoji value [time]`
 * (keeping an existing time when no new one is given), or append one at
 * the end of the line. */
export function lineTokenSpec(
  state: EditorState,
  re: RegExp,
  emoji: string,
  value: string,
  time?: string,
): TransactionSpec {
  const line = state.doc.lineAt(state.selection.main.head);
  const m = re.exec(line.text);
  const t = time ?? m?.[2];
  const token = `${emoji} ${value}${t ? ` ${t}` : ""}`;
  if (m && m.index !== undefined) {
    return {
      changes: {
        from: line.from + m.index,
        to: line.from + m.index + m[0].length,
        insert: token,
      },
    };
  }
  const trimmedEnd = line.text.replace(/\s+$/, "");
  const insert = `${trimmedEnd.length ? " " : ""}${token}`;
  return {
    changes: { from: line.from + trimmedEnd.length, to: line.to, insert },
    selection: EditorSelection.cursor(
      line.from + trimmedEnd.length + insert.length,
    ),
  };
}

export function setDueDate(view: EditorView, date: string, time?: string) {
  view.dispatch(lineTokenSpec(view.state, DUE_RE, "📅", date, time));
  return true;
}

export function setRecurrence(view: EditorView, rule: string, time?: string) {
  view.dispatch(lineTokenSpec(view.state, RECUR_RE, "🔁", rule, time));
  return true;
}

/** Put `📅 ` / `🔁 ` at the end of the line (if absent) and open the
 * completion popup so the quick-pick list acts as a picker. */
function pickToken(view: EditorView, re: RegExp, emoji: string): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const m = re.exec(line.text);
  if (m && m.index !== undefined) {
    // Existing token: put the cursor after its value so the popup replaces it.
    const valueFrom = line.from + m.index + m[0].indexOf(m[1]);
    view.dispatch({
      selection: EditorSelection.cursor(valueFrom + m[1].length),
    });
  } else {
    const trimmedEnd = line.text.replace(/\s+$/, "");
    const insert = `${trimmedEnd.length ? " " : ""}${emoji} `;
    view.dispatch({
      changes: { from: line.from + trimmedEnd.length, to: line.to, insert },
      selection: EditorSelection.cursor(
        line.from + trimmedEnd.length + insert.length,
      ),
    });
  }
  view.focus();
  startCompletion(view);
  return true;
}
export const pickDueDate = (view: EditorView) => pickToken(view, DUE_RE, "📅");
export const pickRecurrence = (view: EditorView) =>
  pickToken(view, RECUR_RE, "🔁");

// ─── Autocomplete: `@due`, `@repeat`, `📅`, `🔁` ────────────────────────────

/** `@due`, `@date`, `@today`, `@repeat`, `@every`, or a bare `📅`/`🔁`,
 * each followed by an optional partial value used to narrow the list. */
const TASK_TRIGGER_RE =
  /(?:^|\s)(@(?:d(?:ue?)?|date|today|tom(?:orrow)?|r(?:ep(?:eat)?)?|every|recur)?(?:\s\S*)?|📅\s*\S*|🔁\s*\S*)$/u;

type Kind = "due" | "recur";

function kindOf(text: string): Kind | null {
  if (text.startsWith("📅") || /^@(d|date|today|tom)/.test(text)) return "due";
  if (text.startsWith("🔁") || /^@(r|every|recur)/.test(text)) return "recur";
  if (text === "@") return "due"; // bare "@": dates first, plus repeat rules
  return null;
}

function taskCompletionSource(
  context: CompletionContext,
): CompletionResult | null {
  const before = context.matchBefore(TASK_TRIGGER_RE);
  if (!before) return null;
  const text = before.text.replace(/^\s/, "");
  const from = before.to - text.length;
  const kind = kindOf(text);
  if (!kind) return null;
  const line = context.state.doc.lineAt(context.pos);
  const existingTime = (kind === "due" ? DUE_RE : RECUR_RE).exec(
    line.text,
  )?.[2];
  const timeSuffix = existingTime ? ` ${existingTime}` : "";

  const mk = (
    label: string,
    detail: string,
    token: string,
    boost = 0,
  ): Completion => ({
    label,
    detail,
    type: kind === "due" ? "keyword" : "variable",
    boost,
    apply: (view, _c, f, t) => {
      view.dispatch({
        changes: { from: f, to: t, insert: token + timeSuffix },
        selection: EditorSelection.cursor(f + token.length + timeSuffix.length),
      });
    },
  });

  let options: Completion[] =
    kind === "due"
      ? dueDateOptions().map((o, i) =>
          mk(o.label, o.date, `📅 ${o.date}`, 10 - i),
        )
      : RECURRENCE_OPTIONS.map((o, i) =>
          mk(o.label, o.detail, `🔁 ${o.rule}`, 10 - i),
        );
  if (text === "@") {
    options.push(
      ...RECURRENCE_OPTIONS.map((o) =>
        mk(`Repeat: ${o.label}`, o.detail, `🔁 ${o.rule}`, -1),
      ),
    );
  }
  // Keep typing after the trigger word to narrow the list.
  const query = text.replace(/^(@\w*|📅|🔁)\s*/u, "").toLowerCase();
  if (query) {
    options = options.filter(
      (o) =>
        o.label.toLowerCase().includes(query) ||
        o.detail?.toLowerCase().includes(query),
    );
    if (options.length === 0) return null;
  }
  return { from, options, filter: false };
}

export function taskCompletionProvider(): CompletionProvider {
  return {
    source: taskCompletionSource,
    trigger: (before) => TASK_TRIGGER_RE.test(before),
  };
}
