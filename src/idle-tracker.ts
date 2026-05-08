/** Centralized idle-mode state for the central poll loop (#480).
 *
 *  Before this module, idle-mode bookkeeping (streak counter, threshold,
 *  idle-cadence interval) lived directly on TerminalManager and was mutated
 *  from several sites. The semantics are unchanged; the cadence math is
 *  just no longer scattered across the manager.
 *
 *  Wake-up sources call `wake()`. The tick loop calls `noteTick(anyActive)`
 *  after the per-tab poll fan-out and reads `intervalFor(fgInterval)` to
 *  decide the next-tick delay. */
export class IdleTracker {
  private streak = 0;
  private onWake: (() => void) | null = null;

  /** Number of consecutive idle ticks required before dropping to IDLE_INTERVAL_MS. */
  static readonly THRESHOLD = 10;
  /** Cadence used while idle. Held intentionally above prompt-response time
   *  so a wake() takes effect via the immediate-reschedule path, not the timer. */
  static readonly IDLE_INTERVAL_MS = 10_000;

  /** Register a callback invoked when wake() actually transitions out of idle.
   *  The manager typically reschedules the next tick to fire immediately. */
  setWakeHandler(fn: () => void): void {
    this.onWake = fn;
  }

  /** External activity arrived (PTY data, OSC, terminal-title, tab switch,
   *  focus regain). Cheap when not idle — early-returns. */
  wake(): void {
    if (this.streak === 0) return;
    this.streak = 0;
    this.onWake?.();
  }

  /** Called once per tick after the manager scans pane state. */
  noteTick(anyActive: boolean): void {
    if (anyActive) this.streak = 0;
    else this.streak++;
  }

  /** True once the idle streak has reached THRESHOLD ticks. */
  isIdle(): boolean {
    return this.streak >= IdleTracker.THRESHOLD;
  }

  /** Reset the streak — used when the manager restarts the poll loop on
   *  significant config changes. */
  reset(): void {
    this.streak = 0;
  }

  /** Pick the next scheduling delay based on idle state. */
  intervalFor(fgInterval: number): number {
    return this.isIdle() ? IdleTracker.IDLE_INTERVAL_MS : fgInterval;
  }

  /** Exposed for diagnostics / log lines. */
  get streakCount(): number {
    return this.streak;
  }
}
