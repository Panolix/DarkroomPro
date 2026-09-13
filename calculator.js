// Global function to clean up text display
function cleanText(text) {
    if (!text) return text;
    return text.toString().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

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
        let attempts = 0;
        const maxAttempts = 30; // Wait up to 15 seconds
        
        const checkDatabase = () => {
            attempts++;
            const dbReady = window.rustBridge?.isDatabaseReady() || 
                           Object.keys(filmDatabase).length > 0 ||
                           Object.keys(window.filmDatabase || {}).length > 0;
            
            console.log(`🔍 Database check ${attempts}/${maxAttempts}:`, {
                rustReady: window.rustBridge?.isDatabaseReady(),
                filmDatabaseKeys: Object.keys(filmDatabase).length,
                windowFilmDatabaseKeys: Object.keys(window.filmDatabase || {}).length,
                dbReady
            });
            
            if (dbReady) {
                console.log('✅ Calculator: Database ready, populating UI');
                // Ensure we're using the populated database
                if (Object.keys(filmDatabase).length === 0 && Object.keys(window.filmDatabase || {}).length > 0) {
                    console.log('🔄 Syncing window database to local variables');
                    filmDatabase = window.filmDatabase;
                    developerDatabase = window.developerDatabase;
                }
                this.populateFilmOptions();
                this.updateFilmInfo();
                this.updateDeveloperInfo();
            } else if (attempts < maxAttempts) {
                console.log(`⏳ Calculator: Waiting for database... (${attempts}/${maxAttempts})`);
                setTimeout(checkDatabase, 500);
            } else {
                console.error('❌ Calculator: Database failed to load after maximum attempts');
                this.filmSelect.innerHTML = '<option value="">Database failed to load</option>';
                this.developerSelect.innerHTML = '<option value="">Database failed to load</option>';
            }
        };
        
        checkDatabase();
    }
    
    // Called when Rust backend is ready
    onRustBackendReady() {
        console.log('✅ Calculator: Rust backend ready, refreshing UI');
        this.populateFilmOptions();
        this.updateFilmInfo();
        this.updateDeveloperInfo();
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
        this.exportBtn = document.getElementById('export');
        this.exportSection = document.getElementById('export-section');
        this.exportFormatSelect = document.getElementById('export-format');
        
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
        this.exportBtn.addEventListener('click', () => this.exportResults());
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
        
        // Enable the dropdown
        this.filmSelect.disabled = false;
        
        // Clear existing options
        this.filmSelect.innerHTML = '<option value="">Select Film Stock...</option>';
        
        // Check if database is actually loaded
        if (!filmDatabase || Object.keys(filmDatabase).length === 0) {
            console.warn('⚠️ Film database is empty, cannot populate options');
            this.filmSelect.innerHTML = '<option value="">Database not loaded</option>';
            this.filmSelect.disabled = true;
            return;
        }
        
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
        
        console.log('✅ Film options populated and dropdown enabled');
    }

    updateFilmInfo() {
        const filmKey = this.filmSelect.value;
        console.log('🎬 updateFilmInfo called with filmKey:', filmKey);
        console.log('🎬 Current filmDatabase state:', {
            keys: Object.keys(filmDatabase).length,
            hasFilmKey: !!filmDatabase[filmKey],
            filmDatabase: filmDatabase
        });
        
        if (!filmKey) {
            console.log('🎬 No film key, clearing info');
            this.filmDetailsElement.textContent = 'Select a film stock to see details';
            this.updateDeveloperOptions([]);
            return;
        }

        const film = filmDatabase[filmKey];
        console.log('🎬 Found film:', film ? film.name : 'NOT FOUND');
        this.filmDetailsElement.innerHTML = `
            <div class="info-card-content">
                <div class="info-header">
                    <h3>${film.name}</h3>
                    <span class="iso-badge">ISO ${film.iso}</span>
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Manufacturer</span>
                        <span class="value">${cleanText(film.manufacturer) || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Type</span>
                        <span class="value">${cleanText(this.getTypeDisplayName(film.type))}</span>
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
                        <span class="char-value">${cleanText(film.grain) || 'Unknown'}</span>
                    </div>
                    <div class="char-item">
                        <span class="char-label">Contrast:</span>
                        <span class="char-value">${cleanText(film.contrast) || 'Unknown'}</span>
                    </div>
                    <div class="char-item">
                        <span class="char-label">Best Uses:</span>
                        <span class="char-value">${(film.best_uses || []).map(use => cleanText(use)).join(', ')}</span>
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
        console.log('🎬 Available developers for', film.name, ':', availableDevelopers);
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
        
        // Enable the dropdown
        this.developerSelect.disabled = false;
        
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

        // Enhanced lookup logic for developer info
        let developer = developerDatabase[developerKey];
        console.log('🔍 Looking for developer:', developerKey, 'Direct match:', !!developer);
        
        if (!developer) {
            // Try removing _stock suffix
            let baseKey = developerKey.replace('_stock', '');
            developer = developerDatabase[baseKey];
            console.log('🔄 Trying without _stock:', baseKey, !!developer);
            
            if (!developer) {
                // Try removing all suffixes
                baseKey = developerKey.replace(/_stock|_\d+_\d+|_[a-z]$|_kit$/g, '');
                developer = developerDatabase[baseKey];
                console.log('🔄 Trying base key:', baseKey, !!developer);
                
                if (!developer) {
                    // Try just first two parts
                    baseKey = developerKey.split('_').slice(0, 2).join('_');
                    developer = developerDatabase[baseKey];
                    console.log('🔄 Trying first two parts:', baseKey, !!developer);
                }
            }
        }
        
        console.log('🎯 Final developer result:', developer ? developer.name : 'NOT FOUND');
        const dilutionList = developer.dilutions
            ? Object.values(developer.dilutions)
                .map(d => (typeof d === 'string' ? d : d.ratio))
                .filter(Boolean)
            : [];
        this.developerDetailsElement.innerHTML = `
            <div class="info-card-content">
                <div class="info-header">
                    <h3>${developer.name}</h3>
                    <span class="type-badge">${cleanText(developer.type)}</span>
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Manufacturer</span>
                        <span class="value">${cleanText(developer.manufacturer) || 'Unknown'}</span>
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
                        <span class="char-value">${cleanText(developer.characteristics) || 'N/A'}</span>
                    </div>
                    ${dilutionList.length > 0 ? `
                        <div class="char-item">
                            <span class="char-label">Dilutions:</span>
                            <span class="char-value">${dilutionList.join(', ')}</span>
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

    async calculate() {
        const filmKey = this.filmSelect.value;
        const developerKey = this.developerSelect.value;
        const temperature = parseFloat(this.temperatureInput.value);
        const pushPull = parseFloat(this.pushPullSelect.value);
        const volume = parseFloat(this.volumeInput.value);

        console.log('🧮 Calculate called with:', {
            filmKey, developerKey, temperature, pushPull, volume
        });
        console.log('🧮 Database state during calculate:', {
            filmDatabaseKeys: Object.keys(filmDatabase).length,
            developerDatabaseKeys: Object.keys(developerDatabase).length,
            hasFilm: !!filmDatabase[filmKey],
            hasDeveloper: !!developerDatabase[developerKey]
        });

        if (!filmKey || !developerKey) {
            console.log('❌ Missing film or developer selection');
            this.showError('Please select both film stock and developer');
            return;
        }

        // Try Rust backend first
        if (window.rustBridge?.isRustBackendAvailable()) {
            try {
                const rustResult = await window.rustBridge.calculateDevelopmentEnhanced(
                    filmKey, developerKey, temperature, pushPull, volume
                );
                
                if (rustResult) {
                    console.log('🦀 Using Rust calculation result');
                    this.updateResults(rustResult);
                    
                    // Show timer section
                    this.timerSection.style.display = 'block';
                    
                    // Initialize timer with calculated time - ensure whole seconds only
                    if (window.developmentTimer) {
                        window.developmentTimer.setDuration(Math.round(rustResult.time * 60)); // Convert to seconds and round
                    }
                    return;
                }
            } catch (error) {
                console.warn('⚠️ Rust calculation failed, falling back to JavaScript:', error);
            }
        }

        // Fallback to JavaScript calculation
        console.log('📜 Using JavaScript calculation engine');

        const film = filmDatabase[filmKey];
        console.log('🧮 Film found:', film ? film.name : 'NOT FOUND');
        
        if (!film) {
            console.log('❌ Film not found in database');
            this.showError('Selected film not found in database');
            return;
        }
        
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
        console.log('🧮 Developer found:', developer ? developer.name : 'NOT FOUND');
        
        // Check if this film/developer combination exists
        if (!film.developers || !film.developers[developerKey]) {
            console.log('❌ Film/developer combination not found:', {
                filmDevelopers: Object.keys(film.developers || {}),
                requestedDeveloper: developerKey
            });
            this.showError('This film/developer combination is not in our database');
            return;
        }
        console.log('✅ Film/developer combination found');

        const baseData = film.developers[developerKey];
        
        // Get base time based on film type - FIXED LOGIC
        let baseTime;
        console.log('🔍 Film type detection:', { 
            filmName: film.name,
            filmType: film.type, 
            availableFields: Object.keys(baseData) 
        });
        
        if (film.type === 'black_white') {
            baseTime = baseData.time_minutes || baseData.time || 8.0;
            console.log('⏱️ B&W base time:', baseTime, 'from field:', baseData.time_minutes ? 'time_minutes' : 'time');
        } else if (film.type === 'color_negative') {
            baseTime = baseData.developer_time_minutes || 3.25;
            console.log('⏱️ C-41 base time:', baseTime, 'from field: developer_time_minutes');
        } else if (film.type === 'slide') {
            baseTime = baseData.first_dev_time_minutes || 6.0;
            console.log('⏱️ E-6 base time:', baseTime, 'from field: first_dev_time_minutes');
        } else {
            baseTime = 8.0; // fallback
            console.log('⚠️ Unknown film type, using fallback:', baseTime);
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
        
        // Calculate development time with temperature compensation (B&W only)
        const tempCompensation = film.type === 'black_white'
            ? this.getTemperatureCompensation(temperature)
            : 1.0;
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
        
        // Initialize timer with calculated time - ensure whole seconds only
        if (window.developmentTimer) {
            window.developmentTimer.setDuration(Math.round(adjustedTime * 60)); // Convert to seconds and round
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
        
        const tempApplies = results.filmType === 'black_white';
        if ((tempApplies && results.temperature !== 20) || results.pushPull !== 0) {
            const adjustments = [];
            if (tempApplies && results.temperature !== 20) {
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
        
        // Show export section and store results for export
        this.exportSection.style.display = 'block';
        this.lastCalculationResult = results;
    }

    async exportResults() {
        if (!this.lastCalculationResult) {
            alert('No calculation results to export');
            return;
        }

        try {
            const format = this.exportFormatSelect.value;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `darkroom-calculation-${timestamp}.${format}`;
            
            const result = await window.rustBridge.exportCalculationEnhanced(
                this.lastCalculationResult,
                format,
                filename
            );
            
            console.log('✅ Export successful:', result);
            alert(result);
            
            // Show success message
            const originalText = this.exportBtn.textContent;
            this.exportBtn.textContent = 'Exported!';
            this.exportBtn.style.backgroundColor = 'var(--success)';
            
            setTimeout(() => {
                this.exportBtn.textContent = originalText;
                this.exportBtn.style.backgroundColor = '';
            }, 2000);
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            alert('Export failed: ' + error.message);
        }
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