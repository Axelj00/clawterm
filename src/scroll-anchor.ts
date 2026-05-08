import type { Terminal } from "@xterm/xterm";
import { logger } from "./logger";

/** Encapsulates Pane's scroll-preservation invariants (#476).
 *
 *  Pre-extraction, eight loosely-coupled fields on Pane coordinated scroll
 *  behavior across hide/show, write callbacks, and fitAddon reflows — each
 *  added in response to a real regression (#184/#305/#419/#432/#437). Behavior
 *  is byte-identical; the change is encapsulation only.
 *
 *  The one non-obvious invariant: `userScrolled` is *persistent user intent*
 *  and survives auto-follow snap-back; `currentDistance()` returning the
 *  locked anchor (not the live distance) during a hide/show cycle is what
 *  keeps mid-flight buffer mutations from moving the restore target. */
export class ScrollAnchor {
  private fitting = false;
  private locked = false;
  private lockedDistance: number | null = null;
  private lockedBufferLen: number | null = null;
  private trimmedDuringHide_ = false;
  private userScrolled = false;
  private flushDistance: number | null = null;

  constructor(
    private readonly terminal: Terminal,
    private readonly paneId: string,
  ) {}

  get isLocked(): boolean {
    return this.locked;
  }
  get isFitting(): boolean {
    return this.fitting;
  }
  get isUserScrolledUp(): boolean {
    return this.userScrolled;
  }

  setFitting(value: boolean): void {
    this.fitting = value;
  }
  setUserScrolledUp(value: boolean): void {
    this.userScrolled = value;
  }

  /** Mark the next observed buffer-length change as the known #305 trim, so
   *  the lock-window tripwire suppresses its warning for that one transition. */
  noteTrimmedDuringHide(): void {
    this.trimmedDuringHide_ = true;
  }

  /** Distance-from-bottom in lines. While locked, returns the lock-time anchor
   *  so concurrent buffer mutations can't move the target. */
  currentDistance(): number {
    if (this.locked && this.lockedDistance !== null) return this.lockedDistance;
    const buf = this.terminal.buffer.active;
    return Math.max(0, buf.baseY - buf.viewportY);
  }

  /** Lazy snapshot held across chunks of a multi-frame flush. */
  ensureFlushAnchor(): number {
    if (this.flushDistance === null) this.flushDistance = this.currentDistance();
    return this.flushDistance;
  }

  clearFlushAnchor(): void {
    this.flushDistance = null;
  }

  /** Scroll to a saved distance-from-bottom. Callers manage the fitting flag
   *  themselves — every site already wraps a wider critical section.
   *  See restoreSuppressed() for the one-call wrap-and-restore. */
  restore(distance: number): void {
    if (distance === 0 && !this.userScrolled) {
      this.terminal.scrollToBottom();
    } else {
      const max = this.terminal.buffer.active.baseY;
      const target = Math.max(0, max - distance);
      this.terminal.scrollToLine(target);
    }
  }

  /** restore() wrapped in setFitting(true)/finally setFitting(false). Use this
   *  when the caller doesn't already own a wider fitting window. */
  restoreSuppressed(distance: number): void {
    this.fitting = true;
    try {
      this.restore(distance);
    } finally {
      this.fitting = false;
    }
  }

  /** Acquire a scroll lock — captures distance + buffer length so unlock()
   *  can restore exactly and detect unexpected buffer mutations. (#184) */
  lock(): void {
    this.locked = true;
    const buf = this.terminal.buffer.active;
    this.lockedDistance = Math.max(0, buf.baseY - buf.viewportY);
    this.lockedBufferLen = buf.length;
  }

  /** Release the lock and perform the single authoritative scroll restoration.
   *  Trips a warning if buffer length changed outside the known #305 trim. */
  unlock(): void {
    if (!this.locked) return;
    this.locked = false;
    const buf = this.terminal.buffer.active;
    if (!this.trimmedDuringHide_ && this.lockedBufferLen !== null && buf.length !== this.lockedBufferLen) {
      logger.warn(
        `[pane ${this.paneId}] scroll-lock invariant: buffer length changed during lock ` +
          `(was ${this.lockedBufferLen}, now ${buf.length}). ` +
          `Distance-from-bottom restoration will compensate, but this indicates ` +
          `a code path mutating the buffer during hide/show — investigate.`,
      );
    }
    this.trimmedDuringHide_ = false;
    if (this.lockedDistance !== null) {
      this.restoreSuppressed(this.lockedDistance);
    }
    this.lockedDistance = null;
    this.lockedBufferLen = null;
  }

  /** Release the lock without restoring (user wheel-up superseded). (#437) */
  abandon(): void {
    this.locked = false;
    this.lockedDistance = null;
    this.lockedBufferLen = null;
    this.trimmedDuringHide_ = false;
  }
}
