# Doodle

A simple drawing app for Windows 11, made for the Surface Pro 11 with Surface Pen,
for a person with an intellectual disability. Everything is one tap away – no menus.

- Blank white sheet, 10 colours always visible, eraser, undo, clear.
- Three colouring pages (teddy bear, guitar, shoe) with one tap.
- Drawings are saved automatically as PNG (when clearing, when picking a colouring page and when stopping).
- After a restart the person continues with the previous drawing.
- English and Dutch. The language follows Windows by default; the caregiver can override it.

## For the caregiver

- **Settings**: press and hold the small circle at the bottom of the button column for **3 seconds**.
  There you choose the save folder, language, left/right-handed, drawing with a finger on/off,
  and check for and install updates.
- **Default save folder**: `Pictures\Drawings` (English) or `Afbeeldingen\Tekeningen` (Dutch).
  A folder you pick yourself never changes with the language.
- **Installing**: download `Doodle_<version>_arm64-setup.exe` (Surface Pro 11) or
  `..._x64-setup.exe` (other PCs) from the GitHub release page.
  Windows first shows "Windows protected your PC" → **More info** → **Run anyway**.
  The installer picks English or Dutch based on the Windows language.
- **Pin to taskbar**: Windows does not allow installers to do this. After installing:
  right-click the *Doodle* desktop icon → *Show more options* → *Pin to taskbar*.

## Development

```bash
npm install
npm run preview          # browser preview: http://localhost:8080
npx tauri dev            # real app (requires Rust + system libraries)
```

| Path | Contents |
|---|---|
| `src/` | The app (HTML/CSS/JS, no bundler) |
| `src/i18n.js` | All user-visible text, English and Dutch |
| `src/pages/*.svg` | Colouring pages (black lines, `fill="none"`). To add one: put the SVG here, add its id to `PAGES` in `app.js` and a `page.<id>` name to `i18n.js`. |
| `src-tauri/` | Native Windows shell (Rust): saving, settings, updates, landscape lock |
| `.github/workflows/release.yml` | Builds the installers (ARM64 + x64) and publishes updates |

### Adding a language

1. Add a block to `MESSAGES` and a name to `LANGUAGE_NAMES` in `src/i18n.js`.
2. Add a radio button to the language section in `src/index.html`.
3. Map it in `resolve_language` / `system_language` and add its default folder name in
   `default_save_dir` in `src-tauri/src/lib.rs`.
4. Add the NSIS language to `bundle.windows.nsis.languages` in `src-tauri/tauri.conf.json`.

## One-time release setup

1. Create a **public** GitHub repository and push this folder.
2. The update URL in `src-tauri/tauri.conf.json` points to `TJannes/doodle-app`; change it if the repository moves.
3. Under *Settings → Secrets and variables → Actions*, add the secret
   `TAURI_SIGNING_PRIVATE_KEY` with the contents of `~/.tauri/doodle.key`.

   ⚠️ Keep `~/.tauri/doodle.key` safe (e.g. in a password manager). If you lose it,
   existing installations can no longer receive updates.

## Releasing a new version

1. Bump the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `package.json`.
2. `git commit -am "v0.1.1" && git tag v0.1.1 && git push && git push --tags`
3. GitHub Actions builds and publishes (~15 min). Then in the app: settings →
   **Check for updates** → **Install**.
