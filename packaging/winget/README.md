# winget (issue #35)

winget packages are submitted as manifests to
[microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs). The package
id is `FulecoRafa.Fuchico` and the installer is the NSIS `-setup.exe` produced
by the Release workflow.

## First submission

1. Cut a release (`vX.Y.Z`) and wait for the Windows asset
   `Fuchico_X.Y.Z_x64-setup.exe` to appear on the GitHub Release.
2. On a Windows machine with winget:

   ```powershell
   winget install wingetcreate
   wingetcreate new https://github.com/FulecoRafa/fuchico/releases/download/vX.Y.Z/Fuchico_X.Y.Z_x64-setup.exe
   ```

   Fill in the prompts using `manifest-template/` here as the reference; the
   tool computes the SHA256 and opens the pull request against winget-pkgs
   (needs a GitHub token with `public_repo`).
3. Once merged, users can run `winget install FulecoRafa.Fuchico`.

## Later releases

Add the `WINGET_TOKEN` repository secret (a GitHub PAT with `public_repo`) and
the `winget` job in `.github/workflows/release.yml` will submit the update
automatically via `wingetcreate update`.
