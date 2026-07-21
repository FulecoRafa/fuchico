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
  cargoHash = "sha256-lkZid+Y5KbxcJU8NPAwuckQY/U3QRdOopWs4SuztxOg=";

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    pnpm = pnpm_10;
    fetcherVersion = 3;
    hash = "sha256-kbCV7/MZxBC3ndp7PJIRMGMPlvr5JpACXfwrJrUHv90=";
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
    mainProgram = "fuchico";
    inherit (cargo-tauri.hook.meta) platforms;
  };
})
