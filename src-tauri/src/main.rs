// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod calculator;
mod database;
mod export;

use tauri::{Manager, State};
use std::sync::Mutex;
use models::*;
use calculator::CalculationEngine;
use database::DatabaseManager;
use export::ExportManager;

// Global state for the calculation engine
type CalculationEngineState = Mutex<CalculationEngine>;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Command to load the film database
#[tauri::command]
async fn load_database(
    engine_state: State<'_, CalculationEngineState>,
    app_handle: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    let mut db_manager = DatabaseManager::new();
    
    // Try to load from the bundled database file
    let resource_path = app_handle
        .path()
        .resolve("complete_database.json", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve resource path: {}", e))?;
    
    db_manager.load_from_file(&resource_path)
        .map_err(|e| format!("Failed to load database: {}", e))?;
    
    let database = db_manager.take_database()
        .ok_or("Failed to extract database")?;
    
    let stats = database.metadata.clone();
    
    // Load into calculation engine
    let mut engine = engine_state.lock().unwrap();
    engine.load_database(database);
    
    Ok(serde_json::json!({
        "status": "success",
        "message": "Database loaded successfully",
        "stats": {
            "film_count": stats.film_count,
            "developer_count": stats.developer_count,
            "total_combinations": stats.total_combinations,
            "version": stats.version,
            "last_updated": stats.last_updated
        }
    }))
}

// Command to get all available films
#[tauri::command]
async fn get_films(
    engine_state: State<'_, CalculationEngineState>,
) -> Result<Vec<Film>, String> {
    let engine = engine_state.lock().unwrap();
    let films = engine.get_available_films()
        .map_err(|e| format!("Failed to get films: {}", e))?;
    
    Ok(films.into_iter().cloned().collect())
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

// Command to save user preferences
#[tauri::command]
async fn save_preferences(preferences: serde_json::Value) -> Result<String, String> {
    // TODO: Implement local storage for user preferences
    println!("Saving preferences: {}", preferences);
    Ok("Preferences saved successfully".to_string())
}

// Command to export calculation results
#[tauri::command]
async fn export_calculation(
    calculation: CalculationResult,
    format: ExportFormat,
    file_path: Option<String>,
) -> Result<String, String> {
    let export_manager = ExportManager::new();
    export_manager.export_calculation(&calculation, format, file_path)
        .map_err(|e| format!("Export failed: {}", e))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(CalculationEngineState::new(CalculationEngine::new()))
        .invoke_handler(tauri::generate_handler![
            greet,
            load_database,
            get_films,
            get_developers_for_film,
            get_film_info,
            get_developer_info,
            calculate_development,
            save_preferences,
            export_calculation
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}