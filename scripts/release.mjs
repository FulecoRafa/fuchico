#!/usr/bin/env node
// Local release pipeline (no CI). Run from the repo root.
//
//   node scripts/release.mjs 0.2.0            # bump, commit, tag, build, publish
//   node scripts/release.mjs 0.2.0 --dry-run  # everything except git push / gh release / tap update
//   node scripts/release.mjs --upload         # on Linux/Windows: build for this OS and
//                                             # attach the assets to the existing release
//                                             # for the version in tauri.conf.json
//
// macOS builds both Apple Silicon and Intel bundles (needs
// `rustup target add x86_64-apple-darwin` once). Linux and Windows assets are
// produced by running `--upload` on a machine of that OS after checking out
// the tag. See docs/RELEASING.md.
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = "FulecoRafa/fuchico";
const TAP = "FulecoRafa/homebrew-tap";
const BUNDLE_DIR = "src-tauri/target";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const uploadOnly = args.includes("--upload");
const version = args.find((a) => !a.startsWith("--"));

const sh = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`);
  if (opts.skip) return console.log("  (skipped: dry run)");
  execSync(cmd, { stdio: "inherit", ...opts });
};
const out = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const die = (msg) => {
  console.error(`error: ${msg}`);
  process.exit(1);
};

const confVersion = () =>
  JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")).version;

// Collect the installers tauri produced for a target (or the host).
function assets(target) {
  const base = target ? join(BUNDLE_DIR, target, "release/bundle") : join(BUNDLE_DIR, "release/bundle");
  if (!existsSync(base)) return [];
  const want = /\.(dmg|AppImage|deb|rpm|msi|exe)$/;
  const found = [];
  for (const kind of readdirSync(base)) {
    const dir = join(base, kind);
    for (const f of readdirSync(dir)) if (want.test(f)) found.push(join(dir, f));
  }
  return found;
}

function build(target) {
  sh(`pnpm tauri build${target ? ` --target ${target}` : ""}`);
  const list = assets(target);
  if (!list.length) die(`no installers found for ${target ?? process.platform}`);
  return list;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function updateTap(v, dmgs) {
  const arm = dmgs.find((f) => f.endsWith(`_${v}_aarch64.dmg`));
  const intel = dmgs.find((f) => f.endsWith(`_${v}_x64.dmg`));
  if (!arm || !intel) die("both dmgs are needed to update the Homebrew cask");
  const cask = readFileSync("packaging/homebrew/fuchico.rb", "utf8")
    .replace(/^  version ".*"/m, `  version "${v}"`)
    .replace(/arm:   ".*"/, `arm:   "${sha256(arm)}"`)
    .replace(/intel: ".*"/, `intel: "${sha256(intel)}"`);
  writeFileSync("packaging/homebrew/fuchico.rb", cask);
  if (dryRun) return console.log("\n(dry run) cask updated locally only:\n" + cask);
  const dir = mkdtempSync(join(tmpdir(), "tap-"));
  sh(`gh repo clone ${TAP} ${dir} -- --depth 1`);
  writeFileSync(join(dir, "Casks/fuchico.rb"), cask);
  sh(`git -C ${dir} commit -am "fuchico ${v}"`);
  sh(`git -C ${dir} push`);
}

if (uploadOnly) {
  const v = confVersion();
  const files = build();
  sh(`gh release upload v${v} ${files.map((f) => `"${f}"`).join(" ")} --repo ${REPO} --clobber`, { skip: dryRun });
  console.log(`\nuploaded ${files.length} asset(s) to v${v}`);
  process.exit(0);
}

if (!version) die("usage: node scripts/release.mjs <version> [--dry-run] | --upload");
if (process.platform !== "darwin") die("the full release runs on macOS; use --upload elsewhere");
if (out("git status --porcelain")) die("working tree is not clean");
if (out("git branch --show-current") !== "main") die("release from main");
if (spawnSync("gh", ["auth", "status"]).status !== 0) die("gh is not authenticated");
const targets = out("rustup target list --installed").split("\n");
for (const t of ["aarch64-apple-darwin", "x86_64-apple-darwin"])
  if (!targets.includes(t)) die(`missing rust target: rustup target add ${t}`);

// 1. Version bump + tag.
sh(`node scripts/set-version.mjs ${version}`);
if (out("git status --porcelain")) sh(`git commit -qam "release: v${version}"`);
else console.log("  (version already set; nothing to commit)");
sh(`git tag v${version}`);

// 2. Build both macOS bundles.
const dmgs = [
  ...build("aarch64-apple-darwin"),
  ...build("x86_64-apple-darwin"),
].filter((f) => f.endsWith(".dmg"));

// 3. Push and publish.
sh("git push --follow-tags", { skip: dryRun });
const notes = `Native builds for macOS (Apple Silicon and Intel). Linux and Windows assets are added separately when available; Linux users can also use \`nix run github:${REPO}\`.

**macOS:** the app is not signed. After moving it to Applications run \`xattr -dr com.apple.quarantine /Applications/Fuchico.app\` once, or right-click › Open on first launch.`;
sh(
  `gh release create v${version} ${dmgs.map((f) => `"${f}"`).join(" ")} --repo ${REPO} --title "Fuchico v${version}" --notes ${JSON.stringify(notes)}${version.includes("-") ? " --prerelease" : ""}`,
  { skip: dryRun },
);

// 4. Homebrew cask.
updateTap(version, dmgs);
if (!dryRun) {
  sh(`git commit -qam "chore: cask checksums for v${version}"`);
  sh("git push");
}
console.log(`\nrelease v${version} ${dryRun ? "prepared (dry run; tag and commit are local)" : "published"}`);
