// DarkroomPro Calculator Engine - Enhanced with Complete Database
class DevelopmentCalculator {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.updateTemperatureDisplay();
        
        // Wait for database to load
        this.waitForDatabase();
    }
    
    waitForDatabase() {
        const checkDatabase = () => {
            if (Object.keys(filmDatabase).length > 0) {
                console.log('✅ Calculator: Database ready, populating UI');
                this.populateFilmOptions();
                this.updateFilmInfo();
                this.updateDeveloperInfo();
            } else {
                console.log('⏳ Calculator: Waiting for database...');
                setTimeout(checkDatabase, 100);
            }
        };
        checkDatabase();
    }
    
    onDatabaseLoaded() {
        console.log('✅ Calculator: Database loaded callback triggered');
        this.populateFilmOptions();
        this.updateFilmInfo();
        this.updateDeveloperInfo();
    }

    initializeElements() {
        this.filmSelect = document.getElementById('film-stock');
        this.developerSelect = document.getElementById('developer');
        this.temperatureInput = document.getElementById('temperature');
        this.pushPullSelect = document.getElementById('push-pull');
        this.volumeInput = document.getElementById('volume');
        this.calculateBtn = document.getElementById('calculate');
        
        // Result elements
        this.devTimeElement = document.getElementById('dev-time');
        this.timeNoteElement = document.getElementById('time-note');
        this.dilutionElement = document.getElementById('dilution');
        this.developerAmountElement = document.getElementById('developer-amount');
        this.waterAmountElement = document.getElementById('water-amount');
        this.tempDisplayElement = document.getElementById('temp-display');
        this.tempNoteElement = document.getElementById('temp-note');
        
        // Info elements
        this.filmDetailsElement = document.getElementById('film-details');
        this.developerDetailsElement = document.getElementById('developer-details');
        
        // Timer section
        this.timerSection = document.getElementById('timer-section');
    }

    bindEvents() {
        this.calculateBtn.addEventListener('click', () => this.calculate());
        this.filmSelect.addEventListener('change', () => this.updateFilmInfo());
        this.developerSelect.addEventListener('change', () => this.updateDeveloperInfo());
        this.temperatureInput.addEventListener('input', () => this.updateTemperatureDisplay());
        
        // Auto-calculate when inputs change
        [this.filmSelect, this.developerSelect, this.temperatureInput, this.pushPullSelect, this.volumeInput].forEach(element => {
            element.addEventListener('change', () => {
                if (this.filmSelect.value && this.developerSelect.value) {
                    this.calculate();
                }
            });
        });
        
        this.updateTemperatureDisplay();
    }
    
    populateFilmOptions() {
        console.log('🎬 Populating film options...');
        
        // Clear existing options
        this.filmSelect.innerHTML = '<option value="">Select Film Stock...</option>';
        
        // Group films by type
        const filmsByType = {
            'black_white': [],
            'color_negative': [],
            'slide': []
        };
        
        Object.entries(filmDatabase).forEach(([key, film]) => {
            const type = film.type || 'black_white';
            filmsByType[type].push({ key, film });
        });
        
        console.log('📊 Films by type:', {
            'black_white': filmsByType.black_white.length,
            'color_negative': filmsByType.color_negative.length,
            'slide': filmsByType.slide.length
        });
        
        // Add optgroups
        const typeNames = {
            'black_white': 'Black & White Films',
            'color_negative': 'Color Negative Films (C-41)',
            'slide': 'Slide Films (E-6)'
        };
        
        Object.entries(filmsByType).forEach(([type, films]) => {
            if (films.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = typeNames[type];
                
                films.sort((a, b) => a.film.name.localeCompare(b.film.name));
                films.forEach(({ key, film }) => {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = `${film.name} (ISO ${film.iso})`;
                    optgroup.appendChild(option);
                });
                
                this.filmSelect.appendChild(optgroup);
            }
        });
        
        console.log('✅ Film options populated');
    }

    updateFilmInfo() {
        const filmKey = this.filmSelect.value;
        if (!filmKey) {
            this.filmDetailsElement.textContent = 'Select a film stock to see details';
            this.updateDeveloperOptions([]);
            return;
        }

        const film = filmDatabase[filmKey];
        this.filmDetailsElement.innerHTML = `
            <div class="info-card-content">
                <div class="info-header">
                    <h3>${film.name}</h3>
                    <span class="iso-badge">ISO ${film.iso}</span>
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Manufacturer</span>
                        <span class="value">${film.manufacturer || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Type</span>
                        <span class="value">${this.getTypeDisplayName(film.type)}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Year Released</span>
                        <span class="value">${film.year_released || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Price (35mm)</span>
                        <span class="value">$${film.price_35mm_usd || 'N/A'}</span>
                    </div>
                </div>
                
                <div class="description">
                    <p>${film.description}</p>
                </div>
                
                <div class="characteristics">
                    <div class="char-item">
                        <span class="char-label">Grain:</span>
                        <span class="char-value">${film.grain ? film.grain.replace(/_/g, ' ') : 'Unknown'}</span>
                    </div>
                    <div class="char-item">
                        <span class="char-label">Contrast:</span>
                        <span class="char-value">${film.contrast ? film.contrast.replace(/_/g, ' ') : 'Unknown'}</span>
                    </div>
                    <div class="char-item">
                        <span class="char-label">Best Uses:</span>
                        <span class="char-value">${(film.best_uses || []).map(use => use.replace(/_/g, ' ')).join(', ')}</span>
                    </div>
                </div>
                
                ${film.alternative_names && film.alternative_names.length > 0 ? `
                    <div class="alternative-names">
                        <span class="label">Also known as:</span>
                        <span class="value">${film.alternative_names.join(', ')}</span>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Update available developers
        const availableDevelopers = Object.keys(film.developers || {});
        this.updateDeveloperOptions(availableDevelopers);
    }
    
    getTypeDisplayName(type) {
        const typeMap = {
            'black_white': 'Black & White',
            'color_negative': 'Color Negative (C-41)',
            'slide': 'Slide Film (E-6)'
        };
        return typeMap[type] || type;
    }
    
    updateDeveloperOptions(availableDevelopers) {
        console.log('🧪 Updating developer options:', availableDevelopers);
        
        // Clear existing options
        this.developerSelect.innerHTML = '<option value="">Select Developer...</option>';
        
        if (availableDevelopers.length === 0) {
            this.developerSelect.innerHTML = '<option value="">Select film first...</option>';
            return;
        }
        
        // Add available developers - prevent duplicates
        const addedDevelopers = new Set();
        
        availableDevelopers.forEach(devKey => {
            // Try exact match first
            let developer = developerDatabase[devKey];
            let displayKey = devKey;
            
            // If not found, try multiple base key patterns
            if (!developer) {
                // Try removing common suffixes
                let baseKey = devKey.replace(/_stock|_\d+_\d+|_[a-z]$|_kit$/g, '');
                developer = developerDatabase[baseKey];
                displayKey = baseKey;
                
                // If still not found, try even simpler patterns
                if (!developer) {
                    baseKey = devKey.split('_').slice(0, 2).join('_'); // Take first two parts
                    developer = developerDatabase[baseKey];
                    displayKey = baseKey;
                }
                
                console.log('🔄 Trying base key:', baseKey, 'for', devKey, developer ? '✅' : '❌');
            }
            
            console.log('🔍 Checking developer:', devKey, '→', displayKey, developer ? '✅' : '❌');
            if (developer && !addedDevelopers.has(developer.name)) {
                const option = document.createElement('option');
                option.value = devKey; // Keep original key for calculation
                option.textContent = developer.name;
                this.developerSelect.appendChild(option);
                addedDevelopers.add(developer.name);
                console.log('✅ Added developer option:', developer.name);
            } else if (addedDevelopers.has(developer?.name)) {
                console.log('⚠️ Skipping duplicate developer:', developer.name);
            } else {
                console.log('❌ Developer not found in database:', devKey, '(tried:', displayKey, ')');
            }
        });
        
        console.log('📊 Total developer options added:', this.developerSelect.options.length - 1);
    }

    updateDeveloperInfo() {
        const developerKey = this.developerSelect.value;
        if (!developerKey) {
            this.developerDetailsElement.textContent = 'Select a developer to see details';
            return;
        }

        const developer = developerDatabase[developerKey];
        this.developerDetailsElement.innerHTML = `
            <div class="info-card-content">
                <div class="info-header">
                    <h3>${developer.name}</h3>
                    <span class="type-badge">${developer.type}</span>
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Manufacturer</span>
                        <span class="value">${developer.manufacturer || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Year Introduced</span>
                        <span class="value">${developer.year_introduced || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Price per Liter</span>
                        <span class="value">$${developer.price_per_liter_usd || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Capacity</span>
                        <span class="value">${developer.capacity_rolls_per_liter || 'N/A'} rolls/L</span>
                    </div>
                </div>
                
                <div class="description">
                    <p>${developer.description}</p>
                </div>
                
                <div class="characteristics">
                    <div class="char-item">
                        <span class="char-label">Characteristics:</span>
                        <span class="char-value">${developer.characteristics ? developer.characteristics.replace(/_/g, ' ') : 'N/A'}</span>
                    </div>
                    ${developer.dilutions && developer.dilutions.length > 0 ? `
                        <div class="char-item">
                            <span class="char-label">Dilutions:</span>
                            <span class="char-value">${developer.dilutions.join(', ')}</span>
                        </div>
                    ` : ''}
                    <div class="char-item">
                        <span class="char-label">Shelf Life:</span>
                        <span class="char-value">Stock: ${developer.stock_life_months || 'N/A'} months, Working: ${developer.working_life_hours || 'N/A'} hours</span>
                    </div>
                </div>
                
                ${developer.safety_notes ? `
                    <div class="safety-warning">
                        <span class="safety-icon">⚠️</span>
                        <span class="safety-text">${developer.safety_notes}</span>
                    </div>
                ` : ''}
                
                ${developer.alternative_names && developer.alternative_names.length > 0 ? `
                    <div class="alternative-names">
                        <span class="label">Also known as:</span>
                        <span class="value">${developer.alternative_names.join(', ')}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    updateTemperatureDisplay() {
        const temp = parseFloat(this.temperatureInput.value);
        this.tempDisplayElement.textContent = `${temp}°C`;
        
        if (temp === 20) {
            this.tempNoteElement.textContent = 'Standard temperature';
            this.tempNoteElement.style.color = 'var(--success)';
        } else if (temp < 20) {
            this.tempNoteElement.textContent = `${20 - temp}°C below standard`;
            this.tempNoteElement.style.color = 'var(--warning)';
        } else {
            this.tempNoteElement.textContent = `${temp - 20}°C above standard`;
            this.tempNoteElement.style.color = 'var(--warning)';
        }
    }

    calculate() {
        const filmKey = this.filmSelect.value;
        const developerKey = this.developerSelect.value;
        const temperature = parseFloat(this.temperatureInput.value);
        const pushPull = parseFloat(this.pushPullSelect.value);
        const volume = parseFloat(this.volumeInput.value);

        if (!filmKey || !developerKey) {
            this.showError('Please select both film stock and developer');
            return;
        }

        const film = filmDatabase[filmKey];
        
        // Fix developer lookup - try the same logic as in updateDeveloperOptions
        let developer = developerDatabase[developerKey];
        if (!developer) {
            let baseKey = developerKey.replace(/_stock|_\d+_\d+|_[a-z]$|_kit$/g, '');
            developer = developerDatabase[baseKey];
            if (!developer) {
                baseKey = developerKey.split('_').slice(0, 2).join('_');
                developer = developerDatabase[baseKey];
            }
            console.log('🔄 Calculate: Using base key:', baseKey, 'for developer:', developerKey);
        }
        
        // Check if this film/developer combination exists
        if (!film.developers[developerKey]) {
            this.showError('This film/developer combination is not in our database');
            return;
        }

        const baseData = film.developers[developerKey];
        
        // Get base time based on film type
        let baseTime;
        if (film.type === 'black_white') {
            baseTime = baseData.time_minutes || baseData.time || 8.0;
        } else if (film.type === 'color_negative') {
            baseTime = baseData.developer_time_minutes || 3.25;
        } else if (film.type === 'slide') {
            baseTime = baseData.first_dev_time_minutes || 6.0;
        } else {
            baseTime = 8.0; // fallback
        }
        
        // Apply push/pull adjustments
        if (pushPull !== 0) {
            if (film.type === 'black_white') {
                if (pushPull === 1) baseTime = baseData.push_1_stop_minutes || baseTime * 1.4;
                else if (pushPull === 2) baseTime = baseData.push_2_stop_minutes || baseTime * 2.0;
                else if (pushPull === 3) baseTime = baseData.push_3_stop_minutes || baseTime * 2.8;
                else if (pushPull === -1) baseTime = baseData.pull_1_stop_minutes || baseTime * 0.7;
                else if (pushPull === -2) baseTime = baseData.pull_2_stop_minutes || baseTime * 0.5;
            } else if (film.type === 'color_negative') {
                if (pushPull === 1) baseTime = baseData.push_1_stop_dev_time || 4.5;
                else if (pushPull === 2) baseTime = baseData.push_2_stop_dev_time || 6.5;
                else if (pushPull === -1) baseTime = baseData.pull_1_stop_dev_time || 2.5;
            } else if (film.type === 'slide') {
                if (pushPull === 1) baseTime = baseData.push_1_stop_first_dev_time || 8.0;
                else if (pushPull === 2) baseTime = baseData.push_2_stop_first_dev_time || 10.0;
                else if (pushPull === -1) baseTime = baseData.pull_1_stop_first_dev_time || 4.5;
            }
        }
        
        // Calculate development time with temperature compensation
        const tempCompensation = this.getTemperatureCompensation(temperature);
        const adjustedTime = baseTime * tempCompensation;
        
        // Calculate dilution amounts - fix the data structure mismatch
        let dilutionString = baseData.dilution || baseData.dilution_ratio || 'stock';
        let developerAmount, waterAmount;
        
        console.log('💧 Dilution calculation:', { dilutionString, volume, filmType: film.type });
        
        if (film.type === 'black_white') {
            if (dilutionString === 'stock' || dilutionString === '1:0') {
                // Stock solution - use full volume
                developerAmount = volume;
                waterAmount = 0;
                dilutionString = 'Stock';
            } else {
                // Parse dilution ratio
                const dilutionRatio = this.parseDilution(dilutionString);
                const totalParts = dilutionRatio.developer + dilutionRatio.water;
                developerAmount = Math.round((volume * dilutionRatio.developer) / totalParts);
                waterAmount = volume - developerAmount;
            }
        } else {
            // For C-41 and E-6, it's typically ready-to-use kits
            dilutionString = 'Ready to use';
            developerAmount = volume;
            waterAmount = 0;
        }
        
        console.log('💧 Calculated amounts:', { developerAmount, waterAmount, dilutionString });
        
        // Update results
        this.updateResults({
            time: adjustedTime,
            dilution: dilutionString,
            developerAmount: Math.round(developerAmount),
            waterAmount: Math.round(waterAmount),
            temperature: temperature,
            pushPull: pushPull,
            filmType: film.type,
            filmName: film.name,
            developerName: developer.name
        });
        
        // Show timer section
        this.timerSection.style.display = 'block';
        
        // Initialize timer with calculated time
        if (window.developmentTimer) {
            window.developmentTimer.setDuration(adjustedTime * 60); // Convert to seconds
        }
    }

    getTemperatureCompensation(temperature) {
        // Round to nearest 0.5 degree for lookup
        const roundedTemp = Math.round(temperature * 2) / 2;
        
        // If exact temperature exists, use it
        if (temperatureCompensation[roundedTemp]) {
            return temperatureCompensation[roundedTemp];
        }
        
        // Otherwise interpolate between nearest values
        const lowerTemp = Math.floor(roundedTemp);
        const upperTemp = Math.ceil(roundedTemp);
        
        if (temperatureCompensation[lowerTemp] && temperatureCompensation[upperTemp]) {
            const factor = roundedTemp - lowerTemp;
            return temperatureCompensation[lowerTemp] + 
                   (temperatureCompensation[upperTemp] - temperatureCompensation[lowerTemp]) * factor;
        }
        
        // Fallback to 1.0 if temperature is out of range
        return 1.0;
    }

    parseDilution(dilutionString) {
        // Parse dilution ratios like "1:1", "1:31", etc.
        const parts = dilutionString.split(':');
        return {
            developer: parseInt(parts[0]),
            water: parseInt(parts[1])
        };
    }

    updateResults(results) {
        // Format time as MM:SS
        const minutes = Math.floor(results.time);
        const seconds = Math.round((results.time - minutes) * 60);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        this.devTimeElement.textContent = timeString;
        
        // Update time note based on film type and adjustments
        let timeNote = `${results.filmName} in ${results.developerName}`;
        if (results.filmType === 'color_negative') {
            timeNote += ' (C-41 Developer)';
        } else if (results.filmType === 'slide') {
            timeNote += ' (E-6 First Developer)';
        }
        
        if (results.temperature !== 20 || results.pushPull !== 0) {
            const adjustments = [];
            if (results.temperature !== 20) {
                adjustments.push(`${results.temperature}°C`);
            }
            if (results.pushPull !== 0) {
                const pushPullText = results.pushPull > 0 ? `+${results.pushPull}` : results.pushPull;
                adjustments.push(`${pushPullText} stops`);
            }
            timeNote += ` (${adjustments.join(', ')})`;
        }
        this.timeNoteElement.textContent = timeNote;
        
        // Update dilution
        this.dilutionElement.textContent = results.dilution;
        
        // Update solution amounts
        if (results.filmType === 'black_white') {
            this.developerAmountElement.textContent = `${results.developerAmount} ml developer`;
            this.waterAmountElement.textContent = `${results.waterAmount} ml water`;
        } else {
            this.developerAmountElement.textContent = `${results.developerAmount} ml kit solution`;
            this.waterAmountElement.textContent = results.waterAmount > 0 ? `${results.waterAmount} ml water` : 'Ready to use';
        }
        
        // Add animation to updated cards
        document.querySelectorAll('.result-card').forEach(card => {
            card.classList.add('updated');
            setTimeout(() => card.classList.remove('updated'), 500);
        });
    }

    showError(message) {
        this.devTimeElement.textContent = 'Error';
        this.timeNoteElement.textContent = message;
        this.dilutionElement.textContent = '--';
        this.developerAmountElement.textContent = '-- ml developer';
        this.waterAmountElement.textContent = '-- ml water';
        
        // Hide timer section
        this.timerSection.style.display = 'none';
    }
}

// Initialize calculator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.calculator = new DevelopmentCalculator();
});