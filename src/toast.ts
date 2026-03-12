let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

export type ToastLevel = "error" | "warn" | "info";

export function showToast(message: string, level: ToastLevel = "info", durationMs = 5000): void {
  const c = ensureContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${level}`;
  toast.textContent = message;

  const dismiss = document.createElement("button");
  dismiss.className = "toast-dismiss";
  dismiss.textContent = "\u00d7";
  dismiss.addEventListener("click", () => remove());
  toast.appendChild(dismiss);

  c.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  const timer = setTimeout(() => remove(), durationMs);

  function remove() {
    clearTimeout(timer);
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove());
    // Fallback if transitionend doesn't fire
    setTimeout(() => toast.remove(), 300);
  }
}
