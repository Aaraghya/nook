use std::process::{Command, Stdio};
use std::time::Duration;

use windows::core::w;
use windows::Win32::Foundation::GetLastError;
use windows::Win32::System::Threading::CreateMutexW;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, VK_N,
};
use windows::Win32::UI::WindowsAndMessaging::{GetMessageW, MSG, WM_HOTKEY};

const HOTKEY_ID: i32 = 1;
const ERROR_ALREADY_EXISTS: u32 = 183;
const REGISTER_RETRY_MS: u64 = 1000;
const STARTUP_GRACE_MS: u64 = 1000;

pub fn run() {
    if let Ok(handle) = unsafe { CreateMutexW(None, false, w!("NookHotkeyWatcherSingleton")) } {
        if unsafe { GetLastError().0 } == ERROR_ALREADY_EXISTS {
            return;
        }
        let _ = handle;
    }
    std::thread::sleep(Duration::from_millis(STARTUP_GRACE_MS));
    let mut registered = false;
    loop {
        let result = unsafe {
            RegisterHotKey(
                None,
                HOTKEY_ID,
                HOT_KEY_MODIFIERS(MOD_CONTROL.0 | MOD_SHIFT.0 | MOD_NOREPEAT.0),
                VK_N.0 as u32,
            )
        };
        match result {
            Ok(()) => {
                if !registered {
                    eprintln!("watcher: hotkey registered");
                }
                registered = true;
                let mut message = MSG::default();
                loop {
                    let get_result = unsafe { GetMessageW(&mut message, None, 0, 0) };
                    if get_result.0 == 0 || get_result.0 == -1 {
                        eprintln!("watcher: message loop ended ({})", get_result.0);
                        break;
                    }
                    if message.message == WM_HOTKEY {
                        std::thread::spawn(|| {
                            if let Err(error) = spawn_main() {
                                eprintln!("watcher: spawn failed: {error}");
                            }
                        });
                    }
                }
                let _ = unsafe { UnregisterHotKey(None, HOTKEY_ID) };
            }
            Err(_) => {
                if registered {
                    eprintln!("watcher: hotkey lost, retrying");
                }
                registered = false;
                std::thread::sleep(Duration::from_millis(REGISTER_RETRY_MS));
            }
        }
    }
}

fn spawn_main() -> std::io::Result<()> {
    Command::new(std::env::current_exe()?)
        .arg("--toggle")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    Ok(())
}
