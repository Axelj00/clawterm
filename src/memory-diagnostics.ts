import { invoke } from "@tauri-apps/api/core";
import { trapFocus } from "./utils";
import { showToast } from "./toast";
import { logger } from "./logger";
import { computeFolderTitle, formatResidentSize, getBranchColorCacheSize } from "./tab-state";
import type { Tab } from "./tab";
import type { NotificationTray } from "./notification-tray";

interface RustDiagnostics {
  rssBytes: number;
  statuslineFiles: number;
}

export interface MemoryDiagnosticsContext {
  tabs: Map<string, Tab>;
  notificationTray: NotificationTray;
  startedAt: number;
  webglMax: number;
}

interface PaneRow {
  tabTitle: string;
  paneId: string;
  scrollbackLines: number;
  imageMb: number;
  pendingBytes: number;
  residentBytes: number | null;
  webgl: boolean;
}

interface ReportData {
  generatedAt: Date;
  uptimeMs: number;
  tabCount: number;
  paneCount: number;
  webglActive: number;
  webglMax: number;
  panes: PaneRow[];
  imageMbTotal: number;
  scrollbackLinesTotal: number;
  pendingBytesTotal: number;
  logBufferUsed: number;
  logBufferMax: number;
  branchColorCache: { size: number; max: number };
  trayRecords: number;
  statuslineFiles: number;
  rssBytes: number;
  jsHeapBytes: number | null;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// performance.measureUserAgentSpecificMemory isn't in lib.dom.d.ts and is only
// available in cross-origin-isolated Chromium contexts — declare it locally.
interface MemoryMeasurement {
  bytes: number;
}
interface PerformanceWithMemoryApi {
  measureUserAgentSpecificMemory?: () => Promise<MemoryMeasurement>;
}

async function measureJsHeapBytes(): Promise<number | null> {
  const perf = performance as Performance & PerformanceWithMemoryApi;
  if (typeof perf.measureUserAgentSpecificMemory !== "function") return null;
  try {
    const m = await perf.measureUserAgentSpecificMemory();
    return m.bytes;
  } catch (e) {
    logger.debug("measureUserAgentSpecificMemory failed:", e);
    return null;
  }
}

function collectPaneRows(tabs: Map<string, Tab>): PaneRow[] {
  const rows: PaneRow[] = [];
  for (const tab of tabs.values()) {
    const folder = computeFolderTitle(tab.state);
    for (const pane of tab.getPanes()) {
      rows.push({
        tabTitle: folder,
        paneId: pane.id,
        scrollbackLines: pane.getScrollbackLines(),
        imageMb: pane.getImageStorageMb(),
        pendingBytes: pane.getPendingBytes(),
        residentBytes: pane.state.residentSize,
        webgl: pane.isWebGLActive(),
      });
    }
  }
  return rows;
}

async function buildReport(ctx: MemoryDiagnosticsContext): Promise<ReportData> {
  const panes = collectPaneRows(ctx.tabs);
  const imageMbTotal = panes.reduce((sum, p) => sum + p.imageMb, 0);
  const scrollbackLinesTotal = panes.reduce((sum, p) => sum + p.scrollbackLines, 0);
  const pendingBytesTotal = panes.reduce((sum, p) => sum + p.pendingBytes, 0);
  const webglActive = panes.reduce((sum, p) => sum + (p.webgl ? 1 : 0), 0);

  const [rust, jsHeapBytes] = await Promise.all([
    invoke<RustDiagnostics>("get_memory_diagnostics").catch((e) => {
      logger.debug("get_memory_diagnostics IPC failed:", e);
      return { rssBytes: 0, statuslineFiles: 0 };
    }),
    measureJsHeapBytes(),
  ]);

  return {
    generatedAt: new Date(),
    uptimeMs: Date.now() - ctx.startedAt,
    tabCount: ctx.tabs.size,
    paneCount: panes.length,
    webglActive,
    webglMax: ctx.webglMax,
    panes,
    imageMbTotal,
    scrollbackLinesTotal,
    pendingBytesTotal,
    logBufferUsed: logger.getBufferSize(),
    logBufferMax: logger.getBufferMax(),
    branchColorCache: getBranchColorCacheSize(),
    trayRecords: ctx.notificationTray.snapshot().length,
    statuslineFiles: rust.statuslineFiles,
    rssBytes: rust.rssBytes,
    jsHeapBytes,
  };
}

function formatReport(r: ReportData): string {
  const lines: string[] = [];
  const ts = r.generatedAt.toISOString().replace("T", " ").slice(0, 19);
  lines.push(`ClawTerm Memory Snapshot — ${ts}`);
  lines.push("");
  lines.push(
    `Uptime: ${formatUptime(r.uptimeMs)}   Tabs: ${r.tabCount}   Panes: ${r.paneCount}   WebGL: ${r.webglActive}/${r.webglMax}`,
  );
  lines.push(
    `Log buffer: ${r.logBufferUsed}/${r.logBufferMax}${r.logBufferUsed >= r.logBufferMax ? " (saturated)" : ""}   ` +
      `Statusline files: ${r.statuslineFiles}   ` +
      `Branch color cache: ${r.branchColorCache.size}/${r.branchColorCache.max}   ` +
      `Tray records: ${r.trayRecords}`,
  );
  lines.push("");

  lines.push(`Per-pane (${r.panes.length}):`);
  if (r.panes.length === 0) {
    lines.push("  (none)");
  } else {
    for (const p of r.panes) {
      const rss = formatResidentSize(p.residentBytes) || "?";
      const pending = p.pendingBytes > 0 ? `  pending=${formatResidentSize(p.pendingBytes)}` : "";
      const webgl = p.webgl ? "" : "  canvas";
      lines.push(
        `  ${p.tabTitle.padEnd(18)} pane=${p.paneId}  scrollback=${p.scrollbackLines}  image=${p.imageMb.toFixed(1)}MB  rss=${rss}${pending}${webgl}`,
      );
    }
  }
  lines.push("");

  lines.push("Aggregates:");
  lines.push(`  Image storage    ${r.imageMbTotal.toFixed(1)} MB`);
  lines.push(`  Scrollback       ${r.scrollbackLinesTotal} lines across ${r.panes.length} panes`);
  lines.push(`  Pending PTY      ${formatResidentSize(r.pendingBytesTotal) || "0B"} queued (hidden panes)`);
  lines.push("");

  lines.push("Process:");
  lines.push(`  RSS              ${r.rssBytes > 0 ? formatResidentSize(r.rssBytes) : "?"}`);
  if (r.jsHeapBytes != null) {
    lines.push(`  JS heap          ${formatResidentSize(r.jsHeapBytes)} (Chromium measureUserAgentSpecificMemory)`);
  } else {
    lines.push("  JS heap          unavailable (cross-origin isolation required)");
  }

  return lines.join("\n");
}

/** One-shot snapshot — no live refresh; the user re-opens to resnapshot. */
export async function showMemoryDiagnostics(ctx: MemoryDiagnosticsContext): Promise<void> {
  document.querySelector(".memory-diagnostics-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "palette-overlay memory-diagnostics-overlay";

  const modal = document.createElement("div");
  modal.className = "palette-modal memory-diagnostics-modal";

  const title = document.createElement("div");
  title.className = "memory-diagnostics-title";
  title.textContent = "Memory Diagnostics";

  const pre = document.createElement("pre");
  pre.className = "memory-diagnostics-report";
  pre.textContent = "Measuring…";

  const actions = document.createElement("div");
  actions.className = "memory-diagnostics-actions";
  const copyBtn = document.createElement("button");
  copyBtn.className = "btn btn--secondary";
  copyBtn.textContent = "Copy to Clipboard";
  copyBtn.disabled = true;
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn";
  closeBtn.textContent = "Close";
  actions.appendChild(copyBtn);
  actions.appendChild(closeBtn);

  modal.appendChild(title);
  modal.appendChild(pre);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const removeTrap = trapFocus(modal);
  const dismiss = () => {
    removeTrap();
    overlay.remove();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismiss();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dismiss();
  });
  closeBtn.addEventListener("click", dismiss);

  let reportText = "";
  try {
    const report = await buildReport(ctx);
    reportText = formatReport(report);
    pre.textContent = reportText;
    copyBtn.disabled = false;
  } catch (e) {
    logger.warn("memory diagnostics build failed:", e);
    pre.textContent = `Failed to build report: ${e instanceof Error ? e.message : String(e)}`;
  }

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(reportText).then(
      () => showToast("Memory report copied to clipboard", "info"),
      () => showToast("Failed to copy report", "error"),
    );
  });

  closeBtn.focus();
}
