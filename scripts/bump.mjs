#!/usr/bin/env node
/**
 * Bump the version across all project files in one go.
 *
 * Usage:
 *   node scripts/bump.mjs patch   # 0.3.1 → 0.3.2
 *   node scripts/bump.mjs minor   # 0.3.1 → 0.4.0
 *   node scripts/bump.mjs major   # 0.3.1 → 1.0.0
 *   node scripts/bump.mjs 1.2.3   # set explicit version
 */

import { readFileSync, writeFileSync } from "fs";

const FILES = [
  { path: "package.json", pattern: /"version":\s*"[^"]+"/, template: (v) => `"version": "${v}"` },
  { path: "src-tauri/Cargo.toml", pattern: /^version\s*=\s*"[^"]+"/m, template: (v) => `version = "${v}"` },
  { path: "src-tauri/tauri.conf.json", pattern: /"version":\s*"[^"]+"/, template: (v) => `"version": "${v}"` },
];

function current() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  return pkg.version;
}

function increment(version, part) {
  const [major, minor, patch] = version.split(".").map(Number);
  switch (part) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Unknown increment: ${part}`);
  }
}

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node scripts/bump.mjs <patch|minor|major|X.Y.Z>");
  process.exit(1);
}

const old = current();
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : increment(old, arg);

console.log(`${old} → ${next}`);

for (const file of FILES) {
  const content = readFileSync(file.path, "utf8");
  const updated = content.replace(file.pattern, file.template(next));
  if (updated === content) {
    console.error(`  ⚠ No match in ${file.path}`);
  } else {
    writeFileSync(file.path, updated);
    console.log(`  ✓ ${file.path}`);
  }
}

console.log(`\nDone. To finish the release:

  git add -A && git commit -m "Bump version to ${next}"

  # Verify checks pass BEFORE tagging (CI runs these on the tag):
  npm run lint && npm run format:check && npm run test && npx tsc --noEmit

  # Only tag and push after checks pass:
  git tag v${next}
  git push origin main --tags`);
