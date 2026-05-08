import { describe, it, expect, vi } from "vitest";
import { IdleTracker } from "../src/idle-tracker";

describe("IdleTracker", () => {
  it("starts non-idle", () => {
    const t = new IdleTracker();
    expect(t.isIdle()).toBe(false);
    expect(t.streakCount).toBe(0);
  });

  it("transitions to idle after THRESHOLD consecutive idle ticks", () => {
    const t = new IdleTracker();
    for (let i = 0; i < IdleTracker.THRESHOLD - 1; i++) t.noteTick(false);
    expect(t.isIdle()).toBe(false);
    t.noteTick(false);
    expect(t.isIdle()).toBe(true);
  });

  it("any active tick resets the streak", () => {
    const t = new IdleTracker();
    for (let i = 0; i < 5; i++) t.noteTick(false);
    expect(t.streakCount).toBe(5);
    t.noteTick(true);
    expect(t.streakCount).toBe(0);
    expect(t.isIdle()).toBe(false);
  });

  it("wake() fires the handler only when transitioning from idle", () => {
    const t = new IdleTracker();
    const handler = vi.fn();
    t.setWakeHandler(handler);

    t.wake();
    expect(handler).not.toHaveBeenCalled();

    for (let i = 0; i < IdleTracker.THRESHOLD; i++) t.noteTick(false);
    expect(t.isIdle()).toBe(true);

    t.wake();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(t.isIdle()).toBe(false);
    expect(t.streakCount).toBe(0);

    t.wake();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("intervalFor returns idle interval once idle", () => {
    const t = new IdleTracker();
    expect(t.intervalFor(1000)).toBe(1000);
    for (let i = 0; i < IdleTracker.THRESHOLD; i++) t.noteTick(false);
    expect(t.intervalFor(1000)).toBe(IdleTracker.IDLE_INTERVAL_MS);
  });

  it("reset() clears the streak", () => {
    const t = new IdleTracker();
    for (let i = 0; i < IdleTracker.THRESHOLD; i++) t.noteTick(false);
    expect(t.isIdle()).toBe(true);
    t.reset();
    expect(t.isIdle()).toBe(false);
    expect(t.streakCount).toBe(0);
  });
});
