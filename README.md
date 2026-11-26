# Nook

Nook is a lightweight Windows utility for the small things you do most while using your computer: ClipStack, reusable Snippets, Now Playing, and natural-language Google Calendar events.

I got tired of opening three different tabs to handle simple everyday tasks, so I made Nook instead. It is also my experiment with Rust as I learn and build with a new programming language.

Everything stays local on your machine, apart from links you choose to open in Google Calendar.

## What Nook does

- **ClipStack** - clipboard history with search, pinning, and one-click copy-back
- **Snippets** - reusable text snippets, saved locally
- **Now Playing** - see and control media playing on your PC
- **Calendar** - parse natural-language events, keep them persistent in SQLite, and open them in Google Calendar
- **System tray** - launch Nook at startup and keep it close at hand
- **Local-first storage** - Calendar, ClipStack, and Snippets stay on your machine

### Keyboard shortcuts

- **Ctrl + Shift + N** — summon or hide Nook from anywhere
- **Shift + +** — add a new Calendar entry
- **Enter** — preview a Calendar entry, or open it in Google Calendar from its preview
- **Shift + Enter** — return to editing a Calendar entry
- **Escape** — clear a Calendar draft, return to editing, cancel delete confirmation, or close the Snippets editor

* Calendar shortcuts apply when the Calendar panel is focused

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
