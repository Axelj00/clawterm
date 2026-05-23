import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger / toast — silence side effects so tests don't depend on output.
vi.mock("../src/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../src/toast", () => ({ showToast: vi.fn() }));

// Mock Tauri APIs the updater touches at runtime.
const checkMock = vi.fn();
const downloadMock = vi.fn();
const installMock = vi.fn();
const downloadAndInstallMock = vi.fn();
const relaunchMock = vi.fn();
const invokeMock = vi.fn();
const openUrlMock = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => checkMock(...args),
}));
vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => relaunchMock(...args),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (...args: unknown[]) => openUrlMock(...args),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// Minimal document stub — the updater only reads via querySelector /
// getElementById / createElement, and the renderNotice paths bail out
// cleanly when those return null. We don't assert on DOM output here;
// the focus is the state machine + quit-time install correctness.
function stubDom() {
  const fakeEl = {
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    appendChild: () => {},
    insertBefore: () => {},
    querySelector: () => null,
    setAttribute: () => {},
    addEventListener: () => {},
    focus: () => {},
    remove: () => {},
    textContent: "",
    innerHTML: "",
    className: "",
    disabled: false,
    onclick: null as null | (() => void),
    title: "",
    firstChild: null,
  };
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({ ...fakeEl }),
    getElementById: () => null,
    querySelector: () => null,
    body: { appendChild: () => {} },
    addEventListener: () => {},
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function makeMockUpdate(version = "9.9.9") {
  return {
    version,
    body: "",
    download: downloadMock,
    install: installMock,
    downloadAndInstall: downloadAndInstallMock,
  };
}

const baseConfig = {
  updates: { autoCheck: true, checkIntervalMs: 3_600_000, mode: "download" as const },
};

describe("updater — quit-time install safety", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    stubDom();
    // Defaults that let mode=download complete cleanly through download but
    // *not* install (so tests can assert the staged state).
    downloadMock.mockResolvedValue(undefined);
    installMock.mockResolvedValue(undefined);
    downloadAndInstallMock.mockResolvedValue(undefined);
    invokeMock.mockResolvedValue(undefined);
    relaunchMock.mockResolvedValue(undefined);
    openUrlMock.mockResolvedValue(undefined);
  });

  it("hasStagedUpdate() is false before any update is detected", async () => {
    const { hasStagedUpdate } = await import("../src/updater");
    expect(hasStagedUpdate()).toBe(false);
  });

  it("installStagedOnQuit() is a no-op when no update is staged", async () => {
    const { installStagedOnQuit } = await import("../src/updater");
    await installStagedOnQuit();
    expect(installMock).not.toHaveBeenCalled();
    expect(downloadAndInstallMock).not.toHaveBeenCalled();
  });

  it("mode=download stages the bundle automatically and installStagedOnQuit() applies it", async () => {
    checkMock.mockResolvedValue(makeMockUpdate());
    const { manualCheckForUpdates, hasStagedUpdate, installStagedOnQuit } = await import(
      "../src/updater"
    );
    // Configure mode via startUpdateChecker (autoCheck:false so we drive the
    // detection manually via manualCheckForUpdates instead of the timer).
    const { startUpdateChecker } = await import("../src/updater");
    startUpdateChecker({ ...baseConfig, updates: { ...baseConfig.updates, autoCheck: false } } as Parameters<typeof startUpdateChecker>[0]);

    await manualCheckForUpdates();
    // Let the floated downloadPending() promise settle.
    await new Promise((r) => setTimeout(r, 0));

    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(hasStagedUpdate()).toBe(true);

    await installStagedOnQuit();
    expect(installMock).toHaveBeenCalledTimes(1);
    // No relaunch during quit-install — user is already on the way out.
    expect(relaunchMock).not.toHaveBeenCalled();
  });

  it("mode=manual does NOT auto-download on detection", async () => {
    checkMock.mockResolvedValue(makeMockUpdate());
    const { manualCheckForUpdates, hasStagedUpdate, startUpdateChecker } = await import(
      "../src/updater"
    );
    startUpdateChecker({
      ...baseConfig,
      updates: { ...baseConfig.updates, autoCheck: false, mode: "manual" },
    } as Parameters<typeof startUpdateChecker>[0]);

    await manualCheckForUpdates();
    await new Promise((r) => setTimeout(r, 0));

    expect(downloadMock).not.toHaveBeenCalled();
    expect(hasStagedUpdate()).toBe(false);
  });

  it("installStagedOnQuit() swallows install errors so quit always proceeds", async () => {
    checkMock.mockResolvedValue(makeMockUpdate());
    installMock.mockRejectedValueOnce(new Error("simulated install failure"));
    const { manualCheckForUpdates, installStagedOnQuit, startUpdateChecker } = await import(
      "../src/updater"
    );
    startUpdateChecker({ ...baseConfig, updates: { ...baseConfig.updates, autoCheck: false } } as Parameters<typeof startUpdateChecker>[0]);

    await manualCheckForUpdates();
    await new Promise((r) => setTimeout(r, 0));

    // Must resolve (not reject) — a rejected promise would propagate up the
    // onCloseRequested chain and could leave the window in a broken state.
    await expect(installStagedOnQuit()).resolves.toBeUndefined();
  });

  it("mode=auto runs combined downloadAndInstall + relaunch on detection", async () => {
    checkMock.mockResolvedValue(makeMockUpdate());
    const { manualCheckForUpdates, startUpdateChecker } = await import("../src/updater");
    startUpdateChecker({
      ...baseConfig,
      updates: { ...baseConfig.updates, autoCheck: false, mode: "auto" },
    } as Parameters<typeof startUpdateChecker>[0]);

    await manualCheckForUpdates();
    // Two microtask flushes — handleDetected fires installPending() async;
    // installPending awaits downloadAndInstall then relaunch.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(downloadAndInstallMock).toHaveBeenCalledTimes(1);
    expect(relaunchMock).toHaveBeenCalledTimes(1);
  });
});
