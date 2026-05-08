//! macOS native menu bar (#487).
//!
//! Builds the global menu bar to the right of the Apple logo and bridges
//! item clicks to the frontend by emitting a `menu-action` event with the
//! item ID. The TS side maps each ID to the existing `KeybindingActions`
//! surface used by the keybinding handler and command palette — there's
//! one action map shared across all three input paths.
//!
//! Accelerators are bound from `config.keybindings` via the
//! `apply_menu_accelerators` command (#495). The frontend translates
//! config keybinding names to menu item IDs and invokes the command on
//! startup and on config reload, which rebuilds the menu in place. If a
//! binding string can't be parsed (e.g. compound resize chords) the menu
//! item is built without an accelerator and the keybinding handler keeps
//! handling the raw key event.
//!
//! Standard Window/App items use `PredefinedMenuItem` for free
//! localization + role behavior. macOS only — gated by cfg in main.rs.
//!
//! Edit menu cut/copy/paste/selectAll dispatch through custom IDs so
//! they reach the focused pane's xterm (or text input) rather than
//! relying on the macOS responder chain (#497).

use std::collections::HashMap;
use tauri::{
    menu::{Menu, MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Runtime,
};

/// Build and attach the macOS menu bar with no accelerators. Call once on
/// setup; the frontend follows up with `apply_menu_accelerators` once it
/// has loaded `config.keybindings`.
pub fn build_and_set<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_menu(app, &HashMap::new())?;
    app.set_menu(menu)?;
    Ok(())
}

/// Rebuild the menu with accelerators bound from `config.keybindings`.
/// Called by the frontend on startup and on config reload (#495).
#[tauri::command]
pub fn apply_menu_accelerators<R: Runtime>(
    app: AppHandle<R>,
    accelerators: HashMap<String, String>,
) -> Result<(), String> {
    let menu = build_menu(&app, &accelerators).map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}

fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    accels: &HashMap<String, String>,
) -> tauri::Result<Menu<R>> {
    let app_submenu = SubmenuBuilder::new(app, "Clawterm")
        .item(&item(app, "about", "About Clawterm", accels)?)
        .item(&item(app, "checkForUpdates", "Check for Updates…", accels)?)
        .separator()
        .item(&item(app, "toggleSettings", "Settings…", accels)?)
        .item(&item(app, "openConfigFile", "Open Config File…", accels)?)
        .item(&item(app, "reloadConfig", "Reload Config", accels)?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&item(app, "createTab", "New Tab", accels)?)
        .item(&item(app, "openWorktreeDialog", "New Agent Tab on Branch…", accels)?)
        .item(&item(app, "newProject", "New Project", accels)?)
        .separator()
        .item(&item(app, "restoreClosedTab", "Restore Closed Tab", accels)?)
        .separator()
        .item(&item(app, "closeActivePane", "Close Pane", accels)?)
        .item(&item(app, "closeActiveTab", "Close Tab", accels)?)
        .build()?;

    // Edit menu accelerators are standard macOS bindings and not driven by
    // config.keybindings — they're fixed strings that the dispatcher routes
    // to xterm or the focused text input (#497).
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&MenuItemBuilder::with_id("editCut", "Cut").accelerator("CmdOrCtrl+X").build(app)?)
        .item(&MenuItemBuilder::with_id("editCopy", "Copy").accelerator("CmdOrCtrl+C").build(app)?)
        .item(&MenuItemBuilder::with_id("editPaste", "Paste").accelerator("CmdOrCtrl+V").build(app)?)
        .item(&MenuItemBuilder::with_id("editSelectAll", "Select All").accelerator("CmdOrCtrl+A").build(app)?)
        .separator()
        .item(&item(app, "toggleSearch", "Find…", accels)?)
        .build()?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&item(app, "zoomIn", "Zoom In", accels)?)
        .item(&item(app, "zoomOut", "Zoom Out", accels)?)
        .item(&item(app, "zoomReset", "Reset Zoom", accels)?)
        .separator()
        .item(&item(app, "toggleWorkspacePanel", "Toggle Workspace Panel", accels)?)
        .separator()
        .item(&item(app, "openCommandPalette", "Show Command Palette", accels)?)
        .item(&item(app, "showQuickSwitch", "Quick Switch", accels)?)
        .item(&item(app, "jumpToBranch", "Jump to Branch…", accels)?)
        .item(&item(app, "cycleAttentionTabs", "Cycle Attention Tabs", accels)?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    let tab_submenu = SubmenuBuilder::new(app, "Tab")
        .item(&item(app, "nextTab", "Next Tab", accels)?)
        .item(&item(app, "prevTab", "Previous Tab", accels)?)
        .build()?;

    let pane_submenu = SubmenuBuilder::new(app, "Pane")
        .item(&item(app, "splitVertical", "Split Right", accels)?)
        .item(&item(app, "splitHorizontal", "Split Down", accels)?)
        .separator()
        .item(&item(app, "focusNextPane", "Focus Next Pane", accels)?)
        .item(&item(app, "focusPrevPane", "Focus Previous Pane", accels)?)
        .build()?;

    let project_submenu = SubmenuBuilder::new(app, "Project")
        .item(&item(app, "newProject", "New Project", accels)?)
        .item(&item(app, "nextProject", "Next Project", accels)?)
        .item(&item(app, "prevProject", "Previous Project", accels)?)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let help_submenu = SubmenuBuilder::new(app, "Help")
        .item(&item(app, "openDocs", "Clawterm Documentation", accels)?)
        .item(&item(app, "reportIssue", "Report an Issue", accels)?)
        .item(&item(app, "showShortcuts", "Show Keyboard Shortcuts", accels)?)
        .build()?;

    MenuBuilder::new(app)
        .items(&[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &tab_submenu,
            &pane_submenu,
            &project_submenu,
            &window_submenu,
            &help_submenu,
        ])
        .build()
}

/// Build a custom menu item, attaching an accelerator from `accels` if one
/// is present and parses cleanly. If Tauri rejects the accelerator string,
/// fall back to the no-accelerator item — the keybinding handler keeps
/// firing on the raw key event regardless.
fn item<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    label: &str,
    accels: &HashMap<String, String>,
) -> tauri::Result<MenuItem<R>> {
    let accel = accels.get(id).map(String::as_str).filter(|s| !s.is_empty());
    if let Some(a) = accel {
        if let Ok(item) = MenuItemBuilder::with_id(id, label).accelerator(a).build(app) {
            return Ok(item);
        }
    }
    MenuItemBuilder::with_id(id, label).build(app)
}

/// Forward custom menu item clicks to the frontend. Predefined items
/// are handled by the OS; this only fires for our `MenuItemBuilder` IDs.
pub fn on_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    // Help menu items open URLs directly from Rust — simpler than a
    // round-trip through the frontend, and they don't need any in-app
    // state.
    match id {
        "openDocs" => {
            let _ = tauri_plugin_opener::OpenerExt::opener(app)
                .open_url("https://clawterm.github.io/clawterm/docs/", None::<&str>);
            return;
        }
        "reportIssue" => {
            let _ = tauri_plugin_opener::OpenerExt::opener(app)
                .open_url("https://github.com/clawterm/clawterm/issues/new", None::<&str>);
            return;
        }
        _ => {}
    }
    // Everything else dispatches into the frontend's existing action map.
    let _ = app.emit("menu-action", id.to_string());
}
