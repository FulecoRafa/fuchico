# Homebrew cask for Fuchico (issue #34). Lives in the tap repository
# FulecoRafa/homebrew-tap as Casks/fuchico.rb; the Release workflow rewrites
# `version` and the sha256 values after every tagged build.
#
#   brew tap FulecoRafa/tap
#   brew install --cask fuchico
cask "fuchico" do
  version "0.1.0"
  sha256 arm:   "REPLACED_BY_RELEASE_WORKFLOW",
         intel: "REPLACED_BY_RELEASE_WORKFLOW"

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
