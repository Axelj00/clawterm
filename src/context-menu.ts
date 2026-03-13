export interface ContextMenuItem {
  label: string;
  action: () => void;
  separator?: boolean;
  disabled?: boolean;
}

let activeMenu: HTMLDivElement | null = null;

function closeActiveMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

// Close on any click outside or Escape key
document.addEventListener("click", closeActiveMenu);
document.addEventListener("contextmenu", closeActiveMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeActiveMenu();
});

export function showContextMenu(x: number, y: number, items: ContextMenuItem[]) {
  closeActiveMenu();

  const menu = document.createElement("div");
  menu.className = "context-menu";

  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement("div");
      sep.className = "context-menu-separator";
      menu.appendChild(sep);
    }

    const el = document.createElement("div");
    el.className = "context-menu-item";
    if (item.disabled) el.classList.add("disabled");
    el.textContent = item.label;

    if (!item.disabled) {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        closeActiveMenu();
        item.action();
      });
    }

    menu.appendChild(el);
  }

  // Position: ensure menu stays in viewport
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - rect.width - 4}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - rect.height - 4}px`;
  }

  activeMenu = menu;
}
