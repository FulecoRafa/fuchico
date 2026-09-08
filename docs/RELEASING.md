# Releasing Fuchico

Releases are built and published **locally** with `scripts/release.mjs`; there
is no CI. Before releasing, run the checks yourself:

```sh
pnpm exec biome check src && pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm exec vite build
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

## macOS (the main release)

One-time setup: `rustup target add x86_64-apple-darwin` and `gh auth login`.

```sh
node scripts/release.mjs 0.2.0
```

From a clean `main` this bumps the version everywhere
(`scripts/set-version.mjs`), commits and tags `v0.2.0`, builds the Apple
Silicon and Intel bundles, pushes, creates the GitHub Release with both
`.dmg` files attached, and updates `Casks/fuchico.rb` in
`FulecoRafa/homebrew-tap` with the new checksums. Add `--dry-run` to do
everything except pushing and publishing (tag and commit stay local; use
`git tag -d v0.2.0 && git reset --hard HEAD~1` to undo). A version with a
hyphen (`0.2.0-beta.1`) is published as a pre-release.

## Linux and Windows assets

Build on a machine of that OS after checking out the tag:

```sh
git checkout v0.2.0 && pnpm install
node scripts/release.mjs --upload
```

This runs `pnpm tauri build` for the host and attaches the installers
(`.deb`, `.rpm`, `.AppImage` on Linux; `-setup.exe`, `.msi` on Windows) to the
existing release. Linux prerequisites: the Tauri system packages
(`libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf
libfontconfig1-dev libfreetype-dev libssl-dev`). Linux users can also skip
the installers entirely with `nix run github:FulecoRafa/fuchico`.

| Platform | Assets |
| --- | --- |
| macOS Apple Silicon | `Fuchico_X.Y.Z_aarch64.dmg` |
| macOS Intel | `Fuchico_X.Y.Z_x64.dmg` |
| Linux x86_64 | `Fuchico_X.Y.Z_amd64.deb`, `.AppImage`, `Fuchico-X.Y.Z-1.x86_64.rpm` |
| Windows x86_64 | `Fuchico_X.Y.Z_x64-setup.exe` (NSIS), `Fuchico_X.Y.Z_x64_en-US.msi` |

## Signing

Builds are **unsigned** (#31). macOS users must clear the quarantine flag
once (`xattr -dr com.apple.quarantine /Applications/Fuchico.app`) or use
right-click › Open. To sign and notarize later, export
`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
`APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` in the shell that runs the
release script; `tauri build` picks them up.

## Package managers

| Channel | Status | What is needed |
| --- | --- | --- |
| Homebrew (#34) | automated by the release script | Push access to `FulecoRafa/homebrew-tap` via `gh`. Users: `brew tap FulecoRafa/tap && brew install --cask fuchico`. |
| winget (#35) | manual | After a release with a Windows asset, submit with `wingetcreate` (see `packaging/winget/README.md`). Later versions: `wingetcreate update FulecoRafa.Fuchico --version X.Y.Z --urls <setup.exe url> --submit`. |
| Flatpak (#37) | manual | Flathub takes submissions as a PR to `flathub/flathub` with `packaging/flatpak/*` (update the .deb URL and sha256 first). |
| Nix | in-repo | `nix run github:FulecoRafa/fuchico`; bump `cargoHash`/`pnpmDeps.hash` in `package.nix` when dependencies change. |

## File associations (#38)

`tauri.conf.json › bundle.fileAssociations` registers `.md`/`.markdown` on
every platform. macOS delivers opened files via `RunEvent::Opened`; Linux and
Windows pass them as arguments, and `tauri-plugin-single-instance` forwards a
second launch to the running app. The frontend (`src/lib/useOpenRequests.ts`)
opens the file as a tab when it is inside the current vault, adopts its
folder as the vault when none is open, and otherwise opens a standalone
editor window.
