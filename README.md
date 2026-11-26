# Nook

A lightweight Windows utility for ClipStack, Snippets, Now Playing, and natural-language Google Calendar events.

## Setup

Requires Windows 10/11, Node.js 20+, Rust stable, and WebView2.

```bash
git clone https://github.com/Aaraghya/nook.git
cd nook
npm install
npm run tauri dev
```

Build a release with:

```bash
npm run tauri build
```

Use `Ctrl+Shift+N` to show or hide Nook. App data is stored locally in `%APPDATA%\com.pocket.desktop\pocket.db`.
