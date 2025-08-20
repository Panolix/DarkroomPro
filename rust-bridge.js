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
    
    if (format === 'json') {
        const jsonString = JSON.stringify(exportData, null, 2);
        if (filePath) {
            // In web version, trigger download
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filePath || 'calculation.json';
            a.click();
            URL.revokeObjectURL(url);
        }
        return jsonString;
    }
    
    throw new Error('Export format not supported in web version');
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