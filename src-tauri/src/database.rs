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