// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod calculator;
mod database;
mod export;

use tauri::{Manager, State};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use models::*;
use calculator::CalculationEngine;
use database::DatabaseManager;
use export::ExportManager;

// Global state for the calculation engine
type CalculationEngineState = Mutex<CalculationEngine>;
type SleepBlockState = Mutex<Option<keepawake::AwakeHandle>>;

// Command to load the film database
#[tauri::command]
async fn load_database(
    engine_state: State<'_, CalculationEngineState>,
    app_handle: tauri::AppHandle,
) -> Result<Database, String> {
    let mut db_manager = DatabaseManager::new();

    // Load from the bundled database file
    let resource_path = app_handle
        .path()
        .resolve("complete_database.json", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve resource path: {}", e))?;

    db_manager.load_from_file(&resource_path)
        .map_err(|e| format!("Failed to load database: {}", e))?;

    let database = db_manager.take_database()
        .ok_or("Failed to extract database")?;

    // Load into calculation engine
    let mut engine = engine_state.lock().unwrap();
    engine.load_database(database.clone());

    Ok(database)
}

// Command to get all available films
#[tauri::command]
async fn get_films(
    engine_state: State<'_, CalculationEngineState>,
) -> Result<HashMap<String, Film>, String> {
    let engine = engine_state.lock().unwrap();
    let database = engine.get_database()
        .map_err(|e| format!("Failed to get films: {}", e))?;

    Ok(database.films.clone())
}

// Command to get available developers for a specific film
#[tauri::command]
async fn get_developers_for_film(
    film_key: String,
    engine_state: State<'_, CalculationEngineState>,
) -> Result<Vec<String>, String> {
    let engine = engine_state.lock().unwrap();
    engine.get_available_developers_for_film(&film_key)
        .map_err(|e| format!("Failed to get developers: {}", e))
}

// Command to get film information
#[tauri::command]
async fn get_film_info(
    film_key: String,
    engine_state: State<'_, CalculationEngineState>,
) -> Result<Film, String> {
    let engine = engine_state.lock().unwrap();
    let film = engine.get_film_info(&film_key)
        .map_err(|e| format!("Failed to get film info: {}", e))?;

    Ok(film.clone())
}

// Command to get developer information
#[tauri::command]
async fn get_developer_info(
    developer_key: String,
    engine_state: State<'_, CalculationEngineState>,
) -> Result<Developer, String> {
    let engine = engine_state.lock().unwrap();
    let developer = engine.get_developer_info(&developer_key)
        .map_err(|e| format!("Failed to get developer info: {}", e))?;

    Ok(developer.clone())
}

// Command to calculate development parameters
#[tauri::command]
async fn calculate_development(
    request: CalculationRequest,
    engine_state: State<'_, CalculationEngineState>,
) -> Result<CalculationResult, String> {
    let engine = engine_state.lock().unwrap();
    engine.calculate_development(request)
        .map_err(|e| format!("Calculation failed: {}", e))
}

// Command to export calculation results
#[tauri::command]
async fn export_calculation(
    app_handle: tauri::AppHandle,
    calculation: CalculationResult,
    format: ExportFormat,
    file_path: Option<String>,
) -> Result<String, String> {
    let output_path = resolve_export_path(&app_handle, &format, file_path.as_deref());
    let export_manager = ExportManager::new();
    export_manager.export_calculation(&calculation, format, &output_path)
        .map_err(|e| format!("Export failed: {}", e))
}

fn export_extension(format: &ExportFormat) -> &'static str {
    match format {
        ExportFormat::Json => "json",
        ExportFormat::Csv => "csv",
        ExportFormat::Pdf => "pdf",
    }
}

// Resolve a safe export destination for user-generated files
fn resolve_export_path(
    app_handle: &tauri::AppHandle,
    format: &ExportFormat,
    file_path: Option<&str>,
) -> PathBuf {
    let directory = app_handle
        .path()
        .download_dir()
        .or_else(|_| app_handle.path().document_dir())
        .or_else(|_| app_handle.path().home_dir())
        .unwrap_or_else(|_| std::env::temp_dir());

    let _ = std::fs::create_dir_all(&directory);

    let file_name = file_path
        .and_then(|path| Path::new(path).file_name())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
            PathBuf::from(format!(
                "darkroom-calculation-{}.{}",
                timestamp,
                export_extension(format)
            ))
        });

    directory.join(file_name)
}

// Command to prevent or allow display/idle sleep while the timer runs
#[tauri::command]
async fn set_sleep_block(
    state: State<'_, SleepBlockState>,
    enabled: bool,
) -> Result<(), String> {
    let mut guard = state.lock().unwrap();
    if enabled {
        if guard.is_none() {
            let keep_awake = keepawake::Builder::default()
                .display(true)
                .idle(true)
                .reason("Development timer running")
                .app_name("DarkroomPro")
                .app_reverse_domain("com.panolix.darkroompro")
                .create()
                .map_err(|e| e.to_string())?;
            *guard = Some(keep_awake);
        }
    } else {
        *guard = None;
    }
    Ok(())
}

// Command to toggle fullscreen on the main window (darkroom focus mode)
#[tauri::command]
async fn set_fullscreen(
    app_handle: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    let window = app_handle
        .get_webview_window("main")
        .or_else(|| app_handle.webview_windows().values().next().cloned())
        .ok_or("Main window not found")?;
    window.set_fullscreen(enabled).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(CalculationEngineState::new(CalculationEngine::new()))
        .manage(SleepBlockState::new(None))
        .invoke_handler(tauri::generate_handler![
            load_database,
            get_films,
            get_developers_for_film,
            get_film_info,
            get_developer_info,
            calculate_development,
            export_calculation,
            set_sleep_block,
            set_fullscreen
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
