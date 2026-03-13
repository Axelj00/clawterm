import { check } from "@tauri-apps/plugin-updater";
import { logger } from "./logger";
import { trapFocus } from "./utils";

const CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds
let updateFound = false;

export function startUpdateChecker(): void {
  // First check after 3 seconds
  setTimeout(checkForUpdates, 3000);

  // Then check periodically
  setInterval(() => {
    if (!updateFound) checkForUpdates();
  }, CHECK_INTERVAL_MS);
}

async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (!update) return;

    updateFound = true;
    logger.debug(`Update available: ${update.version}`);
    showUpdateNotice(update.version, async () => {
      try {
        await update.downloadAndInstall();
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch (e) {
        logger.debug("Update install failed:", e);
      }
    });
  } catch (e) {
    logger.debug("Update check skipped:", e);
  }
}

function showUpdateConfirm(version: string, onConfirm: () => void): void {
  document.querySelector(".close-confirm-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "close-confirm-overlay";

  const dialog = document.createElement("div");
  dialog.className = "close-confirm-dialog";

  const titleEl = document.createElement("div");
  titleEl.className = "close-confirm-title";
  titleEl.textContent = "Install update?";

  const bodyEl = document.createElement("div");
  bodyEl.className = "close-confirm-body";
  bodyEl.textContent = `Version ${version} is ready. This will close all terminals and restart the app.`;

  const actionsEl = document.createElement("div");
  actionsEl.className = "close-confirm-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "close-confirm-btn cancel";
  cancelBtn.textContent = "Cancel";

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "close-confirm-btn confirm";
  confirmBtn.textContent = "Update & Restart";

  actionsEl.appendChild(cancelBtn);
  actionsEl.appendChild(confirmBtn);
  dialog.appendChild(titleEl);
  dialog.appendChild(bodyEl);
  dialog.appendChild(actionsEl);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const removeTrap = trapFocus(dialog);
  const dismiss = () => {
    removeTrap();
    overlay.remove();
  };

  cancelBtn.addEventListener("click", dismiss);
  confirmBtn.addEventListener("click", () => {
    dismiss();
    onConfirm();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismiss();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dismiss();
  });

  cancelBtn.focus();
}

function showUpdateNotice(version: string, onInstall: () => void): void {
  const footer = document.getElementById("sidebar-footer");
  if (!footer) return;

  // Don't show duplicate notices
  if (footer.querySelector(".update-notice")) return;

  const notice = document.createElement("div");
  notice.className = "update-notice";
  notice.innerHTML = `
    <div class="update-notice-dot"></div>
    <div class="update-notice-text">
      <span class="update-notice-label">Update available</span>
      <span class="update-notice-version">${version}</span>
    </div>
    <button class="update-notice-action">Update</button>
  `;

  footer.insertBefore(notice, footer.firstChild);

  notice.querySelector(".update-notice-action")!.addEventListener("click", (e) => {
    e.stopPropagation();
    showUpdateConfirm(version, () => {
      const btn = notice.querySelector(".update-notice-action") as HTMLButtonElement;
      btn.textContent = "Installing\u2026";
      btn.disabled = true;
      notice.classList.add("installing");
      onInstall();
    });
  });
}
