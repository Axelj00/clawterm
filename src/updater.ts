import { check } from "@tauri-apps/plugin-updater";
import { logger } from "./logger";

export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (!update) return;

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
    // Silently ignore — updater may not be configured yet
    logger.debug("Update check skipped:", e);
  }
}

function showUpdateNotice(version: string, onInstall: () => void): void {
  const footer = document.getElementById("sidebar-footer");
  if (!footer) return;

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

  // Insert above the new tab button
  footer.insertBefore(notice, footer.firstChild);

  notice.querySelector(".update-notice-action")!.addEventListener("click", (e) => {
    e.stopPropagation();
    const btn = notice.querySelector(".update-notice-action") as HTMLButtonElement;
    btn.textContent = "Installing…";
    btn.disabled = true;
    notice.classList.add("installing");
    onInstall();
  });
}
