#!/bin/bash
# Add common toolchain paths if not already available
command -v cargo >/dev/null 2>&1 || {
  [ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
  [ -d "$HOME/.rustup/toolchains" ] && export PATH="$(echo $HOME/.rustup/toolchains/*/bin | tr ' ' ':'):$PATH"
}
cd "$(dirname "$0")"
npx tauri dev
