export type TabActivity = "idle" | "running" | "agent-waiting" | "server-running" | "error" | "completed";

export interface TabState {
  folderName: string;
  processName: string;
  isIdle: boolean;
  needsAttention: boolean;
  activity: TabActivity;
  agentName: string | null;
  serverPort: number | null;
  projectName: string | null;
  lastError: string | null;
}

export function createDefaultTabState(): TabState {
  return {
    folderName: "~",
    processName: "",
    isIdle: true,
    needsAttention: false,
    activity: "idle",
    agentName: null,
    serverPort: null,
    projectName: null,
    lastError: null,
  };
}

export function computeDisplayTitle(state: TabState): string {
  const project = state.projectName || state.folderName || "~";

  if (state.serverPort) return `${project} :${state.serverPort}`;
  if (state.agentName) {
    const suffix = state.activity === "agent-waiting" ? " [waiting]" : "";
    return `${project} — ${state.agentName}${suffix}`;
  }
  if (state.isIdle) return project;
  return `${project} — ${state.processName}`;
}

export function computeSubtitle(state: TabState): string | null {
  if (state.activity === "agent-waiting") return "waiting for input";
  if (state.serverPort) return `localhost:${state.serverPort}`;
  if (state.lastError) return state.lastError;
  if (state.agentName && state.activity === "running") return state.agentName;
  return null;
}

export const ACTIVITY_ICONS: Record<TabActivity, { icon: string; cssClass: string }> = {
  idle: { icon: "\u25CB", cssClass: "activity-idle" },
  running: { icon: "\u25B6", cssClass: "activity-running" },
  "agent-waiting": { icon: "\u25CF", cssClass: "activity-agent-waiting" },
  "server-running": { icon: "\u25C9", cssClass: "activity-server" },
  error: { icon: "\u25CF", cssClass: "activity-error" },
  completed: { icon: "\u2713", cssClass: "activity-completed" },
};
