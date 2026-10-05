{
  lib,
  stdenv,
  rustPlatform,
  fetchPnpmDeps,
  cargo-tauri,
  nodejs,
  pnpm_10,
  pnpmConfigHook,
  pkg-config,
  makeBinaryWrapper,
  wrapGAppsHook4,
  glib-networking,
  webkitgtk_4_1,
  cacert,
  fontconfig,
  freetype,
}:

rustPlatform.buildRustPackage (finalAttrs: {
  pname = "fuchico";
  version = "0.1.0";

  src = lib.cleanSource ./.;

  cargoRoot = "src-tauri";
  buildAndTestSubdir = finalAttrs.cargoRoot;
  cargoHash = "sha256-k+3ZHmQUQ7rAQyiDsO1rVotgzWtu2qFq5Hl8wjh38H0=";

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    pnpm = pnpm_10;
    fetcherVersion = 3;
    # pnpm only fetches the native optional dependencies for the current
    # platform, so the hash differs per system.
    hash =
      {
        x86_64-linux = "sha256-giBP1lyTxGpqI/Ja5bvcSGMPE3q9uYo26xR1/NX/zgI=";
      }
      .${stdenv.hostPlatform.system} or "sha256-kbCV7/MZxBC3ndp7PJIRMGMPlvr5JpACXfwrJrUHv90=";
  };

  nativeBuildInputs = [
    cargo-tauri.hook
    nodejs
    pnpm_10
    pnpmConfigHook
    pkg-config
  ]
  ++ lib.optionals stdenv.hostPlatform.isLinux [ wrapGAppsHook4 ];

  buildInputs = lib.optionals stdenv.hostPlatform.isLinux [
    cacert
    fontconfig
    freetype
    glib-networking
    webkitgtk_4_1
  ];

  meta = {
    description = "Standalone notes editor with Helix modal editing";
    homepage = "https://github.com/FulecoRafa/fuchico";
    license = lib.licenses.mit;
    mainProgram = "fuchico";
    inherit (cargo-tauri.hook.meta) platforms;
  };
})
