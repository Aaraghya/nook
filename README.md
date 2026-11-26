# Nook

Nook is a lightweight Windows utility for the small things you do most while using your computer: ClipStack, reusable Snippets, Now Playing, and natural-language Google Calendar events.

I got tired of opening three different tabs to handle simple everyday tasks, so I made Nook instead. It is also my experiment with Rust as I learn and build with a new programming language.

Everything stays local on your machine, apart from links you choose to open in Google Calendar.

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

Use `Ctrl+Shift+N` to summon or hide Nook. App data is stored locally in `%APPDATA%\com.pocket.desktop\pocket.db`.
