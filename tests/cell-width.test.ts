import { describe, it, expect } from "vitest";
import { cellWidth, jsIndexToCellColumn, stringCellWidth } from "../src/cell-width";

describe("cellWidth (#491)", () => {
  it("returns 1 for ASCII", () => {
    expect(cellWidth(0x20)).toBe(1); // space
    expect(cellWidth(0x41)).toBe(1); // 'A'
    expect(cellWidth(0x7e)).toBe(1); // '~'
  });

  it("returns 0 for control characters", () => {
    expect(cellWidth(0x00)).toBe(0);
    expect(cellWidth(0x1f)).toBe(0);
    expect(cellWidth(0x7f)).toBe(0); // DEL
  });

  it("returns 0 for combining marks", () => {
    expect(cellWidth(0x0301)).toBe(0); // Combining acute accent
    expect(cellWidth(0x036f)).toBe(0);
  });

  it("returns 0 for variation selectors and zero-width spaces", () => {
    expect(cellWidth(0x200b)).toBe(0); // Zero-width space
    expect(cellWidth(0xfe0f)).toBe(0); // Variation Selector-16
  });

  it("returns 2 for CJK ideographs", () => {
    expect(cellWidth(0x4e2d)).toBe(2); // 中
    expect(cellWidth(0x3042)).toBe(2); // あ
    expect(cellWidth(0xac00)).toBe(2); // 가
  });

  it("returns 2 for common emoji", () => {
    expect(cellWidth(0x1f525)).toBe(2); // 🔥
    expect(cellWidth(0x1f680)).toBe(2); // 🚀
    expect(cellWidth(0x1f600)).toBe(2); // 😀
  });
});

describe("jsIndexToCellColumn (#491)", () => {
  it("ASCII: cell column equals JS index", () => {
    expect(jsIndexToCellColumn("hello world", 0)).toBe(0);
    expect(jsIndexToCellColumn("hello world", 5)).toBe(5);
    expect(jsIndexToCellColumn("hello world", 11)).toBe(11);
  });

  it("emoji prefix: each surrogate pair is 1 codepoint = 2 cells", () => {
    // "🔥 src/main.rs:42" — 🔥 is 2 code units (UTF-16 surrogate pair) and
    // 2 cells; the space adds 1 cell. JS index 3 = "s"; cell column 3.
    const text = "🔥 src/main.rs:42";
    expect(jsIndexToCellColumn(text, 3)).toBe(3);
  });

  it("CJK prefix: 1 code unit but 2 cells per char", () => {
    // "中文 path/file" — '中文' = 2 code units, 4 cells; ' ' = 1 cell
    const text = "中文 path/file";
    expect(jsIndexToCellColumn(text, 3)).toBe(5); // start of 'p'
  });

  it("combining marks: 0 cells", () => {
    // "é" as e + combining acute (2 code units, 1 cell)
    const text = "ésrc";
    expect(jsIndexToCellColumn(text, 2)).toBe(1); // 's' is at cell 1
  });
});

describe("stringCellWidth (#491)", () => {
  it("counts cells, not code units", () => {
    expect(stringCellWidth("hello")).toBe(5);
    expect(stringCellWidth("中")).toBe(2);
    expect(stringCellWidth("🔥")).toBe(2);
    expect(stringCellWidth("é")).toBe(1);
  });
});
