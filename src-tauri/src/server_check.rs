use std::net::TcpStream;
use std::time::Duration;

/// Check if a TCP port is open on localhost.
#[tauri::command]
pub fn check_port(port: u16) -> bool {
    TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
        Duration::from_secs(2),
    )
    .is_ok()
}
