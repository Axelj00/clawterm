import "@xterm/xterm/css/xterm.css";
import "./style.css";
import { TerminalManager } from "./terminal-manager";
import { startUpdateChecker } from "./updater";

const manager = new TerminalManager();
manager.init();

// Clean up resources on window close
window.addEventListener("beforeunload", () => manager.dispose());

// Check for updates on launch and periodically
startUpdateChecker();
