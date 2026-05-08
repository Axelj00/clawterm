/**
 * Priority-aware async semaphore for throttling poll_pane_info IPC fan-out.
 *
 * Each poll cycle the central poll loop dispatches the active tab's
 * pollProcessInfo() plus a bg slice; without throttling every pane within
 * those tabs would invoke poll_pane_info concurrently — a wave of IPC that
 * lands on the Tauri command pool simultaneously, with each invocation
 * potentially triggering a synchronous git-status subprocess (#457).
 *
 * The semaphore caps concurrent in-flight IPCs to MAX_CONCURRENT.  A
 * second priority queue lets active-tab callers jump ahead of any pending
 * bg-slice waiters, so user-facing latency on the focused tab isn't gated
 * by background work. (#459)
 */

const MAX_CONCURRENT = 3;

class PollSemaphore {
  private inFlight = 0;
  private highQ: Array<() => void> = [];
  private lowQ: Array<() => void> = [];

  async acquire(priority: "high" | "low"): Promise<void> {
    if (this.inFlight < MAX_CONCURRENT) {
      this.inFlight++;
      return;
    }
    return new Promise((resolve) => {
      const grant = () => {
        this.inFlight++;
        resolve();
      };
      if (priority === "high") this.highQ.push(grant);
      else this.lowQ.push(grant);
    });
  }

  release(): void {
    this.inFlight--;
    const next = this.highQ.shift() ?? this.lowQ.shift();
    if (next) next();
  }

  async withSlot<T>(priority: "high" | "low", fn: () => Promise<T>): Promise<T> {
    await this.acquire(priority);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export const pollSemaphore = new PollSemaphore();
