// Rust Bridge - Interface between JavaScript UI and Rust backend
// This maintains backward compatibility while leveraging Rust for calculations

// Check if we're running in Tauri (desktop) or web environment
const isDesktop = window.__TAURI__ !== undefined;

// Import Tauri API if available
let invoke = null;
if (isDesktop) {
    import('@tauri-apps/api/tauri').then(module => {
        invoke = module.invoke;
        console.log('✅ Tauri API loaded - using Rust backend');
        initializeRustBackend();
    }).catch(err => {
        console.warn('⚠️ Failed to load Tauri API, falling back to JavaScript:', err);
    });
} else {
    console.log('🌐 Web environment detected - using JavaScript backend');
}

// Global state
let rustBackendReady = false;
let rustDatabaseLoaded = false;

// Initialize Rust backend
async function initializeRustBackend() {
    if (!invoke) return false;
    
    try {
        const result = await invoke('load_database');
        console.log('✅ Rust database loaded:', result);
        rustBackendReady = true;
        rustDatabaseLoaded = true;
        
        // Notify the calculator that the backend is ready
        if (window.calculator && window.calculator.onRustBackendReady) {
            window.calculator.onRustBackendReady();
        }
        
        return true;
    } catch (error) {
        console.error('❌ Failed to load Rust database:', error);
        return false;
    }
}

// Enhanced calculation function that uses Rust when available
async function calculateDevelopmentEnhanced(filmKey, developerKey, temperature, pushPull, volume) {
    if (isDesktop && rustBackendReady && invoke) {
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
                filmType: result.film_type.toLowerCase().replace('_', '_'), // Convert enum
                filmName: result.film_name,
                developerName: result.developer_name,
                notes: result.notes,
                timeFormatted: result.time_formatted,
                source: 'rust'
            };
        } catch (error) {
            console.error('❌ Rust calculation failed, falling back to JavaScript:', error);
            // Fall through to JavaScript calculation
        }
    }
    
    // Fallback to JavaScript calculation
    console.log('📜 Using JavaScript calculation engine');
    return null; // Let the original calculator handle it
}

// Enhanced film data fetching
async function getFilmsEnhanced() {
    if (isDesktop && rustBackendReady && invoke) {
        try {
            const films = await invoke('get_films');
            console.log('🦀 Got films from Rust:', films.length);
            return films;
        } catch (error) {
            console.error('❌ Failed to get films from Rust:', error);
        }
    }
    
    return null; // Fall back to JavaScript
}

// Enhanced developer data fetching
async function getDevelopersForFilmEnhanced(filmKey) {
    if (isDesktop && rustBackendReady && invoke) {
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
    if (isDesktop && rustBackendReady && invoke) {
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
    if (isDesktop && rustBackendReady && invoke) {
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
    if (isDesktop && rustBackendReady && invoke) {
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
                notes: calculationResult.notes || []
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
    const exportData = {
        calculation: calculationResult,
        timestamp: new Date().toISOString(),
        format: format
    };
    
    let content, mimeType, filename;
    
    switch (format) {
        case 'json':
            content = JSON.stringify(exportData, null, 2);
            mimeType = 'application/json';
            filename = filePath || 'calculation.json';
            break;
            
        case 'csv':
            content = generateCSV(calculationResult);
            mimeType = 'text/csv';
            filename = filePath || 'calculation.csv';
            break;
            
        case 'txt':
            content = generatePDF(calculationResult);
            mimeType = 'text/plain';
            filename = filePath || 'calculation.txt';
            break;
            
        default:
            throw new Error(`Export format ${format} not supported`);
    }
    
    // Trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    return `Exported as ${format.toUpperCase()}`;

function generateCSV(results) {
    const timestamp = new Date().toISOString();
    return `Field,Value
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
}

function generatePDF(results) {
    const timestamp = new Date().toISOString();
    return `DARKROOM PRO - DEVELOPMENT CALCULATION REPORT
=============================================

Export Date: ${timestamp}

FILM DETAILS:
Film: ${results.filmName || 'Unknown'}
Type: ${results.filmType || 'Unknown'}

DEVELOPER DETAILS:
Developer: ${results.developerName || 'Unknown'}
Dilution: ${results.dilution}

CALCULATION PARAMETERS:
Temperature: ${results.temperature}°C
Push/Pull: ${results.pushPull || 0} stops
Solution Volume: ${(results.developerAmount || 0) + (results.waterAmount || 0)} ml

RESULTS:
Development Time: ${results.timeFormatted || results.time + ' min'}
Developer Amount: ${results.developerAmount || 0} ml
Water Amount: ${results.waterAmount || 0} ml

NOTES:
${(results.notes || []).length > 0 ? (results.notes || []).join('\n') : 'None'}

Generated by DarkroomPro v1.0.2
Professional Film Development Calculator`;
}
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
    isDesktop
};

console.log('🌉 Rust bridge initialized');