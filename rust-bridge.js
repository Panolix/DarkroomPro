// Rust Bridge - Interface between JavaScript UI and Rust backend
// This maintains backward compatibility while leveraging Rust for calculations

import { invoke as tauriInvoke, isTauri } from '@tauri-apps/api/core';
import { jsPDF } from 'jspdf';

const isDesktop = isTauri();

let invoke = null;
let rustBackendReady = false;
let rustDatabaseLoaded = false;
let rustDatabase = null;

let resolveDatabaseReady;
const databaseReady = new Promise(resolve => {
    resolveDatabaseReady = resolve;
});

async function initializeRustBackend() {
    if (!isDesktop) {
        console.log('🌐 Web environment detected - using JavaScript backend');
        resolveDatabaseReady(null);
        return;
    }

    try {
        invoke = tauriInvoke;
        rustDatabase = await invoke('load_database');
        rustBackendReady = true;
        rustDatabaseLoaded = true;
        console.log('✅ Rust database loaded:', rustDatabase);
        resolveDatabaseReady(rustDatabase);

        if (window.calculator && window.calculator.onRustBackendReady) {
            window.calculator.onRustBackendReady();
        }
    } catch (error) {
        console.error('❌ Failed to load Rust database, falling back to JavaScript:', error);
        resolveDatabaseReady(null);
    }
}

initializeRustBackend();

// Enhanced calculation function that uses Rust when available
async function calculateDevelopmentEnhanced(filmKey, developerKey, temperature, pushPull, volume) {
    if (rustBackendReady && invoke) {
        try {
            const request = {
                film_key: filmKey,
                developer_key: developerKey,
                temperature: parseFloat(temperature),
                push_pull: parseInt(pushPull),
                volume: parseInt(volume)
            };

            console.log('🦀 Using Rust calculation engine:', request);
            const result = await invoke('calculate_development', { request });
            console.log('✅ Rust calculation result:', result);

            // Convert Rust result to JavaScript format for compatibility
            return {
                time: parseFloat(result.time_minutes),
                dilution: result.dilution,
                developerAmount: result.developer_amount,
                waterAmount: result.water_amount,
                temperature: parseFloat(result.temperature),
                pushPull: result.push_pull,
                filmType: result.film_type,
                filmName: result.film_name,
                developerName: result.developer_name,
                notes: result.notes,
                timeFormatted: result.time_formatted,
                source: 'rust'
            };
        } catch (error) {
            console.error('❌ Rust calculation failed, falling back to JavaScript:', error);
        }
    }

    // Fallback to JavaScript calculation
    console.log('📜 Using JavaScript calculation engine');
    return null; // Let the original calculator handle it
}

// Enhanced film data fetching
async function getFilmsEnhanced() {
    if (rustBackendReady && invoke) {
        try {
            const films = await invoke('get_films');
            console.log('🦀 Got films from Rust:', Object.keys(films).length);
            return films;
        } catch (error) {
            console.error('❌ Failed to get films from Rust:', error);
        }
    }

    return null; // Fall back to JavaScript
}

// Enhanced developer data fetching
async function getDevelopersForFilmEnhanced(filmKey) {
    if (rustBackendReady && invoke) {
        try {
            const developers = await invoke('get_developers_for_film', { filmKey });
            console.log('🦀 Got developers from Rust for', filmKey, ':', developers.length);
            return developers;
        } catch (error) {
            console.error('❌ Failed to get developers from Rust:', error);
        }
    }

    return null; // Fall back to JavaScript
}

// Enhanced film info fetching
async function getFilmInfoEnhanced(filmKey) {
    if (rustBackendReady && invoke) {
        try {
            const filmInfo = await invoke('get_film_info', { filmKey });
            console.log('🦀 Got film info from Rust:', filmInfo.name);
            return filmInfo;
        } catch (error) {
            console.error('❌ Failed to get film info from Rust:', error);
        }
    }

    return null; // Fall back to JavaScript
}

// Enhanced developer info fetching
async function getDeveloperInfoEnhanced(developerKey) {
    if (rustBackendReady && invoke) {
        try {
            const developerInfo = await invoke('get_developer_info', { developerKey });
            console.log('🦀 Got developer info from Rust:', developerInfo.name);
            return developerInfo;
        } catch (error) {
            console.error('❌ Failed to get developer info from Rust:', error);
        }
    }

    return null; // Fall back to JavaScript
}

// Export calculation results
async function exportCalculationEnhanced(calculationResult, format = 'json', filePath = null) {
    const activeSteps = (window.developmentTimer && window.developmentTimer.getSteps)
        ? window.developmentTimer.getSteps()
        : (calculationResult.steps || []);

    if (rustBackendReady && invoke) {
        try {
            // Convert JavaScript result to Rust format if needed
            const rustResult = {
                time_minutes: calculationResult.time || calculationResult.time_minutes,
                time_formatted: calculationResult.timeFormatted || calculationResult.time_formatted,
                dilution: calculationResult.dilution,
                developer_amount: calculationResult.developerAmount || calculationResult.developer_amount,
                water_amount: calculationResult.waterAmount || calculationResult.water_amount,
                temperature: calculationResult.temperature,
                push_pull: calculationResult.pushPull || calculationResult.push_pull,
                film_type: calculationResult.filmType || calculationResult.film_type,
                film_name: calculationResult.filmName || calculationResult.film_name,
                developer_name: calculationResult.developerName || calculationResult.developer_name,
                notes: calculationResult.notes || [],
                steps: activeSteps.map(step => ({
                    name: step.name,
                    kind: step.kind || '',
                    time_minutes: step.time_minutes != null ? step.time_minutes : null,
                    temperature_c: step.temperature_c != null ? step.temperature_c : null
                }))
            };

            const result = await invoke('export_calculation', {
                calculation: rustResult,
                format: format,
                filePath: filePath
            });

            console.log('✅ Export successful:', result);
            return result;
        } catch (error) {
            console.error('❌ Export failed:', error);
            throw error;
        }
    }

    // Fallback for web version
    const timestamp = new Date().toISOString();
    const filename = filePath || `darkroom-calculation.${format}`;

    let blob;
    switch (format) {
        case 'json':
            blob = new Blob(
                [JSON.stringify({ calculation: calculationResult, steps: activeSteps, timestamp, format }, null, 2)],
                { type: 'application/json' }
            );
            break;

        case 'csv':
            blob = new Blob([generateCSV(calculationResult, activeSteps)], { type: 'text/csv' });
            break;

        case 'pdf':
            blob = generatePdfBlob(calculationResult, activeSteps);
            break;

        default:
            throw new Error(`Export format ${format} not supported`);
    }

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    return `Exported as ${format.toUpperCase()}`;
}

function formatStepTime(minutes) {
    if (minutes == null) return 'untimed';
    const totalSeconds = Math.round(minutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')} min`;
}

function generateCSV(results, steps = []) {
    const timestamp = new Date().toISOString();
    let csv = `Field,Value
Export Timestamp,${timestamp}
Film,${results.filmName || 'Unknown'}
Developer,${results.developerName || 'Unknown'}
Development Time,${results.timeFormatted || results.time + ' min'}
Temperature,${results.temperature}°C
Push/Pull,${results.pushPull || 0} stops
Dilution,${results.dilution}
Developer Amount,${results.developerAmount || 0} ml
Water Amount,${results.waterAmount || 0} ml
Notes,"${(results.notes || []).join('; ')}"`;

    if (steps.length > 0) {
        csv += '\n\nProcess Step,Name,Time,Temperature';
        steps.forEach((step, index) => {
            const temperature = step.temperature_c != null ? `${step.temperature_c} C` : '-';
            csv += `\n${index + 1},${step.name},${formatStepTime(step.time_minutes)},${temperature}`;
        });
    }

    return csv;
}

function reportLines(results, steps = []) {
    const lines = [
        'DARKROOM PRO - DEVELOPMENT CALCULATION REPORT',
        '=============================================',
        '',
        `Export Date: ${new Date().toISOString()}`,
        '',
        'FILM DETAILS:',
        `Film: ${results.filmName || 'Unknown'}`,
        `Type: ${results.filmType || 'Unknown'}`,
        '',
        'DEVELOPER DETAILS:',
        `Developer: ${results.developerName || 'Unknown'}`,
        `Dilution: ${results.dilution || 'N/A'}`,
        '',
        'CALCULATION PARAMETERS:',
        `Temperature: ${results.temperature}°C`,
        `Push/Pull: ${results.pushPull || 0} stops`,
        `Solution Volume: ${(results.developerAmount || 0) + (results.waterAmount || 0)} ml`,
        '',
        'RESULTS:',
        `Development Time: ${results.timeFormatted || results.time + ' min'}`,
        `Developer Amount: ${results.developerAmount || 0} ml`,
        `Water Amount: ${results.waterAmount || 0} ml`,
        ''
    ];

    if (steps.length > 0) {
        lines.push('PROCESS STEPS:');
        steps.forEach((step, index) => {
            const temperature = step.temperature_c != null ? ` @ ${step.temperature_c}°C` : '';
            lines.push(`${index + 1}. ${step.name} - ${formatStepTime(step.time_minutes)}${temperature}`);
        });
        lines.push('');
    }

    lines.push('NOTES:');

    const notes = results.notes || [];
    lines.push(...(notes.length > 0 ? notes : ['None']));
    lines.push('', 'Generated by DarkroomPro v1.0.5', 'Professional Film Development Calculator');

    return lines;
}

function generatePdfBlob(results, steps = []) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    let y = 20;
    for (const line of reportLines(results, steps)) {
        doc.text(line, 15, y);
        y += 6;
        if (y > 280) {
            doc.addPage();
            y = 20;
        }
    }

    return doc.output('blob');
}

// Utility function to check if Rust backend is available
function isRustBackendAvailable() {
    return isDesktop && rustBackendReady;
}

// Utility function to check if database is loaded
function isDatabaseReady() {
    return rustDatabaseLoaded || (window.filmDatabase && Object.keys(window.filmDatabase).length > 0);
}

// Export functions for global access
window.rustBridge = {
    calculateDevelopmentEnhanced,
    getFilmsEnhanced,
    getDevelopersForFilmEnhanced,
    getFilmInfoEnhanced,
    getDeveloperInfoEnhanced,
    exportCalculationEnhanced,
    isRustBackendAvailable,
    isDatabaseReady,
    isDesktop,
    whenDatabaseReady: () => databaseReady,
    getDatabase: () => rustDatabase
};

console.log('🌉 Rust bridge initialized');
