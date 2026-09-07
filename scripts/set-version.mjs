#!/usr/bin/env node
// Keeps package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml and
// package.nix (plus the fuchico entry in Cargo.lock) on the same version. Usage: node scripts/set-version.mjs 0.2.0
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  console.error("usage: node scripts/set-version.mjs <semver>");
  process.exit(1);
}

const edit = (file, fn) => writeFileSync(file, fn(readFileSync(file, "utf8")));

edit("package.json", (s) => s.replace(/"version": "[^"]+"/, `"version": "${version}"`));
edit("src-tauri/tauri.conf.json", (s) => s.replace(/"version": "[^"]+"/, `"version": "${version}"`));
edit("src-tauri/Cargo.toml", (s) => s.replace(/^version = "[^"]+"/m, `version = "${version}"`));
edit("src-tauri/Cargo.lock", (s) =>
  s.replace(/(name = "fuchico"\nversion = )"[^"]+"/, `$1"${version}"`),
);
edit("package.nix", (s) => s.replace(/version = "[^"]+";/, `version = "${version}";`));

console.log(`version set to ${version}; now: git commit -am "release: v${version}" && git tag v${version} && git push --follow-tags`);
