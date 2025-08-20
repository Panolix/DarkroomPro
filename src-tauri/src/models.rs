use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use rust_decimal::Decimal;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Film {
    pub name: String,
    pub manufacturer: String,
    pub iso: u32,
    #[serde(rename = "type")]
    pub film_type: FilmType,
    pub process: String,
    pub year_released: Option<u32>,
    pub current_production: bool,
    pub price_35mm_usd: Option<Decimal>,
    pub alternative_names: Vec<String>,
    pub description: String,
    pub grain: String,
    pub contrast: String,
    pub best_uses: Vec<String>,
    pub developers: HashMap<String, DeveloperData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Developer {
    pub name: String,
    pub manufacturer: String,
    #[serde(rename = "type")]
    pub developer_type: String,
    pub year_introduced: Option<u32>,
    pub price_per_liter_usd: Option<Decimal>,
    pub capacity_rolls_per_liter: Option<u32>,
    pub description: String,
    pub characteristics: String,
    pub dilutions: Vec<String>,
    pub stock_life_months: Option<u32>,
    pub working_life_hours: Option<u32>,
    pub safety_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeveloperData {
    pub dilution: String,
    pub time_minutes: Option<Decimal>,
    pub time: Option<Decimal>,
    pub temperature_c: Decimal,
    pub agitation_initial_seconds: u32,
    pub agitation_interval_seconds: u32,
    pub agitation_frequency_minutes: u32,
    
    // Push/Pull times for B&W
    pub push_1_stop_minutes: Option<Decimal>,
    pub push_2_stop_minutes: Option<Decimal>,
    pub push_3_stop_minutes: Option<Decimal>,
    pub pull_1_stop_minutes: Option<Decimal>,
    pub pull_2_stop_minutes: Option<Decimal>,
    
    // Color negative specific
    pub developer_time_minutes: Option<Decimal>,
    pub push_1_stop_dev_time: Option<Decimal>,
    pub push_2_stop_dev_time: Option<Decimal>,
    pub pull_1_stop_dev_time: Option<Decimal>,
    
    // Slide film specific
    pub first_dev_time_minutes: Option<Decimal>,
    pub push_1_stop_first_dev_time: Option<Decimal>,
    pub push_2_stop_first_dev_time: Option<Decimal>,
    pub pull_1_stop_first_dev_time: Option<Decimal>,
    
    // Additional fields
    pub dilution_ratio: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilmType {
    BlackWhite,
    ColorNegative,
    Slide,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Database {
    pub films: HashMap<String, Film>,
    pub developers: HashMap<String, Developer>,
    pub temperature_compensation: HashMap<String, Decimal>,
    pub metadata: DatabaseMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseMetadata {
    pub version: String,
    pub last_updated: String,
    pub film_count: u32,
    pub developer_count: u32,
    pub total_combinations: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalculationRequest {
    pub film_key: String,
    pub developer_key: String,
    pub temperature: Decimal,
    pub push_pull: i32,
    pub volume: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalculationResult {
    pub time_minutes: Decimal,
    pub time_formatted: String,
    pub dilution: String,
    pub developer_amount: u32,
    pub water_amount: u32,
    pub temperature: Decimal,
    pub push_pull: i32,
    pub film_type: FilmType,
    pub film_name: String,
    pub developer_name: String,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DilutionRatio {
    pub developer: u32,
    pub water: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub calculation: CalculationResult,
    pub timestamp: String,
    pub format: ExportFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Pdf,
    Csv,
    Json,
}