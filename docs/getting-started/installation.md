# Installation and updates

ClawTerm is **macOS-only** — universal builds for Apple Silicon and Intel.

## Install

One-liner installer (downloads the latest DMG, verifies the SHA-256 checksum against the release's `checksums-universal-apple-darwin.txt`, copies `ClawTerm.app` into `/Applications`, and clears the quarantine flag):

```bash
curl -fsSL https://raw.githubusercontent.com/clawterm/clawterm/main/install.sh | bash
```

If you'd rather install by hand, download `ClawTerm_<version>_universal.dmg` from the [latest release](https://github.com/clawterm/clawterm/releases/latest) — a single universal build that runs on both Apple Silicon and Intel Macs.

Mount the DMG and drag `ClawTerm.app` into `/Applications`.

> **Gatekeeper note:** ClawTerm is not yet Apple-notarized. If macOS refuses to launch it, clear the quarantine flag once:
>
> ```bash
> xattr -cr /Applications/ClawTerm.app
> ```
>
> Tracking issue: [#378](https://github.com/clawterm/clawterm/issues/378).

### Building from source

```bash
git clone https://github.com/clawterm/clawterm.git
cd clawterm
npm install
npm run tauri build
```

Requirements:

- [Rust](https://rustup.rs/)
- [Node.js](https://nodejs.org/) 18+
- Tauri system dependencies — see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)

The built binary lands in `src-tauri/target/release/`.

## Verifying checksums manually

The release ships a single checksums file, `checksums-universal-apple-darwin.txt`. Verify your DMG against it:

```bash
shasum -a 256 -c checksums-universal-apple-darwin.txt --ignore-missing
```

The one-liner installer does this automatically and aborts on mismatch.

## Updates

ClawTerm checks for updates automatically once an hour by default. When a new version is available, a dialog appears with the release notes and an **Install** button.

Update behaviour is controlled by the `updates` section in `config.json` — see [configuration.md → updates](../reference/configuration.md#updates) for the full schema. Summary:

- `updates.autoCheck` — turn auto-checking on or off
- `updates.checkIntervalMs` — how often to poll (5 minutes to 24 hours)
- `updates.mode` — `"manual"`, `"download"` (default — stage in background, apply on next quit), or `"auto"` (install + restart immediately)

You can also trigger a manual update check from the settings page.

### Re-running the install script

Running the same one-liner again performs an in-place upgrade:

```bash
curl -fsSL https://raw.githubusercontent.com/clawterm/clawterm/main/install.sh | bash
```

If the installed version already matches the latest release, the script exits without doing any work.

## Uninstalling

```bash
curl -fsSL https://raw.githubusercontent.com/clawterm/clawterm/main/install.sh | bash -s -- --uninstall
```

This removes `/Applications/ClawTerm.app` and prompts before deleting `~/.config/clawterm` (so your config survives unless you say otherwise).

**Manual cleanup paths:**

| Item | Location |
| --- | --- |
| App bundle | `/Applications/ClawTerm.app` |
| Config | `~/.config/clawterm/` |
