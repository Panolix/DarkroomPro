use crate::models::*;
use serde_json;
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("Failed to read database file: {0}")]
    FileReadError(#[from] std::io::Error),
    #[error("Failed to parse database JSON: {0}")]
    ParseError(#[from] serde_json::Error),
    #[error("Database file not found at path: {0}")]
    FileNotFound(String),
    #[error("Invalid database structure: {0}")]
    InvalidStructure(String),
}

pub struct DatabaseManager {
    database: Option<Database>,
}

impl DatabaseManager {
    pub fn new() -> Self {
        Self { database: None }
    }

    pub fn load_from_file<P: AsRef<Path>>(&mut self, path: P) -> Result<(), DatabaseError> {
        let path_str = path.as_ref().to_string_lossy().to_string();
        
        if !path.as_ref().exists() {
            return Err(DatabaseError::FileNotFound(path_str));
        }

        let content = fs::read_to_string(path)?;
        let database: Database = serde_json::from_str(&content)?;
        
        // Validate database structure
        self.validate_database(&database)?;
        
        self.database = Some(database);
        Ok(())
    }

    pub fn load_from_json(&mut self, json_content: &str) -> Result<(), DatabaseError> {
        let database: Database = serde_json::from_str(json_content)?;
        self.validate_database(&database)?;
        self.database = Some(database);
        Ok(())
    }

    pub fn get_database(&self) -> Option<&Database> {
        self.database.as_ref()
    }

    pub fn take_database(self) -> Option<Database> {
        self.database
    }

    fn validate_database(&self, database: &Database) -> Result<(), DatabaseError> {
        if database.films.is_empty() {
            return Err(DatabaseError::InvalidStructure("No films found in database".to_string()));
        }

        if database.developers.is_empty() {
            return Err(DatabaseError::InvalidStructure("No developers found in database".to_string()));
        }

        if database.temperature_compensation.is_empty() {
            return Err(DatabaseError::InvalidStructure("No temperature compensation data found".to_string()));
        }

        // Validate that films have valid developer references
        for (film_key, film) in &database.films {
            if film.developers.is_empty() {
                return Err(DatabaseError::InvalidStructure(
                    format!("Film '{}' has no developer data", film_key)
                ));
            }

            // Check that film has valid film type
            match film.film_type {
                FilmType::BlackWhite | FilmType::ColorNegative | FilmType::Slide => {},
            }
        }

        Ok(())
    }

    pub fn get_stats(&self) -> Option<DatabaseStats> {
        self.database.as_ref().map(|db| {
            let total_combinations = db.films.values()
                .map(|film| film.developers.len())
                .sum();

            DatabaseStats {
                film_count: db.films.len(),
                developer_count: db.developers.len(),
                total_combinations,
                version: db.metadata.version.clone(),
                last_updated: db.metadata.last_updated.clone(),
            }
        })
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DatabaseStats {
    pub film_count: usize,
    pub developer_count: usize,
    pub total_combinations: usize,
    pub version: String,
    pub last_updated: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load_bundled_database() -> Database {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../complete_database.json");
        let content = fs::read_to_string(path).expect("bundled database should be readable");
        serde_json::from_str(&content).expect("bundled database should parse")
    }

    fn normalize_key(key: &str) -> String {
        key.chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .map(|c| c.to_ascii_lowercase())
            .collect()
    }

    #[test]
    fn parses_bundled_database() {
        let database = load_bundled_database();

        assert_eq!(database.films.len(), 46, "film count");
        assert_eq!(database.developers.len(), 18, "developer count");

        let combinations: usize = database
            .films
            .values()
            .map(|film| film.developers.len())
            .sum();
        assert_eq!(combinations, 366, "film/developer combinations");
    }

    #[test]
    fn every_combo_resolves_to_a_developer() {
        let database = load_bundled_database();

        for (film_key, film) in &database.films {
            for combo_key in film.developers.keys() {
                let normalized = normalize_key(combo_key);
                let resolved = database
                    .developers
                    .keys()
                    .any(|master| normalized.starts_with(&normalize_key(master)));
                assert!(
                    resolved,
                    "combo '{}' of film '{}' does not resolve to a developer",
                    combo_key, film_key
                );
            }
        }
    }

    #[test]
    fn every_combo_has_a_source() {
        let database = load_bundled_database();

        for (film_key, film) in &database.films {
            for (combo_key, combo) in &film.developers {
                assert!(
                    combo.source.as_deref().is_some_and(|s| !s.is_empty()),
                    "combo '{}' of film '{}' has no source",
                    combo_key, film_key
                );
            }
        }
    }

    #[test]
    fn color_combos_have_kit_temperature() {
        let database = load_bundled_database();

        for (film_key, film) in &database.films {
            if matches!(film.film_type, FilmType::BlackWhite) {
                continue;
            }
            for (combo_key, combo) in &film.developers {
                assert!(
                    combo.developer_temp_c.is_some() || combo.first_dev_temp_c.is_some(),
                    "color combo '{}' of film '{}' has no kit temperature",
                    combo_key, film_key
                );
            }
        }
    }

    #[test]
    fn kit_compositions_are_valid() {
        let database = load_bundled_database();

        for (film_key, film) in &database.films {
            for (combo_key, combo) in &film.developers {
                let has_blix = combo.blix_time_minutes.is_some();
                let has_bleach = combo.bleach_time_minutes.is_some();
                let has_fixer = combo.fixer_time_minutes.is_some();
                let has_reversal = combo.reversal_time_minutes.is_some();
                let has_stabilizer = combo.stabilizer_time_minutes.is_some();

                match film.film_type {
                    FilmType::BlackWhite => {}
                    FilmType::ColorNegative => {
                        assert!(combo.developer_time_minutes.is_some(), "{} / {} lacks a developer step", film_key, combo_key);
                        assert!(has_stabilizer, "{} / {} lacks a stabilizer step", film_key, combo_key);
                        let composition_ok = (has_blix && !has_bleach && !has_fixer)
                            || (!has_blix && has_bleach && has_fixer);
                        assert!(composition_ok, "{} / {} must use either blix or bleach+fixer", film_key, combo_key);
                    }
                    FilmType::Slide => {
                        assert!(combo.first_dev_time_minutes.is_some(), "{} / {} lacks a first developer step", film_key, combo_key);
                        assert!(combo.color_dev_time_minutes.is_some(), "{} / {} lacks a color developer step", film_key, combo_key);
                        assert!(has_stabilizer, "{} / {} lacks a stabilizer step", film_key, combo_key);
                        let six_bath = has_reversal && has_bleach && has_fixer && !has_blix;
                        let three_bath = has_blix && !has_reversal && !has_bleach && !has_fixer;
                        assert!(six_bath || three_bath, "{} / {} has an invalid E-6 bath layout", film_key, combo_key);
                    }
                }
            }
        }
    }

    #[test]
    fn black_and_white_times_are_consistent() {
        let database = load_bundled_database();

        for (film_key, film) in &database.films {
            if !matches!(film.film_type, FilmType::BlackWhite) {
                continue;
            }
            for (combo_key, combo) in &film.developers {
                let base = combo.time_minutes.expect("B&W combo needs a base time");
                assert!(base > rust_decimal::Decimal::ZERO, "{} / {} has a non-positive base time", film_key, combo_key);

                if let Some(p1) = combo.push_1_stop_minutes {
                    assert!(p1 > base, "{} / {} push 1 must exceed base", film_key, combo_key);
                }
                if let (Some(p1), Some(p2)) = (combo.push_1_stop_minutes, combo.push_2_stop_minutes) {
                    assert!(p2 >= p1, "{} / {} push times must increase", film_key, combo_key);
                }
                if let (Some(p2), Some(p3)) = (combo.push_2_stop_minutes, combo.push_3_stop_minutes) {
                    assert!(p3 >= p2, "{} / {} push times must increase", film_key, combo_key);
                }
                if let Some(pull1) = combo.pull_1_stop_minutes {
                    assert!(pull1 < base, "{} / {} pull 1 must be below base", film_key, combo_key);
                }
                if let (Some(pull1), Some(pull2)) = (combo.pull_1_stop_minutes, combo.pull_2_stop_minutes) {
                    assert!(pull2 <= pull1, "{} / {} pull times must decrease", film_key, combo_key);
                }
            }
        }
    }
}