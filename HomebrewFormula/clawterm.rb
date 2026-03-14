cask "clawterm" do
  version :latest
  sha256 :no_check

  on_arm do
    url "https://github.com/clawterm/clawterm/releases/latest/download/Clawterm_aarch64.dmg"
  end
  on_intel do
    url "https://github.com/clawterm/clawterm/releases/latest/download/Clawterm_x64.dmg"
  end

  name "Clawterm"
  desc "Terminal emulator for AI agents"
  homepage "https://clawterm.github.io/clawterm"

  app "Clawterm.app"

  zap trash: [
    "~/.config/clawterm",
  ]
end
