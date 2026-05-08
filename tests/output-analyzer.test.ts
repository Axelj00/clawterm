import { describe, it, expect, beforeEach } from "vitest";
import { OutputAnalyzer } from "../src/output-analyzer";
import type { OutputMatcher } from "../src/matchers";

function toBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("OutputAnalyzer", () => {
  let analyzer: OutputAnalyzer;
  let events: Array<{ type: string; detail: string }>;

  beforeEach(() => {
    analyzer = new OutputAnalyzer();
    events = [];
    analyzer.onEvent((e) => events.push({ type: e.type, detail: e.detail }));
  });

  it("detects server-started pattern", () => {
    analyzer.feed(toBytes("Server listening on http://localhost:3000\n"));
    analyzer.flush();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("server-started");
  });

  it("detects error patterns", () => {
    analyzer.feed(toBytes("FATAL: something went wrong\n"));
    analyzer.flush();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("error");
  });

  it("respects cooldown", () => {
    analyzer.feed(toBytes("FATAL: something\n"));
    analyzer.flush();
    expect(events.length).toBe(1);
    // Feed same pattern immediately - should be suppressed by cooldown
    analyzer.feed(toBytes("FATAL: again\n"));
    analyzer.flush();
    expect(events.length).toBe(1);
  });

  it("strips ANSI codes before matching", () => {
    analyzer.feed(toBytes("\x1b[32mServer listening on http://localhost:8080\x1b[0m\n"));
    analyzer.flush();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("server-started");
  });

  it("detects patterns across chunk boundaries", () => {
    analyzer.feed(toBytes("Server listening on http://local"));
    analyzer.flush();
    expect(events.length).toBe(0);
    analyzer.feed(toBytes("host:3000\n"));
    analyzer.flush();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("server-started");
  });

  it("dispose stops emitting events", () => {
    analyzer.dispose();
    analyzer.feed(toBytes("FATAL: post-dispose\n"));
    analyzer.flush();
    expect(events.length).toBe(0);
  });
});

describe("OutputAnalyzer per-instance decoder (#489)", () => {
  // Match any single non-ASCII codepoint and surface it as `detail`.
  const captureNonAscii: OutputMatcher = {
    id: "capture-non-ascii",
    pattern: /[^\x00-\x7f]/u,
    type: "error",
    cooldownMs: 0,
  };

  function captureFor(analyzer: OutputAnalyzer): string[] {
    const out: string[] = [];
    analyzer.onEvent((e) => out.push(e.detail));
    return out;
  }

  it("does not interleave partial UTF-8 between instances", () => {
    const a = new OutputAnalyzer([captureNonAscii]);
    const b = new OutputAnalyzer([captureNonAscii]);
    const aDetails = captureFor(a);
    const bDetails = captureFor(b);

    // 🔥 = F0 9F 94 A5, 🚀 = F0 9F 9A 80 — split each across feeds and
    // interleave so a shared decoder would scramble both.
    a.feed(new Uint8Array([0xf0, 0x9f]));
    b.feed(new Uint8Array([0xf0, 0x9f]));
    a.feed(new Uint8Array([0x94, 0xa5]));
    b.feed(new Uint8Array([0x9a, 0x80]));
    a.flush();
    b.flush();

    expect(aDetails).toEqual(["🔥"]);
    expect(bDetails).toEqual(["🚀"]);
  });
});
