//! Doodle – native shell: persistence, settings, updates and orientation lock.
//!
//! Errors returned to the frontend are short codes (e.g. `invalid_file_name`),
//! optionally followed by `: <detail>`. The frontend translates the code.

use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{
    ipc::{InvokeBody, Request, Response},
    AppHandle, Manager,
};

/// Settings the caregiver can change.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
struct Settings {
    /// Custom folder for drawings. `None` = default folder for the active language.
    save_dir: Option<String>,
    finger_drawing: bool,
    left_handed: bool,
    /// `"auto"` (follow Windows), `"en"` or `"nl"`.
    language: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            save_dir: None,
            finger_drawing: true,
            left_handed: false,
            language: "auto".into(),
        }
    }
}

/// Settings plus values derived from them, as shown in the app.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsView {
    #[serde(flatten)]
    settings: Settings,
    /// Language actually in use: `"en"` or `"nl"`.
    resolved_language: String,
    /// Language Windows is set to: `"en"` or `"nl"`.
    system_language: String,
    /// Folder drawings are saved to right now.
    effective_save_dir: String,
}

/// State needed to continue drawing after a restart.
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct SessionMeta {
    /// Selected colouring page (e.g. "teddy"), or `None` for a blank sheet.
    page: Option<String>,
    /// File name this drawing was already saved under (overwrite instead of duplicating).
    file_name: Option<String>,
}

fn io_err<E: std::fmt::Display>(e: E) -> String {
    format!("io_error: {e}")
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(io_err)?;
    fs::create_dir_all(&dir).map_err(io_err)?;
    Ok(dir)
}

/// Windows display language reduced to the languages we support.
fn system_language() -> &'static str {
    match sys_locale::get_locale() {
        Some(locale) if locale.to_lowercase().starts_with("nl") => "nl",
        _ => "en",
    }
}

fn resolve_language(settings: &Settings) -> &'static str {
    match settings.language.as_str() {
        "nl" => "nl",
        "en" => "en",
        _ => system_language(),
    }
}

/// Default: the real Windows "Pictures" folder (also follows OneDrive redirection).
fn default_save_dir(language: &str) -> PathBuf {
    let folder = if language == "nl" { "Tekeningen" } else { "Drawings" };
    dirs::picture_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_default()
        .join(folder)
}

fn effective_save_dir(settings: &Settings) -> PathBuf {
    settings
        .save_dir
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| default_save_dir(resolve_language(settings)))
}

fn read_json<T: for<'de> Deserialize<'de> + Default>(path: &Path) -> T {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Write to a temporary file first and then rename, so an interruption
/// (e.g. the Surface powering off) never leaves a half-written file.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, bytes).map_err(io_err)?;
    fs::rename(&tmp, path).map_err(io_err)
}

fn read_settings(app: &AppHandle) -> Result<Settings, String> {
    Ok(read_json(&data_dir(app)?.join("settings.json")))
}

fn raw_body(request: &Request<'_>) -> Result<Vec<u8>, String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes.clone()),
        _ => Err("expected_binary".into()),
    }
}

fn is_safe_file_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() < 120
        && name.ends_with(".png")
        && !name.contains("..")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '-' | '_' | '.'))
}

#[tauri::command]
fn get_settings(app: AppHandle) -> Result<SettingsView, String> {
    let settings = read_settings(&app)?;
    Ok(SettingsView {
        resolved_language: resolve_language(&settings).into(),
        system_language: system_language().into(),
        effective_save_dir: effective_save_dir(&settings).to_string_lossy().into_owned(),
        settings,
    })
}

#[tauri::command]
fn set_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&settings).map_err(io_err)?;
    write_atomic(&data_dir(&app)?.join("settings.json"), json.as_bytes())
}

/// Save the drawing as PNG in the save folder. Returns the full path.
#[tauri::command]
fn save_drawing(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing_file_name")?
        .to_string();
    if !is_safe_file_name(&name) {
        return Err("invalid_file_name".into());
    }
    let bytes = raw_body(&request)?;
    let dir = effective_save_dir(&read_settings(&app)?);
    fs::create_dir_all(&dir).map_err(io_err)?;
    let path = dir.join(&name);
    write_atomic(&path, &bytes)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn save_session_image(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let bytes = raw_body(&request)?;
    write_atomic(&data_dir(&app)?.join("session.png"), &bytes)
}

#[tauri::command]
fn save_session_meta(app: AppHandle, meta: SessionMeta) -> Result<(), String> {
    let json = serde_json::to_string(&meta).map_err(io_err)?;
    write_atomic(&data_dir(&app)?.join("session.json"), json.as_bytes())
}

#[tauri::command]
fn load_session_meta(app: AppHandle) -> Result<SessionMeta, String> {
    Ok(read_json(&data_dir(&app)?.join("session.json")))
}

#[tauri::command]
fn load_session_image(app: AppHandle) -> Result<Response, String> {
    let bytes = fs::read(data_dir(&app)?.join("session.png")).unwrap_or_default();
    Ok(Response::new(bytes))
}

#[tauri::command]
fn clear_session_image(app: AppHandle) -> Result<(), String> {
    let path = data_dir(&app)?.join("session.png");
    if path.exists() {
        fs::remove_file(path).map_err(io_err)?;
    }
    Ok(())
}

/// Open the save folder in Explorer (for the caregiver).
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(io_err)?;
    #[cfg(windows)]
    let program = "explorer";
    #[cfg(not(windows))]
    let program = "xdg-open";
    std::process::Command::new(program)
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(io_err)
}

/// Keep the screen in landscape while the app is in the foreground.
#[cfg(windows)]
fn lock_landscape() {
    #[link(name = "user32")]
    extern "system" {
        fn SetDisplayAutoRotationPreferences(orientation: u32) -> i32;
    }
    const ORIENTATION_PREFERENCE_LANDSCAPE: u32 = 0x1;
    const ORIENTATION_PREFERENCE_LANDSCAPE_FLIPPED: u32 = 0x4;
    unsafe {
        SetDisplayAutoRotationPreferences(
            ORIENTATION_PREFERENCE_LANDSCAPE | ORIENTATION_PREFERENCE_LANDSCAPE_FLIPPED,
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    lock_landscape();

    tauri::Builder::default()
        // Tapping the icon twice focuses the existing window instead of opening a second one.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_settings,
            save_drawing,
            save_session_image,
            save_session_meta,
            load_session_meta,
            load_session_image,
            clear_session_image,
            open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Doodle");
}
