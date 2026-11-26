use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, LogicalPosition, Manager, WebviewWindow, Window, WindowEvent, Wry};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_global_shortcut::{GlobalShortcutExt as _, ShortcutState};
use windows::core::w;
use windows::Win32::Foundation::RECT;
use windows::Win32::System::Registry::{RegSetKeyValueW, HKEY_CURRENT_USER, REG_SZ};
use windows::Win32::UI::WindowsAndMessaging::{
    SystemParametersInfoW, SPIF_UPDATEINIFILE, SPI_GETWORKAREA,
};

const GLOBAL_SHORTCUT: &str = "Ctrl+Shift+N";
const MAIN_WINDOW: &str = "main";
const TASKBAR_MARGIN: i32 = 12;

struct AutostartToggle(CheckMenuItem<Wry>);

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    build_tray(app.handle())?;
    ensure_watcher();
    register_shortcut(app.handle());
    dock_main_window(app.handle());
    Ok(())
}

fn ensure_watcher() {
    let Ok(exe) = std::env::current_exe() else {
        return;
    };
    let mut command = std::process::Command::new(&exe);
    command.arg("--watcher");
    #[cfg(not(debug_assertions))]
    {
        use std::process::Stdio;
        command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
    }
    match command.spawn() {
        Ok(child) => eprintln!("ensure_watcher: spawned watcher pid {}", child.id()),
        Err(error) => eprintln!("ensure_watcher: spawn failed: {error}"),
    }
    let command_line: Vec<u16> = format!("\"{}\" --watcher", exe.display())
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    unsafe {
        let result = RegSetKeyValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run"),
            w!("NookHotkeyWatcher"),
            REG_SZ.0 as u32,
            Some(command_line.as_ptr() as *const core::ffi::c_void),
            (command_line.len() * 2) as u32,
        );
        if result.is_err() {
            eprintln!("ensure_watcher: registry write failed");
        }
    }
}

fn dock_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    if let Some(position) = taskbar_anchor_position(&window) {
        let _ = window.set_position(position);
    }
    let _ = window.show();
}

fn taskbar_anchor_position(window: &WebviewWindow) -> Option<LogicalPosition<f64>> {
    let mut work_area = RECT::default();
    let result = unsafe {
        SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            Some(&mut work_area as *mut RECT as *mut core::ffi::c_void),
            SPIF_UPDATEINIFILE,
        )
    };
    if result.is_err() {
        return None;
    }
    let scale = window.scale_factor().ok().unwrap_or(1.0);
    let size = window.outer_size().ok()?;
    let x = (work_area.right - size.width as i32 - TASKBAR_MARGIN).max(0) as f64 / scale;
    let y = (work_area.bottom - size.height as i32 - TASKBAR_MARGIN).max(0) as f64 / scale;
    Some(LogicalPosition::new(x, y))
}

pub fn handle_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
}

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        if window.is_minimized().unwrap_or(false) {
            let _ = window.unminimize();
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn toggle_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let visible =
            window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false);
        if visible {
            let _ = window.hide();
        } else {
            show_main(app);
        }
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Open Nook", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        "Launch at Startup",
        true,
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&toggle, &autostart, &separator, &quit])?;

    app.manage(AutostartToggle(autostart));

    let mut builder = TrayIconBuilder::with_id("nook-tray")
        .tooltip("Nook")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => show_main(app),
            "autostart" => toggle_autostart(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

fn register_shortcut(app: &AppHandle) {
    let registration =
        app.global_shortcut()
            .on_shortcut(GLOBAL_SHORTCUT, |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    toggle_main(app);
                }
            });
    if let Err(error) = registration {
        eprintln!("global shortcut registration failed: {error}");
    }
}

fn toggle_autostart(app: &AppHandle) {
    let manager = app.autolaunch();
    let enabled = manager.is_enabled().unwrap_or(false);
    let result = if enabled {
        manager.disable()
    } else {
        manager.enable()
    };
    if let Err(error) = result {
        eprintln!("autostart toggle failed: {error}");
    }
    if let Some(item) = app.try_state::<AutostartToggle>() {
        let _ = item.0.set_checked(manager.is_enabled().unwrap_or(false));
    }
}
