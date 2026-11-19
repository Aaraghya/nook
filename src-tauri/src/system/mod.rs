use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Window, WindowEvent, Wry};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_global_shortcut::{GlobalShortcutExt as _, ShortcutState};

const GLOBAL_SHORTCUT: &str = "Alt+Space";
const MAIN_WINDOW: &str = "main";

struct AutostartToggle(CheckMenuItem<Wry>);

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    build_tray(app.handle())?;
    register_shortcut(app.handle());
    Ok(())
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
        let visible = window.is_visible().unwrap_or(false)
            && !window.is_minimized().unwrap_or(false);
        if visible {
            let _ = window.hide();
        } else {
            show_main(app);
        }
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Open Pocket", true, None::<&str>)?;
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

    let mut builder = TrayIconBuilder::with_id("pocket-tray")
        .tooltip("Pocket")
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
    let registration = app.global_shortcut().on_shortcut(GLOBAL_SHORTCUT, |app, _shortcut, event| {
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
