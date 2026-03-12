import "@xterm/xterm/css/xterm.css";
import "./style.css";
import { TerminalManager } from "./terminal-manager";
import { checkForUpdates } from "./updater";

const manager = new TerminalManager();
manager.init();

// Check for updates after a short delay to not block startup
setTimeout(checkForUpdates, 3000);
