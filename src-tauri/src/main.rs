// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Command to get film database
#[tauri::command]
fn get_film_database() -> serde_json::Value {
    // This will be loaded from a local JSON file in the future
    serde_json::json!({
        "status": "success",
        "message": "Film database loaded successfully"
    })
}

// Command to save user preferences
#[tauri::command]
fn save_preferences(preferences: serde_json::Value) -> Result<String, String> {
    // TODO: Implement local storage for user preferences
    println!("Saving preferences: {}", preferences);
    Ok("Preferences saved successfully".to_string())
}

// Command to export calculation results
#[tauri::command]
fn export_calculation(data: serde_json::Value) -> Result<String, String> {
    // TODO: Implement export functionality (PDF, CSV)
    println!("Exporting calculation: {}", data);
    Ok("Calculation exported successfully".to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_film_database,
            save_preferences,
            export_calculation
        ])
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}