import { notifyFsChanged } from "@/modules/explorer/lib/useFileTree";
import { invoke } from "@tauri-apps/api/core";

/** Note templates and daily notes (issue #26). Templates are plain Markdown
 * files in the vault's templates folder; `{{date}}`, `{{time}}`, `{{title}}`
 * and `{{date:YYYY-MM-DD}}`-style tokens are expanded on use. */

type ReadResult =
  | { kind: "text"; content: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "toolarge"; size: number; limit: number };

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDate(d: Date, fmt = "YYYY-MM-DD"): string {
  return fmt
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/ss/g, pad(d.getSeconds()));
}

export function expandTemplate(
  text: string,
  vars: { title: string; now?: Date },
): string {
  const now = vars.now ?? new Date();
  return text
    .replace(/\{\{\s*date:([^}]+?)\s*\}\}/g, (_, f: string) =>
      formatDate(now, f.trim()),
    )
    .replace(/\{\{\s*date\s*\}\}/g, formatDate(now))
    .replace(/\{\{\s*time\s*\}\}/g, formatDate(now, "HH:mm"))
    .replace(/\{\{\s*title\s*\}\}/g, vars.title);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function stem(path: string): string {
  return basename(path).replace(/\.[^.]+$/, "");
}

async function exists(path: string): Promise<boolean> {
  try {
    await invoke("fs_stat", { path });
    return true;
  } catch {
    return false;
  }
}

async function readText(path: string): Promise<string | null> {
  try {
    const r = await invoke<ReadResult>("fs_read_file", { path });
    return r.kind === "text" ? r.content : null;
  } catch {
    return null;
  }
}

async function ensureDir(path: string): Promise<void> {
  try {
    await invoke("fs_create_dir", { path });
  } catch (e) {
    if (!String(e).includes("already exists")) throw e;
  }
}

async function createNote(path: string, content: string): Promise<void> {
  await ensureDir(path.slice(0, path.lastIndexOf("/")));
  await invoke("fs_write_file", { path, content, source: "template" });
  notifyFsChanged(path.slice(0, path.lastIndexOf("/")));
}

/** Template file reserved for seeding daily notes (not offered as a
 * "New Note from Template" entry). */
export const DAILY_TEMPLATE = "daily.md";

/** Absolute paths of template files among `vaultFiles`. */
export function listTemplates(
  root: string,
  templatesFolder: string,
  vaultFiles: readonly string[],
): string[] {
  const prefix = `${root}/${templatesFolder.replace(/^\/+|\/+$/g, "")}/`;
  return vaultFiles
    .filter(
      (f) =>
        f.startsWith(prefix) &&
        f.endsWith(".md") &&
        basename(f) !== DAILY_TEMPLATE,
    )
    .sort();
}

/** Opens (creating on first use) today's daily note and returns its path.
 * Seeded from `<templates>/daily.md` when present. */
export async function openDailyNote(opts: {
  root: string;
  dailyNotesFolder: string;
  templatesFolder: string;
}): Promise<string> {
  const title = formatDate(new Date());
  const folder = opts.dailyNotesFolder.replace(/^\/+|\/+$/g, "");
  const path = `${opts.root}/${folder}/${title}.md`;
  if (await exists(path)) return path;
  const template = await readText(
    `${opts.root}/${opts.templatesFolder.replace(/^\/+|\/+$/g, "")}/${DAILY_TEMPLATE}`,
  );
  const content = expandTemplate(template ?? "# {{title}}\n\n", { title });
  await createNote(path, content);
  return path;
}

/** Creates a new note in the vault root from `templatePath`, named after the
 * template plus a timestamp (rename it afterwards with F2). */
export async function createFromTemplate(
  root: string,
  templatePath: string,
): Promise<string> {
  const template = (await readText(templatePath)) ?? "";
  const title = `${stem(templatePath)} ${formatDate(new Date(), "YYYY-MM-DD HHmm")}`;
  let path = `${root}/${title}.md`;
  let n = 2;
  while (await exists(path)) path = `${root}/${title} ${n++}.md`;
  await createNote(path, expandTemplate(template, { title }));
  return path;
}
