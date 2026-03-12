cask "clawterm" do
  version :latest
  sha256 :no_check

  url "https://github.com/Axelj00/clawterm/releases/latest/download/Clawterm_universal.dmg"
  name "Clawterm"
  desc "Terminal emulator for AI agents"
  homepage "https://github.com/Axelj00/clawterm"

  app "Clawterm.app"

  zap trash: [
    "~/.config/clawterm",
  ]
end
