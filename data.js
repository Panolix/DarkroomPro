// Film Development Database - Complete Professional Database
window.filmDatabase = {};
window.developerDatabase = {};
window.temperatureCompensation = {};
window.pushPullCompensation = {};
window.agitationPatterns = {};
window.processes = {};

// Also keep local references
let filmDatabase = window.filmDatabase;
let developerDatabase = window.developerDatabase;
let temperatureCompensation = window.temperatureCompensation;
let pushPullCompensation = window.pushPullCompensation;
let agitationPatterns = window.agitationPatterns;
let processes = window.processes;

// Set up push/pull compensation
pushPullCompensation = {
    '-2': 0.5,   // Pull 2 stops
    '-1': 0.7,   // Pull 1 stop
    '0': 1.0,    // Normal
    '1': 1.4,    // Push 1 stop
    '2': 2.0,    // Push 2 stops
    '3': 2.8     // Push 3 stops
};

// Load the complete database
window.loadDatabase = async function loadDatabase() {
    try {
        let data;
        
        // Check if we're in Tauri (desktop app) and use Rust backend
        if (window.__TAURI__ && window.rustBridge) {
            console.log('🦀 Loading database from Rust backend...');
            try {
                const { invoke } = await import('@tauri-apps/api/tauri');
                const result = await invoke('load_database');
                console.log('✅ Rust database loaded:', result);
                
                // Get films and developers from Rust
                const films = await invoke('get_films');
                const filmDatabase_temp = {};
                
                // Convert films array to object format
                films.forEach(film => {
                    filmDatabase_temp[film.key] = film;
                });
                
                data = {
                    films: filmDatabase_temp,
                    developers: {}, // Will be populated as needed
                    temperature_compensation: {
                        15: 1.8, 16: 1.6, 17: 1.45, 18: 1.3, 19: 1.15,
                        20: 1.0, 21: 0.9, 22: 0.8, 23: 0.72, 24: 0.65,
                        25: 0.6, 26: 0.55, 27: 0.5, 28: 0.46, 29: 0.42, 30: 0.38
                    }
                };
                console.log('✅ Database loaded from Rust backend');
            } catch (rustError) {
                console.warn('⚠️ Rust backend failed, trying fetch fallback:', rustError);
                // Fallback to fetch
                const response = await fetch('./complete_database.json');
                data = await response.json();
                console.log('✅ Database loaded from fetch fallback');
            }
        } else {
            console.log('🌐 Loading database from web fetch...');
            // Fallback for web mode
            const response = await fetch('./complete_database.json');
            data = await response.json();
            console.log('✅ Database loaded from web fetch');
        }
        
        filmDatabase = window.filmDatabase = data.films || {};
        developerDatabase = window.developerDatabase = data.developers || {};
        temperatureCompensation = window.temperatureCompensation = data.temperature_compensation || {
            15: 1.8, 16: 1.6, 17: 1.45, 18: 1.3, 19: 1.15,
            20: 1.0, 21: 0.9, 22: 0.8, 23: 0.72, 24: 0.65,
            25: 0.6, 26: 0.55, 27: 0.5, 28: 0.46, 29: 0.42, 30: 0.38
        };
        agitationPatterns = data.agitation_patterns || {};
        processes = data.processes || {};
        
        console.log('✅ Database loaded successfully:', {
            films: Object.keys(filmDatabase).length,
            developers: Object.keys(developerDatabase).length
        });
        
        // Trigger calculator initialization
        if (window.calculator) {
            window.calculator.onDatabaseLoaded();
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error loading database:', error);
        
        // Fallback to minimal data
        filmDatabase = {
            'kodak_tri_x_400': {
                name: 'Kodak Tri-X 400',
                iso: 400,
                type: 'black_white',
                description: 'Classic high-speed black and white film',
                developers: {
                    'kodak_d76_stock': { 
                        time_minutes: 8.0, 
                        dilution: 'stock', 
                        temperature_c: 20 
                    }
                }
            }
        };
        
        return false;
    }
}

// Initialize database loading and wait for it
let databaseLoaded = false;
window.loadDatabase().then(() => {
    databaseLoaded = true;
    console.log('🎯 Database loading completed, triggering UI update');
    if (window.calculator) {
        window.calculator.onDatabaseLoaded();
    }
}).catch(error => {
    console.error('💥 Database loading failed:', error);
    databaseLoaded = false;
});
