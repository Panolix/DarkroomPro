use crate::models::*;
use rust_decimal::Decimal;
use std::collections::HashMap;
use thiserror::Error;

fn normalize_key(key: &str) -> String {
    key.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

// Massive Dev Chart push guideline, used when a combination has no published EI
// row. Compensating developers = Microphen / T-Max developer; T-Max films use
// Kodak's reduced push increments. Returns (push1, push2, push3, pull1, pull2).
fn push_pull_factors(film: &Film, developer: &Developer) -> (Decimal, Decimal, Decimal, Decimal, Decimal) {
    let film_name = film.name.to_lowercase();
    let dev_name = developer.name.to_lowercase();
    let is_tmax_film = film_name.contains("t-max") || film_name.contains("tmax");
    let is_compensating = dev_name.contains("microphen") || dev_name.contains("t-max");

    let (p1, p2, p3) = if is_tmax_film {
        (Decimal::from(1), Decimal::new(133, 2), Decimal::new(166, 2))
    } else if is_compensating {
        (Decimal::new(14, 1), Decimal::new(185, 2), Decimal::new(25, 1))
    } else {
        (Decimal::new(15, 1), Decimal::new(225, 2), Decimal::new(45, 1))
    };
    (p1, p2, p3, Decimal::new(7, 1), Decimal::new(5, 1))
}

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

        // Get film and developer
        let film = database.films.get(&request.film_key)
            .ok_or_else(|| CalculationError::FilmNotFound(request.film_key.clone()))?;

        // Validate inputs (temperature range depends on the film type)
        self.validate_inputs(&request, film)?;
        
        let developer = self.find_developer(&database.developers, &request.developer_key)?;
        
        // Get developer data for this film
        let dev_data = self.find_developer_data(film, &request.developer_key)?;
        
        // Calculate base time
        let base_time = self.get_base_time(film, developer, dev_data, request.push_pull)?;
        
        // Temperature compensation: B&W always; colour kits only when the kit
        // publishes a time/temperature table (stored on the developer).
        let temp_compensation = {
            let table = if !developer.temperature_compensation.is_empty() {
                Some(&developer.temperature_compensation)
            } else if matches!(film.film_type, FilmType::BlackWhite) {
                Some(&database.temperature_compensation)
            } else {
                None
            };
            match table {
                Some(table) => self.get_temperature_compensation(table, request.temperature),
                None => Decimal::from(1),
            }
        };
        let adjusted_time = base_time * temp_compensation;
        
        // Calculate dilution
        let dilution_str = dev_data.dilution.clone().unwrap_or_else(|| "stock".to_string());
        let (dilution_string, developer_amount, water_amount) = self.calculate_dilution(
            &dilution_str,
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
            steps: Vec::new(),
        })
    }

    fn validate_inputs(&self, request: &CalculationRequest, film: &Film) -> Result<(), CalculationError> {
        // B&W development is temperature-compensated within 15-30°C.
        // Color processes (C-41/E-6) run at their kit temperature (approx. 38°C).
        if matches!(film.film_type, FilmType::BlackWhite)
            && (request.temperature < Decimal::from(15) || request.temperature > Decimal::from(30))
        {
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

        // Fall back to normalized prefix matching (handles dilution suffixes)
        let normalized = normalize_key(developer_key);
        let mut best_match: Option<&Developer> = None;
        let mut best_length = 0;

        for (key, developer) in developers {
            let normalized_master = normalize_key(key);
            if normalized.starts_with(&normalized_master) && normalized_master.len() > best_length {
                best_match = Some(developer);
                best_length = normalized_master.len();
            }
        }

        best_match.ok_or_else(|| CalculationError::DeveloperNotFound(developer_key.to_string()))
    }

    fn find_developer_data<'a>(&self, film: &'a Film, developer_key: &str) -> Result<&'a DeveloperData, CalculationError> {
        // Try exact match first
        if let Some(data) = film.developers.get(developer_key) {
            return Ok(data);
        }

        // Fall back to normalized matching (either direction may include suffixes)
        let normalized = normalize_key(developer_key);
        let mut best_match: Option<&DeveloperData> = None;
        let mut best_length = 0;

        for (key, data) in &film.developers {
            let normalized_key = normalize_key(key);
            let matches = normalized.starts_with(&normalized_key) || normalized_key.starts_with(&normalized);
            if matches && normalized_key.len() > best_length {
                best_match = Some(data);
                best_length = normalized_key.len();
            }
        }

        best_match.ok_or_else(|| CalculationError::CombinationNotSupported {
            film: film.name.clone(),
            developer: developer_key.to_string(),
        })
    }

    fn get_base_time(&self, film: &Film, developer: &Developer, dev_data: &DeveloperData, push_pull: i32) -> Result<Decimal, CalculationError> {
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
                    let (p1, p2, p3, q1, q2) = push_pull_factors(film, developer);
                    match push_pull {
                        1 => dev_data.push_1_stop_minutes.unwrap_or(base_time * p1),
                        2 => dev_data.push_2_stop_minutes.unwrap_or(base_time * p2),
                        3 => dev_data.push_3_stop_minutes.unwrap_or(base_time * p3),
                        -1 => dev_data.pull_1_stop_minutes.unwrap_or(base_time * q1),
                        -2 => dev_data.pull_2_stop_minutes.unwrap_or(base_time * q2),
                        _ => base_time,
                    }
                },
                FilmType::ColorNegative => {
                    match push_pull {
                        1 => dev_data.push_1_stop_dev_time.unwrap_or(Decimal::new(45, 1)), // 4.5
                        2 => dev_data.push_2_stop_dev_time.unwrap_or(Decimal::new(65, 1)), // 6.5
                        3 => dev_data.push_3_stop_dev_time.unwrap_or(Decimal::from(9)), // 9.0
                        -1 => dev_data.pull_1_stop_dev_time.unwrap_or(Decimal::new(25, 1)), // 2.5
                        -2 => dev_data.pull_2_stop_dev_time.unwrap_or(Decimal::from(2)), // 2.0
                        _ => base_time,
                    }
                },
                FilmType::Slide => {
                    match push_pull {
                        1 => dev_data.push_1_stop_first_dev_time.unwrap_or(Decimal::from(8)),
                        2 => dev_data.push_2_stop_first_dev_time.unwrap_or(Decimal::from(10)),
                        3 => dev_data.push_3_stop_first_dev_time.unwrap_or(Decimal::from(12)),
                        -1 => dev_data.pull_1_stop_first_dev_time.unwrap_or(Decimal::new(45, 1)), // 4.5
                        -2 => dev_data.pull_2_stop_first_dev_time.unwrap_or(Decimal::new(35, 1)), // 3.5
                        _ => base_time,
                    }
                },
            };
        }

        Ok(base_time)
    }

    fn get_temperature_compensation(&self, temp_comp: &HashMap<String, Decimal>, temperature: Decimal) -> Decimal {
        if temp_comp.is_empty() {
            return Decimal::from(1);
        }

        // Round to nearest 0.5 degree
        let rounded_temp = (temperature * Decimal::from(2)).round() / Decimal::from(2);

        // Collect numeric keys so tables with integer OR half-degree keys work.
        let mut keys: Vec<Decimal> = temp_comp
            .keys()
            .filter_map(|key| key.parse::<Decimal>().ok())
            .collect();
        if keys.is_empty() {
            return Decimal::from(1);
        }
        keys.sort();

        // Exact match first
        if let Some(exact) = keys.iter().find(|key| **key == rounded_temp) {
            if let Some(compensation) = temp_comp.get(&exact.to_string()) {
                return *compensation;
            }
        }

        // Interpolate between the surrounding keys; clamp at the table edges.
        let lower = keys.iter().rev().find(|key| **key < rounded_temp).copied();
        let upper = keys.iter().find(|key| **key > rounded_temp).copied();

        match (lower, upper) {
            (Some(lo), Some(hi)) => {
                let lo_value = temp_comp.get(&lo.to_string()).copied().unwrap_or_else(|| Decimal::from(1));
                let hi_value = temp_comp.get(&hi.to_string()).copied().unwrap_or_else(|| Decimal::from(1));
                let factor = (rounded_temp - lo) / (hi - lo);
                lo_value + (hi_value - lo_value) * factor
            }
            (Some(lo), None) => temp_comp.get(&lo.to_string()).copied().unwrap_or_else(|| Decimal::from(1)),
            (None, Some(hi)) => temp_comp.get(&hi.to_string()).copied().unwrap_or_else(|| Decimal::from(1)),
            (None, None) => Decimal::from(1),
        }
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
            FilmType::ColorNegative => {
                notes.push("C-41 Developer".to_string());
                notes.push(format!("Kit temperature: {}°C", temperature));
            },
            FilmType::Slide => {
                notes.push("E-6 First Developer".to_string());
                notes.push(format!("Kit temperature: {}°C", temperature));
            },
            _ => {},
        }

        // Temperature compensation note (B&W always; colour when the kit has a table)
        let bw_adjusted = matches!(film.film_type, FilmType::BlackWhite) && temperature != Decimal::from(20);
        if bw_adjusted {
            notes.push(format!("Temperature adjusted for {}°C", temperature));
        }
        if !developer.temperature_compensation.is_empty() || bw_adjusted {
            if let Some(source) = &developer.temperature_compensation_source {
                notes.push(format!("Temperature compensation: {}", source));
            }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CalculationRequest, Database, FilmType};

    fn temperature_table() -> HashMap<String, Decimal> {
        let mut table = HashMap::new();
        table.insert("19".to_string(), Decimal::new(110, 2)); // 1.10
        table.insert("20".to_string(), Decimal::from(1)); // 1.00
        table.insert("21".to_string(), Decimal::new(90, 2)); // 0.90
        table.insert("22".to_string(), Decimal::new(82, 2)); // 0.82
        table
    }

    #[test]
    fn temperature_compensation_interpolates_half_degrees() {
        let engine = CalculationEngine::new();
        let table = temperature_table();

        // 20.5C should interpolate between 20 (1.00) and 21 (0.90) => 0.95
        assert_eq!(
            engine.get_temperature_compensation(&table, Decimal::new(205, 1)),
            Decimal::new(95, 2)
        );
        // Exact integer match still works
        assert_eq!(
            engine.get_temperature_compensation(&table, Decimal::from(21)),
            Decimal::new(90, 2)
        );
        // Out of range clamps to the nearest known key (here 22 -> 0.82)
        assert_eq!(
            engine.get_temperature_compensation(&table, Decimal::from(30)),
            Decimal::new(82, 2)
        );
    }

    fn color_combo() -> DeveloperData {
        let mut data = DeveloperData::default();
        data.developer_time_minutes = Some(Decimal::new(325, 2)); // 3.25
        data.push_1_stop_dev_time = Some(Decimal::new(45, 1)); // 4.5
        data.push_2_stop_dev_time = Some(Decimal::new(65, 1)); // 6.5
        data.pull_1_stop_dev_time = Some(Decimal::new(25, 1)); // 2.5
        data
    }

    fn slide_combo() -> DeveloperData {
        let mut data = DeveloperData::default();
        data.first_dev_time_minutes = Some(Decimal::from(6));
        data.push_1_stop_first_dev_time = Some(Decimal::from(8));
        data.push_2_stop_first_dev_time = Some(Decimal::from(10));
        data.pull_1_stop_first_dev_time = Some(Decimal::new(45, 1)); // 4.5
        data
    }

    #[test]
    fn color_negative_supports_all_push_pull_stops() {
        let engine = CalculationEngine::new();
        let film = Film {
            film_type: FilmType::ColorNegative,
            ..Default::default()
        };
        let data = color_combo();

        assert_eq!(engine.get_base_time(&film, &Developer::default(), &data, 0).unwrap(), Decimal::new(325, 2));
        assert_eq!(engine.get_base_time(&film, &Developer::default(), &data, 1).unwrap(), Decimal::new(45, 1));
        assert_eq!(engine.get_base_time(&film, &Developer::default(), &data, 2).unwrap(), Decimal::new(65, 1));
        // Push 3 / Pull 2 fall back to sensible defaults
        assert_eq!(engine.get_base_time(&film, &Developer::default(), &data, 3).unwrap(), Decimal::from(9));
        assert_eq!(engine.get_base_time(&film, &Developer::default(), &data, -2).unwrap(), Decimal::from(2));
    }

    #[test]
    fn slide_supports_all_push_pull_stops() {
        let engine = CalculationEngine::new();
        let film = Film {
            film_type: FilmType::Slide,
            ..Default::default()
        };
        let data = slide_combo();

        assert_eq!(engine.get_base_time(&film, &Developer::default(), &data, 0).unwrap(), Decimal::from(6));
        assert_eq!(engine.get_base_time(&film, &Developer::default(), &data, 1).unwrap(), Decimal::from(8));
        assert_eq!(engine.get_base_time(&film, &Developer::default(), &data, 2).unwrap(), Decimal::from(10));
        assert_eq!(engine.get_base_time(&film, &Developer::default(), &data, 3).unwrap(), Decimal::from(12));
        assert_eq!(engine.get_base_time(&film, &Developer::default(), &data, -2).unwrap(), Decimal::new(35, 1));
    }

    #[test]
    fn calculates_from_bundled_database() {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../complete_database.json");
        let content = std::fs::read_to_string(path).expect("bundled database readable");
        let database: Database = serde_json::from_str(&content).expect("bundled database parses");

        let mut engine = CalculationEngine::new();
        engine.load_database(database);

        let calc = |film: &str, dev: &str, temp: i64, push_pull: i32| {
            engine.calculate_development(CalculationRequest {
                film_key: film.to_string(),
                developer_key: dev.to_string(),
                temperature: Decimal::from(temp),
                push_pull,
                volume: 500,
            })
        };

        // Tri-X 400 / D-76 stock, box speed, 20C => 6.75 min, stock
        let r = calc("kodak_tri_x_400", "kodak_d76_stock", 20, 0).unwrap();
        assert_eq!(r.time_minutes, Decimal::new(675, 2));
        assert_eq!(r.dilution, "Stock");

        // 24C applies the D-76 factor 0.69 (interpolated/table) => 6.75 * 0.69
        let r24 = calc("kodak_tri_x_400", "kodak_d76_stock", 24, 0).unwrap();
        assert_eq!(r24.time_minutes, Decimal::new(675, 2) * Decimal::new(69, 2));

        // HP5 Plus / ID-11 stock, +1 stop => researched 10.5 min
        let rp = calc("ilford_hp5_plus", "ilford_id11_stock", 20, 1).unwrap();
        assert_eq!(rp.time_minutes, Decimal::new(105, 1));

        // C-41 Portra 400 / Kodak Flexicolor, +2 stops => 4.25 min ready-to-use
        let rc = calc("kodak_portra_400", "kodak_flexicolor_c41", 38, 2).unwrap();
        assert_eq!(rc.time_minutes, Decimal::new(425, 2));
        assert_eq!(rc.dilution, "Ready to use");

        // E-6 Velvia 50, -2 stops => 3.5 min
        let re = calc("fuji_velvia_50", "kodak_e6_kit", 38, -2).unwrap();
        assert_eq!(re.time_minutes, Decimal::new(35, 1));

        // Colour temperature: CineStill CS41 at 24C => 3.5 * 10 = 35 min
        let rcool = calc("kodak_portra_400", "cinestill_c41_kit", 24, 0).unwrap();
        assert_eq!(rcool.time_minutes, Decimal::new(350, 1));

        // Kodak Flexicolor has no temperature table => time unchanged off-standard
        let rk = calc("kodak_portra_400", "kodak_flexicolor_c41", 30, 0).unwrap();
        assert_eq!(rk.time_minutes, Decimal::new(325, 2));

        // No published push for T-Max 100 / D-76 1+1: T-Max film guideline => +1 = no change
        let rtf = calc("kodak_tmax_100", "kodak_d76_1_1", 20, 1).unwrap();
        assert_eq!(rtf.time_minutes, Decimal::new(95, 1));

        // No published push for Fomapan 100 / D-76 1+3: standard guideline => +1 = *1.5
        let rff = calc("fomapan_100", "kodak_d76_1_3", 20, 1).unwrap();
        assert_eq!(rff.time_minutes, Decimal::new(255, 1));
    }
}