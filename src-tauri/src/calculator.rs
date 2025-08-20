use crate::models::*;
use rust_decimal::Decimal;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CalculationError {
    #[error("Film not found: {0}")]
    FilmNotFound(String),
    #[error("Developer not found: {0}")]
    DeveloperNotFound(String),
    #[error("Film/developer combination not supported: {film} with {developer}")]
    CombinationNotSupported { film: String, developer: String },
    #[error("Invalid temperature: {0}°C (must be between 15-30°C)")]
    InvalidTemperature(Decimal),
    #[error("Invalid push/pull value: {0} (must be between -2 and +3)")]
    InvalidPushPull(i32),
    #[error("Invalid volume: {0}ml (must be between 100-2000ml)")]
    InvalidVolume(u32),
    #[error("Database not loaded")]
    DatabaseNotLoaded,
}

pub struct CalculationEngine {
    database: Option<Database>,
}

impl CalculationEngine {
    pub fn new() -> Self {
        Self { database: None }
    }

    pub fn load_database(&mut self, database: Database) {
        self.database = Some(database);
    }

    pub fn get_database(&self) -> Result<&Database, CalculationError> {
        self.database.as_ref().ok_or(CalculationError::DatabaseNotLoaded)
    }

    pub fn calculate_development(&self, request: CalculationRequest) -> Result<CalculationResult, CalculationError> {
        let database = self.get_database()?;
        
        // Validate inputs
        self.validate_inputs(&request)?;
        
        // Get film and developer
        let film = database.films.get(&request.film_key)
            .ok_or_else(|| CalculationError::FilmNotFound(request.film_key.clone()))?;
        
        let developer = self.find_developer(&database.developers, &request.developer_key)?;
        
        // Get developer data for this film
        let dev_data = self.find_developer_data(film, &request.developer_key)?;
        
        // Calculate base time
        let base_time = self.get_base_time(film, dev_data, request.push_pull)?;
        
        // Apply temperature compensation
        let temp_compensation = self.get_temperature_compensation(&database.temperature_compensation, request.temperature);
        let adjusted_time = base_time * temp_compensation;
        
        // Calculate dilution
        let (dilution_string, developer_amount, water_amount) = self.calculate_dilution(
            &dev_data.dilution,
            request.volume,
            &film.film_type,
        )?;
        
        // Format time
        let time_formatted = self.format_time(adjusted_time);
        
        // Generate notes
        let notes = self.generate_notes(film, developer, request.temperature, request.push_pull);
        
        Ok(CalculationResult {
            time_minutes: adjusted_time,
            time_formatted,
            dilution: dilution_string,
            developer_amount,
            water_amount,
            temperature: request.temperature,
            push_pull: request.push_pull,
            film_type: film.film_type.clone(),
            film_name: film.name.clone(),
            developer_name: developer.name.clone(),
            notes,
        })
    }

    fn validate_inputs(&self, request: &CalculationRequest) -> Result<(), CalculationError> {
        if request.temperature < Decimal::from(15) || request.temperature > Decimal::from(30) {
            return Err(CalculationError::InvalidTemperature(request.temperature));
        }
        
        if request.push_pull < -2 || request.push_pull > 3 {
            return Err(CalculationError::InvalidPushPull(request.push_pull));
        }
        
        if request.volume < 100 || request.volume > 2000 {
            return Err(CalculationError::InvalidVolume(request.volume));
        }
        
        Ok(())
    }

    fn find_developer<'a>(&self, developers: &'a HashMap<String, Developer>, developer_key: &str) -> Result<&'a Developer, CalculationError> {
        // Try exact match first
        if let Some(developer) = developers.get(developer_key) {
            return Ok(developer);
        }
        
        // Try removing common suffixes
        let base_key = developer_key
            .replace("_stock", "")
            .replace("_kit", "");
        
        if let Some(developer) = developers.get(&base_key) {
            return Ok(developer);
        }
        
        // Try removing all suffixes with regex-like pattern
        let parts: Vec<&str> = developer_key.split('_').collect();
        if parts.len() >= 2 {
            let simple_key = format!("{}_{}", parts[0], parts[1]);
            if let Some(developer) = developers.get(&simple_key) {
                return Ok(developer);
            }
        }
        
        Err(CalculationError::DeveloperNotFound(developer_key.to_string()))
    }

    fn find_developer_data<'a>(&self, film: &'a Film, developer_key: &str) -> Result<&'a DeveloperData, CalculationError> {
        // Try exact match first
        if let Some(data) = film.developers.get(developer_key) {
            return Ok(data);
        }
        
        // Try removing _stock suffix
        let base_key = developer_key.replace("_stock", "");
        if let Some(data) = film.developers.get(&base_key) {
            return Ok(data);
        }
        
        Err(CalculationError::CombinationNotSupported {
            film: film.name.clone(),
            developer: developer_key.to_string(),
        })
    }

    fn get_base_time(&self, film: &Film, dev_data: &DeveloperData, push_pull: i32) -> Result<Decimal, CalculationError> {
        let mut base_time = match film.film_type {
            FilmType::BlackWhite => {
                dev_data.time_minutes
                    .or(dev_data.time)
                    .unwrap_or(Decimal::from(8))
            },
            FilmType::ColorNegative => {
                dev_data.developer_time_minutes
                    .unwrap_or(Decimal::new(325, 2)) // 3.25
            },
            FilmType::Slide => {
                dev_data.first_dev_time_minutes
                    .unwrap_or(Decimal::from(6))
            },
        };

        // Apply push/pull adjustments
        if push_pull != 0 {
            base_time = match film.film_type {
                FilmType::BlackWhite => {
                    match push_pull {
                        1 => dev_data.push_1_stop_minutes.unwrap_or(base_time * Decimal::new(14, 1)), // 1.4
                        2 => dev_data.push_2_stop_minutes.unwrap_or(base_time * Decimal::from(2)),
                        3 => dev_data.push_3_stop_minutes.unwrap_or(base_time * Decimal::new(28, 1)), // 2.8
                        -1 => dev_data.pull_1_stop_minutes.unwrap_or(base_time * Decimal::new(7, 1)), // 0.7
                        -2 => dev_data.pull_2_stop_minutes.unwrap_or(base_time * Decimal::new(5, 1)), // 0.5
                        _ => base_time,
                    }
                },
                FilmType::ColorNegative => {
                    match push_pull {
                        1 => dev_data.push_1_stop_dev_time.unwrap_or(Decimal::new(45, 1)), // 4.5
                        2 => dev_data.push_2_stop_dev_time.unwrap_or(Decimal::new(65, 1)), // 6.5
                        -1 => dev_data.pull_1_stop_dev_time.unwrap_or(Decimal::new(25, 1)), // 2.5
                        _ => base_time,
                    }
                },
                FilmType::Slide => {
                    match push_pull {
                        1 => dev_data.push_1_stop_first_dev_time.unwrap_or(Decimal::from(8)),
                        2 => dev_data.push_2_stop_first_dev_time.unwrap_or(Decimal::from(10)),
                        -1 => dev_data.pull_1_stop_first_dev_time.unwrap_or(Decimal::new(45, 1)), // 4.5
                        _ => base_time,
                    }
                },
            };
        }

        Ok(base_time)
    }

    fn get_temperature_compensation(&self, temp_comp: &HashMap<String, Decimal>, temperature: Decimal) -> Decimal {
        // Round to nearest 0.5 degree for lookup
        let rounded_temp = (temperature * Decimal::from(2)).round() / Decimal::from(2);
        let temp_key = rounded_temp.to_string();
        
        // Try exact match
        if let Some(compensation) = temp_comp.get(&temp_key) {
            return *compensation;
        }
        
        // Try integer lookup
        let int_temp = rounded_temp.floor();
        let int_key = int_temp.to_string();
        if let Some(compensation) = temp_comp.get(&int_key) {
            return *compensation;
        }
        
        // Fallback interpolation between known values
        let lower_temp = int_temp;
        let upper_temp = int_temp + Decimal::from(1);
        
        let lower_key = lower_temp.to_string();
        let upper_key = upper_temp.to_string();
        
        if let (Some(lower_comp), Some(upper_comp)) = (temp_comp.get(&lower_key), temp_comp.get(&upper_key)) {
            let factor = rounded_temp - lower_temp;
            return lower_comp + (upper_comp - lower_comp) * factor;
        }
        
        // Default fallback
        Decimal::from(1)
    }

    fn calculate_dilution(&self, dilution_str: &str, volume: u32, film_type: &FilmType) -> Result<(String, u32, u32), CalculationError> {
        match film_type {
            FilmType::BlackWhite => {
                if dilution_str == "stock" || dilution_str == "1:0" {
                    Ok(("Stock".to_string(), volume, 0))
                } else {
                    let ratio = self.parse_dilution(dilution_str)?;
                    let total_parts = ratio.developer + ratio.water;
                    let developer_amount = (volume * ratio.developer) / total_parts;
                    let water_amount = volume - developer_amount;
                    Ok((dilution_str.to_string(), developer_amount, water_amount))
                }
            },
            FilmType::ColorNegative | FilmType::Slide => {
                Ok(("Ready to use".to_string(), volume, 0))
            },
        }
    }

    fn parse_dilution(&self, dilution_str: &str) -> Result<DilutionRatio, CalculationError> {
        let parts: Vec<&str> = dilution_str.split(':').collect();
        if parts.len() != 2 {
            return Ok(DilutionRatio { developer: 1, water: 0 }); // Default to stock
        }
        
        let developer = parts[0].parse::<u32>().unwrap_or(1);
        let water = parts[1].parse::<u32>().unwrap_or(0);
        
        Ok(DilutionRatio { developer, water })
    }

    fn format_time(&self, time_minutes: Decimal) -> String {
        let total_seconds = (time_minutes * Decimal::from(60)).round();
        let minutes = total_seconds / Decimal::from(60);
        let seconds = total_seconds % Decimal::from(60);
        
        format!("{}:{:02}", minutes.floor(), seconds)
    }

    fn generate_notes(&self, film: &Film, developer: &Developer, temperature: Decimal, push_pull: i32) -> Vec<String> {
        let mut notes = Vec::new();
        
        // Film type note
        match film.film_type {
            FilmType::ColorNegative => notes.push("C-41 Developer".to_string()),
            FilmType::Slide => notes.push("E-6 First Developer".to_string()),
            _ => {},
        }
        
        // Temperature note
        if temperature != Decimal::from(20) {
            notes.push(format!("Temperature adjusted for {}°C", temperature));
        }
        
        // Push/pull note
        if push_pull != 0 {
            let direction = if push_pull > 0 { "Push" } else { "Pull" };
            notes.push(format!("{} {} stop{}", direction, push_pull.abs(), if push_pull.abs() == 1 { "" } else { "s" }));
        }
        
        // Safety notes
        if let Some(safety) = &developer.safety_notes {
            notes.push(format!("Safety: {}", safety));
        }
        
        notes
    }

    pub fn get_available_films(&self) -> Result<Vec<&Film>, CalculationError> {
        let database = self.get_database()?;
        Ok(database.films.values().collect())
    }

    pub fn get_available_developers_for_film(&self, film_key: &str) -> Result<Vec<String>, CalculationError> {
        let database = self.get_database()?;
        let film = database.films.get(film_key)
            .ok_or_else(|| CalculationError::FilmNotFound(film_key.to_string()))?;
        
        Ok(film.developers.keys().cloned().collect())
    }

    pub fn get_film_info(&self, film_key: &str) -> Result<&Film, CalculationError> {
        let database = self.get_database()?;
        database.films.get(film_key)
            .ok_or_else(|| CalculationError::FilmNotFound(film_key.to_string()))
    }

    pub fn get_developer_info(&self, developer_key: &str) -> Result<&Developer, CalculationError> {
        let database = self.get_database()?;
        self.find_developer(&database.developers, developer_key)
    }
}