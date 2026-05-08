/**
 * Compact wcwidth — terminal cell width for a Unicode codepoint.
 * Returns 0 (combining/zero-width), 1 (narrow), or 2 (wide / fullwidth).
 *
 * xterm.js's IUnicodeVersionProvider has its own wcwidth, but the public
 * API doesn't expose it — Terminal.unicode only lets you register or query
 * the active version name. So we ship a minimal local implementation that
 * matches the cases that actually shift cursor columns: ASCII, common
 * combining marks, and East Asian Wide / Fullwidth ranges (CJK + emoji).
 *
 * Ranges sourced from Unicode 11 EastAsianWidth.txt (W and F categories)
 * and the General_Category=Mn / Me / Cf zero-width class. Not exhaustive
 * — outliers fall through to width 1, which matches the previous (buggy)
 * behavior, so we strictly improve over the JS-index-as-cell-index path.
 */
export function cellWidth(cp: number): 0 | 1 | 2 {
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (isZeroWidth(cp)) return 0;
  if (isWide(cp)) return 2;
  return 1;
}

/** Walk a JS string and return the cell column corresponding to `jsIndex`
 *  (a UTF-16 code-unit index). Accounts for surrogate pairs (1 codepoint =
 *  2 code units), wide chars (2 cells), and combining marks (0 cells). */
export function jsIndexToCellColumn(text: string, jsIndex: number): number {
  let col = 0;
  let i = 0;
  while (i < jsIndex) {
    const cp = text.codePointAt(i)!;
    col += cellWidth(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return col;
}

/** Total cell width of a string. */
export function stringCellWidth(text: string): number {
  let col = 0;
  let i = 0;
  while (i < text.length) {
    const cp = text.codePointAt(i)!;
    col += cellWidth(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return col;
}

function isZeroWidth(cp: number): boolean {
  return (
    (cp >= 0x0300 && cp <= 0x036f) || // Combining Diacritical Marks
    (cp >= 0x0483 && cp <= 0x0489) ||
    (cp >= 0x0591 && cp <= 0x05bd) ||
    cp === 0x05bf ||
    (cp >= 0x05c1 && cp <= 0x05c2) ||
    (cp >= 0x05c4 && cp <= 0x05c5) ||
    cp === 0x05c7 ||
    (cp >= 0x0610 && cp <= 0x061a) ||
    (cp >= 0x064b && cp <= 0x065f) ||
    cp === 0x0670 ||
    (cp >= 0x06d6 && cp <= 0x06dc) ||
    (cp >= 0x06df && cp <= 0x06e4) ||
    (cp >= 0x06e7 && cp <= 0x06e8) ||
    (cp >= 0x06ea && cp <= 0x06ed) ||
    cp === 0x070f || // SAMARITAN MARK
    (cp >= 0x0711 && cp <= 0x0711) ||
    (cp >= 0x0730 && cp <= 0x074a) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x200b && cp <= 0x200f) || // Zero-width spaces, BiDi marks
    (cp >= 0x2028 && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x2064) ||
    (cp >= 0x2066 && cp <= 0x206f) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe00 && cp <= 0xfe0f) || // Variation selectors
    cp === 0xfeff ||
    (cp >= 0xfff9 && cp <= 0xfffb) ||
    (cp >= 0xe0100 && cp <= 0xe01ef) // Variation Selectors Supplement
  );
}

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2329 && cp <= 0x232a) ||
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK Radicals through CJK Symbols
    (cp >= 0x3041 && cp <= 0x33ff) || // Hiragana / Katakana / CJK Compatibility
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0xa000 && cp <= 0xa4cf) || // Yi Syllables
    (cp >= 0xa490 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul Syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth Forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x16fe0 && cp <= 0x16fff) ||
    (cp >= 0x17000 && cp <= 0x18fff) || // Tangut
    (cp >= 0x1b000 && cp <= 0x1b16f) ||
    (cp >= 0x1f200 && cp <= 0x1f64f) || // Enclosed CJK + Misc Symbols + Emoticons
    (cp >= 0x1f680 && cp <= 0x1f6ff) || // Transport & Map Symbols
    (cp >= 0x1f700 && cp <= 0x1f77f) ||
    (cp >= 0x1f780 && cp <= 0x1f7ff) ||
    (cp >= 0x1f800 && cp <= 0x1f8ff) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) || // Supplemental Symbols and Pictographs
    (cp >= 0x1fa00 && cp <= 0x1fa6f) ||
    (cp >= 0x1fa70 && cp <= 0x1faff) || // Symbols and Pictographs Extended-A
    (cp >= 0x20000 && cp <= 0x2fffd) || // CJK Extension B–F
    (cp >= 0x30000 && cp <= 0x3fffd) // CJK Extension G
  );
}
