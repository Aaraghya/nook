# nook

nook is a lightweight windows desktop companion for the small tasks you do most while using your computer.

i got tired of opening three different tabs to handle simple everyday tasks, so i made nook instead. it's also my experiment with rust as i learn and build with a new programming language.

## what nook does

- **clipstack** - clipboard history with search, pinning, and one-click copy-back
- **snippets** - reusable text snippets, saved locally
- **now playing** - see and control media playing on your pc
- **calendar** - parse natural-language events, save them persistently, and open them in google calendar
- **system tray** - keep nook running quietly and launch it at startup
- **local-first storage** - calendar, clipstack, and snippets stay on your machine

### keyboard shortcuts

- **ctrl + shift + n** - summon or hide nook from anywhere
- **shift + +** - add a new calendar entry
- **enter** - preview a calendar entry, or open it in google calendar from its preview
- **shift + enter** - return to editing a calendar entry
- **escape** - clear a calendar draft, return to editing, cancel delete confirmation, or close the snippets editor

calendar shortcuts apply when the calendar panel is focused. the add-entry shortcut does not trigger while typing in an input field.

## download nook

download the latest version from the [nook releases page](https://github.com/Aaraghya/nook/releases/latest).
for most users, download:

```text
Nook_0.2.0_x64-setup.exe
```

this is the recommended installer.

## installing nook on windows

1. open the [latest nook release](https://github.com/Aaraghya/nook/releases/latest) on github.
2. scroll down to the **assets** section.
3. download `Nook_0.2.0_x64-setup.exe`.
4. open the downloaded installer from your browser's downloads list or from your windows downloads folder.
5. if windows displays a security warning, confirm that the file came from the official nook github releases page. nook is currently unsigned, so windows may display a smartscreen warning.
6. if you trust the download, select **more info**, then select **run anyway**.
7. follow the installation prompts.
8. once installation is complete, launch nook from the start menu or desktop shortcut if one was created.
9. nook will start in the background and can be summoned or hidden from anywhere with:

```text
ctrl + shift + n
```

## alternative downloads

the release page also includes two alternatives:
- `Nook_0.2.0_x64_en-US.msi` - an msi installer for users or environments that prefer windows installer packages
- `nook.exe` - a portable version that can be launched without installation
- 
the portable version does not need to be placed in a specific folder. download it, open it, and nook will run. its data is still stored locally in your windows user profile.

## your data and privacy
nook does not require an account or sign-in.
your calendar entries, clipstack history, and snippets are stored locally at:

```text
%appdata%\com.pocket.desktop\pocket.db
```

each windows user and computer has its own local database. downloading nook from github does not give anyone access to another user's entries.
nook only leaves your computer when you choose to open a link in google calendar or interact with an external service yourself.

## building nook from source

most users should download the installer from the releases page. building from source is intended for developers or contributors.
you will need:

- windows 10 or windows 11
- node.js 20 or newer
- rust stable
- webview2
- microsoft c++ build tools

clone the repository and install the javascript dependencies:

```bash
git clone https://github.com/Aaraghya/nook.git
cd nook
npm install
```

start the development version with:

```bash
npm run tauri dev
```

build a release version with:

```bash
npm run tauri build
```

for any questions / suggestions, hmu @ aaraghya1@gmail.com ! ty <3

the built application and installers will be generated inside:

```text
src-tauri/target/release/
```
