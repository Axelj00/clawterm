import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression guard for #557. tab.ts builds the split container class as
 * `split-container split-${direction}`, so the per-direction modifiers
 * `.split-horizontal { flex-direction: row }` and `.split-vertical
 * { flex-direction: column }` MUST exist in style.css — otherwise vertical
 * splits collapse to the default `flex-direction: row` and render
 * side-by-side. These rules have been deleted twice (#472, #518) by cleanup
 * passes that assumed they were dead. They're not — guard them here.
 */
describe("split direction CSS (regression #557)", () => {
  const css = readFileSync(resolve(__dirname, "../src/style.css"), "utf8");

  it("declares .split-horizontal with flex-direction: row", () => {
    expect(css).toMatch(/\.split-horizontal\s*\{[^}]*flex-direction:\s*row/);
  });

  it("declares .split-vertical with flex-direction: column", () => {
    expect(css).toMatch(/\.split-vertical\s*\{[^}]*flex-direction:\s*column/);
  });
});
