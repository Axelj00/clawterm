#!/usr/bin/env bash
set -euo pipefail

# Clawterm installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Axelj00/clawterm/main/install.sh | bash

REPO="Axelj00/clawterm"
APP_NAME="Clawterm"

info() { printf "\033[1;34m==>\033[0m %s\n" "$1"; }
error() { printf "\033[1;31merror:\033[0m %s\n" "$1" >&2; exit 1; }

OS="$(uname -s)"
ARCH="$(uname -m)"

# Fetch latest release tag
info "Fetching latest release..."
TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | head -1 | cut -d'"' -f4)
[ -z "$TAG" ] && error "Could not determine latest release"
info "Latest release: ${TAG}"

case "$OS" in
  Darwin)
    # macOS — download and install .dmg
    ASSET="${APP_NAME}_${TAG#v}_universal.dmg"
    URL="https://github.com/${REPO}/releases/download/${TAG}/${ASSET}"

    TMPDIR_DL="$(mktemp -d)"
    trap 'rm -rf "$TMPDIR_DL"' EXIT

    info "Downloading ${ASSET}..."
    curl -fSL -o "${TMPDIR_DL}/${ASSET}" "$URL" || error "Download failed. Check that the release exists at:\n  ${URL}"

    info "Mounting disk image..."
    MOUNT_DIR=$(hdiutil attach "${TMPDIR_DL}/${ASSET}" -nobrowse -noautoopen | tail -1 | awk '{print $NF}')

    if [ -d "/Applications/${APP_NAME}.app" ]; then
      info "Removing existing installation..."
      rm -rf "/Applications/${APP_NAME}.app"
    fi

    info "Installing to /Applications..."
    cp -R "${MOUNT_DIR}/${APP_NAME}.app" /Applications/

    hdiutil detach "$MOUNT_DIR" -quiet

    info "Installed! You can open ${APP_NAME} from /Applications."
    info ""
    info "Note: On first launch, macOS may block the app."
    info "If that happens: right-click the app → Open → Open"
    info "Or: System Settings → Privacy & Security → Open Anyway"
    ;;

  Linux)
    case "$ARCH" in
      x86_64|amd64) ARCH_SUFFIX="amd64" ;;
      aarch64|arm64) ARCH_SUFFIX="arm64" ;;
      *) error "Unsupported architecture: $ARCH" ;;
    esac

    # Try .deb first, fall back to .AppImage
    DEB_ASSET="${APP_NAME}_${TAG#v}_${ARCH_SUFFIX}.deb"
    DEB_URL="https://github.com/${REPO}/releases/download/${TAG}/${DEB_ASSET}"

    TMPDIR_DL="$(mktemp -d)"
    trap 'rm -rf "$TMPDIR_DL"' EXIT

    if curl -fSL -o "${TMPDIR_DL}/${DEB_ASSET}" "$DEB_URL" 2>/dev/null; then
      info "Installing .deb package..."
      if command -v dpkg &>/dev/null; then
        sudo dpkg -i "${TMPDIR_DL}/${DEB_ASSET}" || sudo apt-get install -f -y
      else
        error "dpkg not found. Download the .deb manually from:\n  ${DEB_URL}"
      fi
    else
      APPIMAGE_ASSET="${APP_NAME}_${TAG#v}_${ARCH_SUFFIX}.AppImage"
      APPIMAGE_URL="https://github.com/${REPO}/releases/download/${TAG}/${APPIMAGE_ASSET}"

      info "Downloading AppImage..."
      curl -fSL -o "${TMPDIR_DL}/${APPIMAGE_ASSET}" "$APPIMAGE_URL" || error "Download failed"

      INSTALL_DIR="${HOME}/.local/bin"
      mkdir -p "$INSTALL_DIR"
      mv "${TMPDIR_DL}/${APPIMAGE_ASSET}" "${INSTALL_DIR}/clawterm"
      chmod +x "${INSTALL_DIR}/clawterm"
      info "Installed to ${INSTALL_DIR}/clawterm"
      info "Make sure ${INSTALL_DIR} is in your PATH."
    fi
    ;;

  MINGW*|MSYS*|CYGWIN*)
    error "On Windows, download the installer from:\n  https://github.com/${REPO}/releases/latest"
    ;;

  *)
    error "Unsupported OS: $OS"
    ;;
esac
