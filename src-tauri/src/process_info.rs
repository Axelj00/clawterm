use serde::Serialize;
use std::mem;
use std::path::Path;

// libproc FFI declarations (not all in libc crate)
extern "C" {
    fn proc_listchildpids(ppid: libc::c_int, buffer: *mut libc::c_void, buffersize: libc::c_int) -> libc::c_int;
    fn proc_name(pid: libc::c_int, buffer: *mut libc::c_void, buffersize: u32) -> libc::c_int;
}

const PROC_PIDVNODEPATHINFO: libc::c_int = 9;

#[derive(Serialize)]
pub struct ProcessInfo {
    pub name: String,
    pub pid: u32,
}

/// Walk the process tree to find the deepest child of `shell_pid`.
#[tauri::command]
pub fn get_foreground_process(pid: u32) -> Result<ProcessInfo, String> {
    let mut current_pid = pid;
    let mut current_name = get_proc_name(pid).unwrap_or_default();

    loop {
        let children = list_child_pids(current_pid);
        if children.is_empty() {
            break;
        }
        // Take the first child — shells typically have one foreground child
        let child_pid = children[0];
        current_name = get_proc_name(child_pid).unwrap_or_default();
        current_pid = child_pid;
    }

    Ok(ProcessInfo {
        name: current_name,
        pid: current_pid,
    })
}

/// Get the current working directory of a process by PID.
/// Returns the last path component for display.
#[tauri::command]
pub fn get_process_cwd(pid: u32) -> Result<String, String> {
    let cwd = proc_cwd(pid).map_err(|e| e.to_string())?;
    let folder = std::path::Path::new(&cwd)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| {
            if cwd == "/" {
                "/".to_string()
            } else {
                "~".to_string()
            }
        });
    Ok(folder)
}

/// Get the full current working directory path of a process.
#[tauri::command]
pub fn get_process_cwd_full(pid: u32) -> Result<String, String> {
    proc_cwd(pid).map_err(|e| e.to_string())
}

/// Read project manifest files in the given directory to extract a project name.
#[tauri::command]
pub fn get_project_info(dir: String) -> String {
    let path = Path::new(&dir);

    // package.json
    if let Ok(content) = std::fs::read_to_string(path.join("package.json")) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(name) = val.get("name").and_then(|n| n.as_str()) {
                if !name.is_empty() {
                    return name.to_string();
                }
            }
        }
    }

    // Cargo.toml - simple parse for name
    if let Ok(content) = std::fs::read_to_string(path.join("Cargo.toml")) {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("name") {
                if let Some(val) = trimmed.split('=').nth(1) {
                    let name = val.trim().trim_matches('"').trim_matches('\'');
                    if !name.is_empty() {
                        return name.to_string();
                    }
                }
            }
        }
    }

    // pyproject.toml
    if let Ok(content) = std::fs::read_to_string(path.join("pyproject.toml")) {
        let mut in_project = false;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed == "[project]" {
                in_project = true;
                continue;
            }
            if in_project && trimmed.starts_with('[') {
                break;
            }
            if in_project && trimmed.starts_with("name") {
                if let Some(val) = trimmed.split('=').nth(1) {
                    let name = val.trim().trim_matches('"').trim_matches('\'');
                    if !name.is_empty() {
                        return name.to_string();
                    }
                }
            }
        }
    }

    // go.mod
    if let Ok(content) = std::fs::read_to_string(path.join("go.mod")) {
        if let Some(first_line) = content.lines().next() {
            if first_line.starts_with("module ") {
                let module = first_line.trim_start_matches("module ").trim();
                // Use last path segment
                if let Some(last) = module.rsplit('/').next() {
                    if !last.is_empty() {
                        return last.to_string();
                    }
                }
            }
        }
    }

    // Fallback: directory name
    path.file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default()
}

// --- macOS helpers ---

fn list_child_pids(ppid: u32) -> Vec<u32> {
    unsafe {
        // First call with null buffer to get count
        let count = proc_listchildpids(ppid as libc::c_int, std::ptr::null_mut(), 0);
        if count <= 0 {
            return vec![];
        }

        let buf_size = (count as usize) * mem::size_of::<libc::c_int>();
        let mut pids: Vec<libc::c_int> = vec![0; count as usize];

        let actual = proc_listchildpids(
            ppid as libc::c_int,
            pids.as_mut_ptr() as *mut libc::c_void,
            buf_size as libc::c_int,
        );

        if actual <= 0 {
            return vec![];
        }

        let actual_count = actual as usize / mem::size_of::<libc::c_int>();
        pids.truncate(actual_count);
        pids.into_iter().filter(|&p| p > 0).map(|p| p as u32).collect()
    }
}

fn get_proc_name(pid: u32) -> Option<String> {
    unsafe {
        let mut buf = [0u8; 1024];
        let ret = proc_name(
            pid as libc::c_int,
            buf.as_mut_ptr() as *mut libc::c_void,
            buf.len() as u32,
        );
        if ret <= 0 {
            return None;
        }
        Some(
            std::str::from_utf8(&buf[..ret as usize])
                .unwrap_or("")
                .to_string(),
        )
    }
}

fn proc_cwd(pid: u32) -> Result<String, String> {
    #[repr(C)]
    struct VnodeInfoPath {
        _vip_vi: [u8; 160],            // vnode_info (160 bytes)
        vip_path: [libc::c_char; 1024], // MAXPATHLEN
    }

    #[repr(C)]
    struct ProcVnodePathInfo {
        pvi_cdir: VnodeInfoPath,  // current directory
        _pvi_rdir: VnodeInfoPath, // root directory
    }

    unsafe {
        let mut info: ProcVnodePathInfo = mem::zeroed();
        let size = mem::size_of::<ProcVnodePathInfo>() as libc::c_int;

        let ret = libc::proc_pidinfo(
            pid as libc::c_int,
            PROC_PIDVNODEPATHINFO,
            0,
            &mut info as *mut _ as *mut libc::c_void,
            size,
        );

        if ret <= 0 {
            return Err(format!("proc_pidinfo failed for pid {}", pid));
        }

        let path = std::ffi::CStr::from_ptr(info.pvi_cdir.vip_path.as_ptr())
            .to_string_lossy()
            .to_string();

        if path.is_empty() {
            return Err("empty cwd".to_string());
        }

        Ok(path)
    }
}
