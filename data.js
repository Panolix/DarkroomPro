// Film Development Database - Complete Professional Database
let filmDatabase = {};
let developerDatabase = {};
let temperatureCompensation = {};
let pushPullCompensation = {};
let agitationPatterns = {};
let processes = {};

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
async function loadDatabase() {
    try {
        const response = await fetch('./complete_database.json');
        const data = await response.json();
        
        filmDatabase = data.films || {};
        developerDatabase = data.developers || {};
        temperatureCompensation = data.temperature_compensation || {
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

// Initialize database loading
loadDatabase();
