use crate::models::*;
use chrono::Utc;
use printpdf::*;
use rust_decimal::Decimal;
use serde_json;
use std::fs::{self, File};
use std::io::BufWriter;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ExportError {
    #[error("Failed to write file: {0}")]
    FileWriteError(#[from] std::io::Error),
    #[error("Failed to serialize data: {0}")]
    SerializationError(#[from] serde_json::Error),
    #[error("Unsupported export format: {0:?}")]
    UnsupportedFormat(ExportFormat),
    #[error("Invalid file path: {0}")]
    InvalidPath(String),
    #[error("Failed to generate PDF: {0}")]
    PdfError(String),
}

pub struct ExportManager;

impl ExportManager {
    pub fn new() -> Self {
        Self
    }

    pub fn export_calculation(
        &self,
        calculation: &CalculationResult,
        format: ExportFormat,
        output_path: &Path,
    ) -> Result<String, ExportError> {
        let timestamp = Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();

        let export_data = ExportData {
            calculation: calculation.clone(),
            timestamp: timestamp.clone(),
            format: format.clone(),
        };

        match format {
            ExportFormat::Json => self.export_json(&export_data, output_path),
            ExportFormat::Csv => self.export_csv(&export_data, output_path),
            ExportFormat::Pdf => self.export_pdf(&export_data, output_path),
        }
    }

    fn export_json(&self, data: &ExportData, output_path: &Path) -> Result<String, ExportError> {
        let json_content = serde_json::to_string_pretty(data)?;
        fs::write(output_path, &json_content)?;
        Ok(format!("Exported to JSON file: {}", output_path.display()))
    }

    fn export_csv(&self, data: &ExportData, output_path: &Path) -> Result<String, ExportError> {
        let calc = &data.calculation;

        let mut csv_content = String::new();
        csv_content.push_str("Field,Value\n");
        csv_content.push_str(&format!("Export Timestamp,{}\n", data.timestamp));
        csv_content.push_str(&format!("Film,{}\n", calc.film_name));
        csv_content.push_str(&format!("Developer,{}\n", calc.developer_name));
        csv_content.push_str(&format!("Film Type,{:?}\n", calc.film_type));
        csv_content.push_str(&format!("Development Time,{}\n", calc.time_formatted));
        csv_content.push_str(&format!("Development Time (minutes),{}\n", calc.time_minutes));
        csv_content.push_str(&format!("Temperature,{}°C\n", calc.temperature));
        csv_content.push_str(&format!("Push/Pull,{} stops\n", calc.push_pull));
        csv_content.push_str(&format!("Dilution,{}\n", calc.dilution));
        csv_content.push_str(&format!("Developer Amount,{} ml\n", calc.developer_amount));
        csv_content.push_str(&format!("Water Amount,{} ml\n", calc.water_amount));

        if !calc.notes.is_empty() {
            csv_content.push_str(&format!("Notes,\"{}\"\n", calc.notes.join("; ")));
        }

        if !calc.steps.is_empty() {
            csv_content.push_str("\nProcess Step,Name,Time,Temperature,Note\n");
            for (index, step) in calc.steps.iter().enumerate() {
                let time = match step.time_minutes {
                    Some(minutes) => format!("{} min", minutes.normalize()),
                    None => "untimed".to_string(),
                };
                let temperature = match step.temperature_c {
                    Some(temp) => format!("{} C", temp.normalize()),
                    None => "-".to_string(),
                };
                let note = step.note.clone().unwrap_or_default();
                csv_content.push_str(&format!(
                    "{},{},{},{},{}\n",
                    index + 1,
                    step.name,
                    time,
                    temperature,
                    note
                ));
            }
        }

        fs::write(output_path, &csv_content)?;
        Ok(format!("Exported to CSV file: {}", output_path.display()))
    }

    fn export_pdf(&self, data: &ExportData, output_path: &Path) -> Result<String, ExportError> {
        let (doc, first_page, first_layer) = PdfDocument::new(
            "DarkroomPro Development Report",
            Mm(210.0),
            Mm(297.0),
            "Report",
        );

        let font = doc
            .add_builtin_font(BuiltinFont::Helvetica)
            .map_err(|e| ExportError::PdfError(e.to_string()))?;

        let mut page_index = 0;
        let mut pages = vec![(first_page, first_layer)];
        let mut y = 277.0;

        for line in self.pdf_lines(data) {
            if y < 20.0 {
                let (page, layer) = doc.add_page(Mm(210.0), Mm(297.0), "Report");
                pages.push((page, layer));
                page_index += 1;
                y = 277.0;
            }

            let (page, layer) = pages[page_index].clone();
            let layer_ref = doc.get_page(page).get_layer(layer);
            layer_ref.use_text(line, 11.0, Mm(20.0), Mm(y), &font);
            y -= 6.0;
        }

        let file = File::create(output_path)?;
        doc.save(&mut BufWriter::new(file))
            .map_err(|e| ExportError::PdfError(e.to_string()))?;

        Ok(format!("Exported to PDF file: {}", output_path.display()))
    }

    fn pdf_lines(&self, data: &ExportData) -> Vec<String> {
        let calc = &data.calculation;

        let mut lines = vec![
            "DARKROOM PRO - DEVELOPMENT CALCULATION REPORT".to_string(),
            "=============================================".to_string(),
            String::new(),
            format!("Export Date: {}", data.timestamp),
            String::new(),
            "FILM DETAILS:".to_string(),
            format!("Film: {}", calc.film_name),
            format!("Type: {:?}", calc.film_type),
            String::new(),
            "DEVELOPER DETAILS:".to_string(),
            format!("Developer: {}", calc.developer_name),
            format!("Dilution: {}", calc.dilution),
            String::new(),
            "CALCULATION PARAMETERS:".to_string(),
            format!("Temperature: {}°C", calc.temperature),
            format!("Push/Pull: {} stops", calc.push_pull),
            format!("Solution Volume: {} ml", calc.developer_amount + calc.water_amount),
            String::new(),
            "RESULTS:".to_string(),
            format!("Development Time: {} ({} minutes)", calc.time_formatted, calc.time_minutes),
            format!("Developer Amount: {} ml", calc.developer_amount),
            format!("Water Amount: {} ml", calc.water_amount),
            String::new(),
        ];

        if !calc.steps.is_empty() {
            lines.push("PROCESS STEPS:".to_string());
            for (index, step) in calc.steps.iter().enumerate() {
                let time = match step.time_minutes {
                    Some(minutes) => {
                        let total_seconds = (minutes * Decimal::from(60)).round();
                        let mins = total_seconds / Decimal::from(60);
                        let secs = total_seconds % Decimal::from(60);
                        format!("{}:{:02} min", mins.floor(), secs)
                    }
                    None => "untimed".to_string(),
                };
                let temperature = match step.temperature_c {
                    Some(temp) => format!(" @ {}°C", temp.normalize()),
                    None => String::new(),
                };
                let note = match &step.note {
                    Some(note) if !note.is_empty() => format!(" [{}]", note),
                    _ => String::new(),
                };
                lines.push(format!("{}. {} - {}{}{}", index + 1, step.name, time, temperature, note));
            }
            lines.push(String::new());
        }

        lines.push("NOTES:".to_string());

        if calc.notes.is_empty() {
            lines.push("None".to_string());
        } else {
            lines.extend(calc.notes.iter().cloned());
        }

        lines.push(String::new());
        lines.push("Generated by DarkroomPro v1.1.0".to_string());
        lines.push("Professional Film Development Calculator".to_string());

        lines.into_iter().map(|line| sanitize_pdf_text(&line)).collect()
    }

    pub fn export_database_summary(
        &self,
        films: &[&Film],
        developers: &[&Developer],
        file_path: Option<String>,
    ) -> Result<String, ExportError> {
        let timestamp = Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();

        let mut content = String::new();
        content.push_str("DARKROOM PRO - DATABASE SUMMARY\n");
        content.push_str("===============================\n\n");
        content.push_str(&format!("Export Date: {}\n\n", timestamp));

        content.push_str(&format!("FILMS ({} total):\n", films.len()));
        content.push_str("----------------\n");
        for film in films {
            content.push_str(&format!(
                "• {} (ISO {}, {:?}) - {} developers available\n",
                film.name,
                film.iso,
                film.film_type,
                film.developers.len()
            ));
        }

        content.push_str(&format!("\n\nDEVELOPERS ({} total):\n", developers.len()));
        content.push_str("---------------------\n");
        for dev in developers {
            content.push_str(&format!(
                "• {} by {} ({})\n",
                dev.name,
                dev.manufacturer,
                dev.developer_type
            ));
        }

        content.push_str("\n\nGenerated by DarkroomPro v1.1.0\n");

        if let Some(path) = file_path {
            fs::write(&path, &content)?;
            Ok(format!("Database summary exported to: {}", path))
        } else {
            Ok(content)
        }
    }
}

fn sanitize_pdf_text(text: &str) -> String {
    text.chars()
        .map(|c| if (c as u32) <= 0xFF { c } else { '?' })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    fn sample_calculation() -> CalculationResult {
        CalculationResult {
            time_minutes: Decimal::new(80, 1),
            time_formatted: "8:00".to_string(),
            dilution: "Stock".to_string(),
            developer_amount: 500,
            water_amount: 0,
            temperature: Decimal::from(20),
            push_pull: 0,
            film_type: FilmType::BlackWhite,
            film_name: "Kodak Tri-X 400".to_string(),
            developer_name: "Kodak D-76".to_string(),
            notes: vec!["Test note".to_string()],
            steps: vec![
                ProcessStep {
                    name: "Developer".to_string(),
                    kind: "developer".to_string(),
                    time_minutes: Some(Decimal::new(80, 1)),
                    temperature_c: Some(Decimal::from(20)),
                    note: Some("Agitate 30s at start, then 10s every 1 min".to_string()),
                },
                ProcessStep {
                    name: "Rinse".to_string(),
                    kind: "wash".to_string(),
                    time_minutes: None,
                    temperature_c: None,
                    note: None,
                },
            ],
        }
    }

    #[test]
    fn exports_valid_pdf() {
        let path = std::env::temp_dir().join("darkroom-pro-export-test.pdf");
        let manager = ExportManager::new();

        let message = manager
            .export_calculation(&sample_calculation(), ExportFormat::Pdf, &path)
            .expect("pdf export should succeed");
        assert!(message.contains("PDF"));

        let bytes = fs::read(&path).expect("pdf should be readable");
        assert!(bytes.starts_with(b"%PDF"), "file should be a real PDF");

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn exports_csv_with_process_steps() {
        let path = std::env::temp_dir().join("darkroom-pro-export-test.csv");
        let manager = ExportManager::new();

        manager
            .export_calculation(&sample_calculation(), ExportFormat::Csv, &path)
            .expect("csv export should succeed");

        let content = fs::read_to_string(&path).expect("csv should be readable");
        assert!(content.contains("Process Step,Name,Time,Temperature"));
        assert!(content.contains("1,Developer,8 min,20 C"));
        assert!(content.contains("2,Rinse,untimed,-"));
        assert!(content.contains("Agitate 30s at start"));

        let _ = fs::remove_file(&path);
    }
}
