# Releasing

Guide for maintainers on cutting a new Clawterm release.

## Version Numbering

We use [semver](https://semver.org/): patch for bug fixes, minor for features, major for breaking changes.

## Checklist

- [ ] All CI checks pass on `main`
- [ ] Version bumped in all three files:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
- [ ] Lock files updated: `npm install` and `cargo check` in `src-tauri/`
- [ ] `CHANGELOG.md` updated:
  - Move items from `[Unreleased]` to new version section with today's date
  - Add compare link at bottom
  - Update `[Unreleased]` link to compare from new version
- [ ] Local checks pass:
  ```bash
  npm run lint && npm run format:check && npm run test && npx tsc --noEmit
  ```
- [ ] Commit: `git commit -m "Bump version to X.Y.Z"`
- [ ] Tag and push:
  ```bash
  git tag vX.Y.Z
  git push origin main --tags
  ```
- [ ] GitHub Actions release workflow completes
- [ ] DMG downloads and installs correctly
- [ ] Auto-updater detects new version from a previous install

## Release Notes

Each GitHub Release should include:
- Summary of what changed (1-2 sentences)
- Link to CHANGELOG: `See [CHANGELOG](CHANGELOG.md#xyz---yyyy-mm-dd) for details.`

## Code Signing

The release workflow signs and notarizes builds when these repository secrets are set:

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` file |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Name (TEAM_ID)` |
| `APPLE_ID` | Apple ID email |
| `APPLE_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-character team identifier |

To export your certificate:
```bash
# Export from Keychain Access as .p12, then:
base64 -i Certificates.p12 | pbcopy
```

Without these secrets, builds still work but are unsigned.
