# Homebrew cask for Fuchico (issue #34). Lives in the tap repository
# FulecoRafa/homebrew-tap as Casks/fuchico.rb; scripts/release.mjs rewrites
# `version` and the sha256 values on every release.
#
#   brew tap FulecoRafa/tap
#   brew install --cask fuchico
cask "fuchico" do
  version "0.1.0"
  sha256 arm:   "713224a0477113db0c1f8b2aae52cb96ce50b2eda4080d39584adb3da2306c44",
         intel: "ce59d090beda03848c64bc5858f850c7445c7db51c734e5eee5b0fedfb262a14"

  arch arm: "aarch64", intel: "x64"

  url "https://github.com/FulecoRafa/fuchico/releases/download/v#{version}/Fuchico_#{version}_#{arch}.dmg"
  name "Fuchico"
  desc "Notes editor with Helix modal editing"
  homepage "https://github.com/FulecoRafa/fuchico"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Fuchico.app"

  # The build is not notarized yet; clear the quarantine flag so Gatekeeper
  # does not refuse to open it.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Fuchico.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/dev.fuleco.fuchico",
    "~/Library/Caches/dev.fuleco.fuchico",
    "~/Library/WebKit/dev.fuleco.fuchico",
  ]
end
