# Nook

A lightweight Windows desktop companion. A quiet little panel that keeps the small things you use every day within reach: your clipboard history, your snippets, and what's playing right now.

## Features

- **ClipStack** — clipboard history with search, pinning, and one-click copy-back
- **Snippets** — save text you type over and over, one click to reuse
- **Now Playing** — see and control whatever is playing (Spotify, YouTube, ...) right from the panel
- **Alt + Space** — summon or hide Nook from anywhere
- **Tray** — lives in your taskbar tray, out of the way until you need it

Nook is 100% local. No accounts, no sign-ins, no network or API connections. Everything stays on your machine.

## Run it

You need:

- Windows 10 or 11
- [Node.js](https://nodejs.org) 20 or newer
- [Rust](https://rustup.rs) (stable toolchain, MSVC)

```bash
git clone https://github.com/Aaraghya/nook.git
cd nook
npm install
npm run tauri dev
```

## Build the installer

```bash
npm run tauri build
```

The installer (`nook_0.1.0_x64-setup.exe` and `.msi`) and the standalone `nook.exe` land in `src-tauri/target/release/bundle/`. The standalone exe needs nothing installed — just run it.

## Where your data lives

- Clipboard history — in memory only, cleared when Nook closes
- Snippets — a small SQLite file at `%APPDATA%\com.pocket.desktop\pocket.db`
- Settings — Windows autostart entry and credential store

## Download

Prebuilt installers are attached to the [Releases](https://github.com/Aaraghya/nook/releases) page.
