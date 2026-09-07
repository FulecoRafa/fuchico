# Releasing Fuchico

Releases are built by GitHub Actions from a `v*` tag
(`.github/workflows/release.yml`). Every push and pull request also runs
`.github/workflows/ci.yml` (biome, tsc, vitest, vite build, cargo test).

## Cutting a release

```sh
node scripts/set-version.mjs 0.2.0      # package.json, tauri.conf.json, Cargo.toml + Cargo.lock, package.nix
git commit -am "release: v0.2.0"
git tag v0.2.0
git push --follow-tags
```

The workflow builds:

| Platform | Assets |
| --- | --- |
| macOS Apple Silicon | `Fuchico_X.Y.Z_aarch64.dmg`, `.app.tar.gz` |
| macOS Intel | `Fuchico_X.Y.Z_x64.dmg`, `.app.tar.gz` |
| Linux x86_64 | `Fuchico_X.Y.Z_amd64.deb`, `.AppImage`, `Fuchico-X.Y.Z-1.x86_64.rpm` |
| Windows x86_64 | `Fuchico_X.Y.Z_x64-setup.exe` (NSIS), `Fuchico_X.Y.Z_x64_en-US.msi` |

and publishes them on a GitHub Release named after the tag. A tag containing
a hyphen (`v0.2.0-beta.1`) is marked as a pre-release.

## Signing

Builds are **unsigned** for now (#31). macOS users must clear the quarantine
flag once (`xattr -dr com.apple.quarantine /Applications/Fuchico.app`) or use
right-click › Open. To enable signing and notarization later, add these
repository secrets and forward them in the `env:` of the `tauri-action` step:
`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`. Windows code signing works the
same way with `TAURI_SIGNING_*` / a `windows.certificateThumbprint` entry in
`tauri.conf.json`.

## Package managers

| Channel | Status | What is needed |
| --- | --- | --- |
| Homebrew (#34) | automated | The tap repo `FulecoRafa/homebrew-tap` exists; add the `HOMEBREW_TAP_TOKEN` secret (fine-grained PAT, Contents: write on the tap). The `homebrew` job then rewrites `Casks/fuchico.rb` from `packaging/homebrew/fuchico.rb` after each release. Users: `brew tap FulecoRafa/tap && brew install --cask fuchico`. |
| winget (#35) | manual first time | Submit the first manifest with `wingetcreate new` (see `packaging/winget/README.md`). Afterwards the `winget` job updates it automatically when `WINGET_TOKEN` is set. |
| Flatpak (#37) | manual | Flathub takes submissions as a PR to `flathub/flathub` with `packaging/flatpak/*` (update the .deb URL and sha256 first). Once accepted Flathub builds each version from its own repo. |
| Nix | in-repo | `nix run github:FulecoRafa/fuchico`; bump `cargoHash`/`pnpmDeps.hash` in `package.nix` when dependencies change. |

## File associations (#38)

`tauri.conf.json › bundle.fileAssociations` registers `.md`/`.markdown` on
every platform. macOS delivers opened files via `RunEvent::Opened`; Linux and
Windows pass them as arguments, and `tauri-plugin-single-instance` forwards a
second launch to the running app. The frontend (`src/lib/useOpenRequests.ts`)
opens the file as a tab when it is inside the current vault, adopts its
folder as the vault when none is open, and otherwise opens a standalone
editor window.
