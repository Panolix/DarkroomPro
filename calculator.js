// Global function to clean up text display
function cleanText(text) {
    if (!text) return text;
    return text.toString().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function normalizeDeveloperKey(key) {
    return (key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveDeveloper(developerKey) {
    if (!developerKey) return null;
    if (developerDatabase[developerKey]) return developerDatabase[developerKey];

    const normalized = normalizeDeveloperKey(developerKey);
    let bestMatch = null;
    let bestLength = 0;

    Object.entries(developerDatabase).forEach(([key, developer]) => {
        const normalizedMaster = normalizeDeveloperKey(key);
        if (normalized.startsWith(normalizedMaster) && normalizedMaster.length > bestLength) {
            bestMatch = developer;
            bestLength = normalizedMaster.length;
        }
    });

    return bestMatch;
}

// DarkroomPro Calculator Engine - Enhanced with Complete Database
class DevelopmentCalculator {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.updateTemperatureDisplay();

        this.filmsPopulated = false;
        this.populatedFilmCount = 0;
        this.lastFilmInfoKey = null;
        this.lastDeveloperInfoKey = null;
        this.kitTempOverride = false;
        try {
            this.rotary = localStorage.getItem('darkroompro.process.rotary') === 'rotary';
        } catch (error) {
            this.rotary = false;
        }
        if (this.agitationMethodSelect) {
            this.agitationMethodSelect.value = this.rotary ? 'rotary' : 'inversion';
        }
        try {
            const storedCompensation = parseInt(localStorage.getItem('darkroompro.process.rotaryCompensation') || '15', 10);
            this.rotaryCompensation = Number.isFinite(storedCompensation)
                ? Math.min(35, Math.max(0, storedCompensation))
                : 15;
        } catch (error) {
            this.rotaryCompensation = 15;
        }
        try {
            this.rollsByDeveloper = JSON.parse(localStorage.getItem('darkroompro.rollsByDeveloper') || '{}');
        } catch (error) {
            this.rollsByDeveloper = {};
        }
        this.rollsDeveloped = 0;

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
        this.pushPullLabels = [...this.pushPullSelect.options].reduce((labels, option) => {
            labels[option.value] = option.textContent;
            return labels;
        }, {});
        this.calculateBtn = document.getElementById('calculate');
        this.exportBtn = document.getElementById('export');
        this.exportSection = document.getElementById('export-section');
        this.exportFormatSelect = document.getElementById('export-format');
        this.agitationMethodSelect = document.getElementById('agitation-method');
        this.kitTempToggle = document.getElementById('kit-temp-toggle');
        this.processNote = document.getElementById('process-note');
        this.rotaryCompensationGroup = document.getElementById('rotary-compensation-group');
        this.rotaryCompensationInput = document.getElementById('rotary-compensation');
        this.rollsInput = document.getElementById('rolls-developed');
        this.rollsReset = document.getElementById('rolls-reset');
        this.batchCapacity = document.getElementById('batch-capacity');
        this.rollsNote = document.getElementById('rolls-note');
        
        // Result elements
        this.devTimeElement = document.getElementById('dev-time');
        this.timeNoteElement = document.getElementById('time-note');
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
        this.temperatureInput.addEventListener('input', () => {
            this.updateTemperatureDisplay();
            this.updateRollsUI();
        });
        this.agitationMethodSelect.addEventListener('change', () => this.setAgitationMethod(this.agitationMethodSelect.value));
        this.rotaryCompensationInput.addEventListener('change', () => this.setRotaryCompensation(this.rotaryCompensationInput.value));
        this.kitTempToggle.addEventListener('click', () => this.toggleKitTempOverride());
        this.rollsInput.addEventListener('change', () => this.setRollsDeveloped(this.rollsInput.value));
        this.rollsReset.addEventListener('click', () => this.setRollsDeveloped(0));
        
        // Auto-calculate when inputs change
        [this.filmSelect, this.developerSelect, this.temperatureInput, this.pushPullSelect].forEach(element => {
            element.addEventListener('change', () => {
                if (this.filmSelect.value && this.developerSelect.value) {
                    this.calculate();
                }
            });
        });
        
        this.updateTemperatureDisplay();
    }
    
    populateFilmOptions() {
        const filmCount = Object.keys(filmDatabase || {}).length;

        if (this.filmsPopulated && this.populatedFilmCount === filmCount) {
            console.log('🎬 Film options already populated, keeping current selection');
            return;
        }

        console.log('🎬 Populating film options...');

        const previousSelection = this.filmSelect.value;

        // Enable the dropdown
        this.filmSelect.disabled = false;

        // Clear existing options
        this.filmSelect.innerHTML = '<option value="">Select Film Stock...</option>';

        // Check if database is actually loaded
        if (!filmDatabase || filmCount === 0) {
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
        
        if (previousSelection && Array.from(this.filmSelect.options).some(option => option.value === previousSelection)) {
            this.filmSelect.value = previousSelection;
        }

        this.filmsPopulated = true;
        this.populatedFilmCount = filmCount;

        console.log('✅ Film options populated and dropdown enabled');
    }

    updateFilmInfo() {
        const filmKey = this.filmSelect.value;
        if (filmKey && filmKey === this.lastFilmInfoKey) return;
        this.lastFilmInfoKey = filmKey || null;
        this.kitTempOverride = false;
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
                    <span class="prod-badge ${film.current_production ? 'current' : 'discontinued'}">${film.current_production ? 'In production' : 'Discontinued'}</span>
                </div>

                ${film.iso_note ? `<p class="iso-note">${film.iso_note}</p>` : ''}
                
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
        this.applyStandardTemperature();
        this.updateDeveloperInfo();
        this.updatePushPullOptions();
        this.updateRotaryCompensationUI();
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

        const previousSelection = this.developerSelect.value;

        // Enable the dropdown
        this.developerSelect.disabled = false;

        // Clear existing options
        this.developerSelect.innerHTML = '<option value="">Select Developer...</option>';

        if (availableDevelopers.length === 0) {
            this.developerSelect.innerHTML = '<option value="">Select film first...</option>';
            return;
        }

        // Add available developers, sorted alphabetically by the displayed
        // label so dilution variants group with their developer
        const film = filmDatabase[this.filmSelect.value];
        const devOptions = availableDevelopers
            .map(devKey => {
                const developer = resolveDeveloper(devKey);
                if (!developer) {
                    console.log('❌ Developer not found in database:', devKey);
                    return null;
                }
                const combo = film && film.developers ? film.developers[devKey] : null;
                const dilution = combo && combo.dilution
                    ? ` (${combo.dilution === 'stock' ? 'Stock' : combo.dilution})`
                    : '';
                return { devKey, label: `${developer.name}${dilution}` };
            })
            .filter(Boolean)
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

        devOptions.forEach(({ devKey, label }) => {
            const option = document.createElement('option');
            option.value = devKey; // Keep original key for calculation
            option.textContent = label;
            this.developerSelect.appendChild(option);
        });

        if (previousSelection && Array.from(this.developerSelect.options).some(option => option.value === previousSelection)) {
            this.developerSelect.value = previousSelection;
        }

        console.log('📊 Total developer options added:', this.developerSelect.options.length - 1);
    }

    updateDeveloperInfo() {
        const developerKey = this.developerSelect.value;
        if (developerKey && developerKey === this.lastDeveloperInfoKey) return;
        this.lastDeveloperInfoKey = developerKey || null;
        this.kitTempOverride = false;
        this.rollsDeveloped = developerKey ? (this.rollsByDeveloper[developerKey] || 0) : 0;
        this.applyStandardTemperature();
        this.updatePushPullOptions();
        if (!developerKey) {
            this.developerDetailsElement.textContent = 'Select a developer to see details';
            return;
        }

        // Enhanced lookup logic for developer info
        const developer = resolveDeveloper(developerKey);
        console.log('🔍 Looking for developer:', developerKey, 'Found:', developer ? developer.name : 'NOT FOUND');

        if (!developer) {
            this.developerDetailsElement.textContent = 'Developer information not available';
            return;
        }

        const dilutionList = developer.dilutions
            ? Object.values(developer.dilutions)
                .map(d => {
                    const ratio = typeof d === 'string' ? d : d.ratio;
                    return ratio === '1:0' ? 'Stock' : ratio;
                })
                .filter(Boolean)
                // The Rust backend returns dilutions in hash order; sort by ratio
                // so stock/1:1/1:3... always read in a sensible order.
                .sort((a, b) => {
                    const ratioValue = ratio => {
                        if (ratio === 'Stock') return 0;
                        const match = String(ratio).match(/[:+](\d+(?:\.\d+)?)/);
                        return match ? parseFloat(match[1]) : Number.MAX_SAFE_INTEGER;
                    };
                    return ratioValue(a) - ratioValue(b);
                })
            : [];
        const kit = developer.kit_mixing;
        const capacityValue = kit
            ? `${kit.capacity_rolls} rolls per ${kit.volume_ml / 1000} L kit`
            : `${developer.capacity_rolls_per_liter || 'N/A'} rolls/L`;
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
                        <span class="value">${capacityValue}</span>
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
                    ${kit ? `
                        <div class="char-item">
                            <span class="char-label">Kit mixing:</span>
                            <span class="char-value">${kit.instructions}</span>
                        </div>
                        ${kit.note ? `<div class="char-item"><span class="char-label">Kit note:</span><span class="char-value">${kit.note}</span></div>` : ''}
                    ` : ''}
                    ${dilutionList.length > 0 ? `
                        <div class="char-item">
                            <span class="char-label">Dilutions:</span>
                            <span class="char-value">${dilutionList.join(', ')}</span>
                        </div>
                    ` : ''}
                    ${developer.temperature_compensation_source ? `
                        <div class="char-item">
                            <span class="char-label">Temp compensation:</span>
                            <span class="char-value">${developer.temperature_compensation_source}</span>
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

        const kitTemp = this.getStandardTemperature();
        if (kitTemp !== null) {
            const developer = resolveDeveloper(this.developerSelect.value);
            const hasTable = !!(developer && developer.temperature_compensation &&
                Object.keys(developer.temperature_compensation).length > 0);

            if (this.temperatureInput.disabled) {
                this.tempNoteElement.textContent = `Fixed kit standard (${kitTemp}°C)`;
                this.tempNoteElement.style.color = 'var(--success)';
            } else if (hasTable && Math.abs(temp - kitTemp) > 0.01) {
                this.tempNoteElement.textContent = `Kit temperature table: ${temp}°C (standard ${kitTemp}°C)`;
                this.tempNoteElement.style.color = 'var(--warning)';
            } else if (Math.round(temp) === Math.round(kitTemp)) {
                this.tempNoteElement.textContent = `Kit standard (${kitTemp}°C)`;
                this.tempNoteElement.style.color = 'var(--success)';
            } else {
                this.tempNoteElement.textContent = `Kit standard is ${kitTemp}°C`;
                this.tempNoteElement.style.color = 'var(--warning)';
            }
            return;
        }

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

    getStandardTemperature() {
        const film = filmDatabase[this.filmSelect.value];
        if (!film || film.type === 'black_white') return null;

        const developerKey = this.developerSelect.value;
        const combo = developerKey && film.developers ? film.developers[developerKey] : null;
        if (combo) {
            const kitTemp = combo.developer_temp_c || combo.first_dev_temp_c;
            if (kitTemp) return kitTemp;
        }

        return 37.8;
    }

    setAgitationMethod(value) {
        this.rotary = value === 'rotary';
        try {
            localStorage.setItem('darkroompro.process.rotary', this.rotary ? 'rotary' : 'inversion');
        } catch (error) {
            // persistence is optional
        }
        this.updateRotaryCompensationUI();
        this.updateProcessNote();
        if (this.filmSelect.value && this.developerSelect.value) {
            this.calculate();
        }
    }

    setRotaryCompensation(value) {
        const parsed = parseInt(value, 10);
        this.rotaryCompensation = Number.isFinite(parsed) ? Math.min(35, Math.max(0, parsed)) : 15;
        try {
            localStorage.setItem('darkroompro.process.rotaryCompensation', String(this.rotaryCompensation));
        } catch (error) {
            // persistence is optional
        }
        this.updateRotaryCompensationUI();
        this.updateProcessNote();
        if (this.filmSelect.value && this.developerSelect.value) {
            this.calculate();
        }
    }

    updateRotaryCompensationUI() {
        if (!this.rotaryCompensationGroup) return;
        const film = filmDatabase[this.filmSelect.value];
        const show = this.rotary && !!film && film.type === 'black_white';
        this.rotaryCompensationGroup.style.display = show ? 'block' : 'none';
        if (this.rotaryCompensationInput) {
            this.rotaryCompensationInput.value = this.rotaryCompensation;
        }
    }

    toggleKitTempOverride() {
        this.kitTempOverride = !this.kitTempOverride;
        this.applyStandardTemperature();
        if (this.filmSelect.value && this.developerSelect.value) {
            this.calculate();
        }
    }

    updatePushPullOptions() {
        const film = filmDatabase[this.filmSelect.value];
        const combo = film && film.developers ? film.developers[this.developerSelect.value] : null;
        const isBlackWhite = !!film && film.type === 'black_white';
        const isColor = !!film && !isBlackWhite;
        const fields = film && film.type === 'color_negative'
            ? { '1': 'push_1_stop_dev_time', '2': 'push_2_stop_dev_time', '3': 'push_3_stop_dev_time', '-1': 'pull_1_stop_dev_time', '-2': 'pull_2_stop_dev_time' }
            : { '1': 'push_1_stop_first_dev_time', '2': 'push_2_stop_first_dev_time', '3': 'push_3_stop_first_dev_time', '-1': 'pull_1_stop_first_dev_time', '-2': 'pull_2_stop_first_dev_time' };

        [...this.pushPullSelect.options].forEach(option => {
            const baseLabel = this.pushPullLabels[option.value] || option.textContent;
            const value = parseInt(option.value, 10);
            if (!isColor || value === 0 || !combo) {
                option.disabled = false;
                option.textContent = baseLabel;
                return;
            }
            const field = fields[option.value];
            const available = !!field && combo[field] != null;
            option.disabled = !available;
            option.textContent = available ? baseLabel : `${baseLabel} — not published`;
        });

        const selected = this.pushPullSelect.selectedOptions[0];
        if (selected && selected.disabled) {
            this.pushPullSelect.value = '0';
        }
    }

    getAgitationAdjustment(film, developer) {
        if (!film || film.type !== 'slide' || !developer || !developer.agitation_adjustment) return null;
        const adjustment = developer.agitation_adjustment;
        const seconds = this.rotary ? adjustment.rotary_seconds : adjustment.inversion_seconds;
        if (seconds == null || seconds === 0) return null;
        const label = seconds > 0 ? `+${seconds}s` : `−${Math.abs(seconds)}s`;
        return {
            seconds,
            label: `${this.rotary ? 'rotary' : 'manual'} ${label}`
        };
    }

    applyAgitationAdjustment(minutes, film, developer) {
        const adjustment = this.getAgitationAdjustment(film, developer);
        if (!adjustment) return { time: minutes, comp: null };
        return {
            time: Math.max(0.1, minutes + adjustment.seconds / 60),
            comp: adjustment
        };
    }

    updateProcessNote() {
        if (!this.processNote) return;

        const film = filmDatabase[this.filmSelect.value];
        const developer = resolveDeveloper(this.developerSelect.value);
        const notes = [];

        if (film && film.type === 'black_white' && this.rotary) {
            notes.push(`Rotary/continuous agitation: −${this.rotaryCompensation}% is applied to the developer time. 15% is a starting point; 15–35% may be needed depending on film/developer, and pre-wetting or a diffusion enlarger can need less. Test your setup.`);
        } else if (film && film.type !== 'black_white' && this.rotary) {
            notes.push('Colour process times use the kit standard; rotary/manual differences are only applied where the kit publishes a method-specific time.');
        }

        if (film && film.type === 'slide' && developer && developer.agitation_adjustment) {
            const adjustment = developer.agitation_adjustment;
            const fmt = value => value > 0 ? `+${value}s` : value < 0 ? `−${Math.abs(value)}s` : '0s';
            notes.push(`E-6 First Developer: manual ${fmt(adjustment.inversion_seconds || 0)}, rotary ${fmt(adjustment.rotary_seconds || 0)} (${adjustment.source}).`);
        }

        if (film && film.type !== 'black_white' && this.temperatureInput.disabled) {
            if (this.kitTempToggle && this.kitTempToggle.style.display !== 'none') {
                notes.push('Temperature is locked to the kit standard. Enable the kit temperature table only if your instructions publish one.');
            } else {
                notes.push('Temperature is fixed for this process.');
            }
        } else if (film && film.type !== 'black_white' && this.kitTempOverride) {
            notes.push("Using the kit's published temperature table.");
        }

        this.processNote.textContent = notes.join(' ');
    }

    setRollsDeveloped(value) {
        const developer = resolveDeveloper(this.developerSelect.value);
        const rule = developer && developer.roll_compensation;
        if (!rule) {
            this.rollsDeveloped = 0;
            this.updateRollsUI();
            return;
        }

        const max = Math.max(0, (rule.max_rolls || 30) - 1);
        const rolls = Math.max(0, Math.min(max, parseInt(value, 10) || 0));
        this.rollsDeveloped = rolls;

        if (this.developerSelect.value) {
            this.rollsByDeveloper[this.developerSelect.value] = rolls;
            try {
                localStorage.setItem('darkroompro.rollsByDeveloper', JSON.stringify(this.rollsByDeveloper));
            } catch (error) {
                // persistence is optional
            }
        }

        this.updateRollsUI();
        if (this.filmSelect.value && this.developerSelect.value) {
            this.calculate();
        }
    }

    getRollCompensation(developer, temperature) {
        const rule = developer && developer.roll_compensation;
        if (!rule || this.rollsDeveloped <= 0) return null;

        if (rule.type === 'percent_per_roll') {
            const percent = rule.value * this.rollsDeveloped;
            return { percent, label: `+${percent}% for ${this.rollsDeveloped} rolls` };
        }

        if (rule.type === 'seconds_per_block') {
            const key = String(Math.round(temperature * 10) / 10);
            const byTemp = rule.seconds_by_temperature || {};
            const seconds = byTemp[key] !== undefined
                ? byTemp[key]
                : byTemp[String(Math.round(temperature))];
            if (seconds == null) return null;
            const blocks = Math.floor(this.rollsDeveloped / (rule.block || 1));
            if (blocks < 1) return null;
            return {
                seconds: blocks * seconds,
                label: `+${blocks * seconds}s for ${this.rollsDeveloped} rolls`
            };
        }

        return null;
    }

    applyRollCompensation(minutes, developer, temperature) {
        const comp = this.getRollCompensation(developer, temperature);
        if (!comp) return { time: minutes, comp: null };
        if (comp.percent != null) {
            return { time: minutes * (1 + comp.percent / 100), comp };
        }
        return { time: minutes + comp.seconds / 60, comp };
    }

    updateRollsUI() {
        if (!this.rollsInput) return;

        const developer = resolveDeveloper(this.developerSelect.value);
        const rule = developer && developer.roll_compensation;
        const temp = parseFloat(this.temperatureInput.value);
        const key = String(Math.round(temp * 10) / 10);
        const byTemp = rule && rule.seconds_by_temperature ? rule.seconds_by_temperature : null;
        const hasTempRule = !!(byTemp && (byTemp[key] !== undefined || byTemp[String(Math.round(temp))] !== undefined));
        const supported = !!rule && (rule.type === 'percent_per_roll' || hasTempRule);

        this.rollsInput.disabled = !supported;
        this.rollsInput.max = String(rule ? Math.max(0, (rule.max_rolls || 30) - 1) : 0);
        this.rollsInput.value = String(this.rollsDeveloped);
        this.rollsReset.style.display = supported && this.rollsDeveloped > 0 ? 'inline-block' : 'none';
        const kit = developer && developer.kit_mixing;
        if (rule && rule.rated_rolls && rule.max_rolls && rule.rated_rolls !== rule.max_rolls) {
            this.batchCapacity.textContent = `${rule.rated_rolls} rated, ${rule.max_rolls} max per L`;
        } else if (kit) {
            this.batchCapacity.textContent = `${kit.capacity_rolls} rolls per ${kit.volume_ml / 1000} L kit`;
        } else {
            this.batchCapacity.textContent = developer && developer.capacity_rolls_per_liter
                ? `${developer.capacity_rolls_per_liter} rolls/L`
                : 'Not published';
        }

        let note = '';
        if (developer && !rule) {
            note = 'No published roll-count compensation for this developer; use it one-shot or follow its replenishment guidance.';
        } else if (developer && !supported) {
            note = `No roll compensation is published for ${temp}°C for this kit.`;
        } else if (rule) {
            const rate = rule.type === 'percent_per_roll'
                ? `+${rule.value}% per roll already developed`
                : `+${(byTemp[key] !== undefined ? byTemp[key] : byTemp[String(Math.round(temp))])}s per ${rule.block} rolls already developed`;
            const rated = rule.rated_rolls ? ` Rated ${rule.rated_rolls} rolls` : '';
            const max = rule.max_rolls && rule.max_rolls !== rule.rated_rolls
                ? ` (up to ${rule.max_rolls} with added time)`
                : '';
            note = `${rate}.${rated}${max}. ${rule.note || ''}`;
        }
        this.rollsNote.textContent = note;
    }

    applyStandardTemperature() {
        const kitTemp = this.getStandardTemperature();

        if (kitTemp !== null) {
            const developer = resolveDeveloper(this.developerSelect.value);
            const table = (developer && developer.temperature_compensation)
                ? Object.keys(developer.temperature_compensation).map(Number).filter(Number.isFinite)
                : [];
            const hasTable = table.length > 0;

            if (this.kitTempToggle) {
                this.kitTempToggle.style.display = hasTable ? 'inline-block' : 'none';
                this.kitTempToggle.classList.toggle('active', hasTable && this.kitTempOverride);
                this.kitTempToggle.textContent = hasTable && this.kitTempOverride
                    ? 'Using kit temperature table'
                    : 'Use kit temperature table';
            }

            if (hasTable && this.kitTempOverride) {
                const min = Math.min(...table);
                const max = Math.max(...table);
                this.temperatureInput.disabled = false;
                this.temperatureInput.min = String(min);
                this.temperatureInput.max = String(max);
                const current = parseFloat(this.temperatureInput.value);
                if (!(current >= min && current <= max)) {
                    this.temperatureInput.value = String(kitTemp);
                }
            } else {
                // Standard practice: the kit temperature is fixed. Lower
                // temperatures are only available through the kit's own table.
                this.temperatureInput.disabled = true;
                this.temperatureInput.min = String(kitTemp);
                this.temperatureInput.max = String(kitTemp);
                this.temperatureInput.value = String(kitTemp);
            }
        } else {
            if (this.kitTempToggle) this.kitTempToggle.style.display = 'none';
            this.kitTempOverride = false;
            this.temperatureInput.disabled = false;
            this.temperatureInput.min = '15';
            this.temperatureInput.max = '30';
            const current = parseFloat(this.temperatureInput.value);
            if (!(current >= 15 && current <= 30)) {
                this.temperatureInput.value = '20';
            }
        }

        this.updateTemperatureDisplay();
        this.updateProcessNote();
        this.updateRollsUI();
    }

    async calculate() {
        const filmKey = this.filmSelect.value;
        const developerKey = this.developerSelect.value;
        const temperature = parseFloat(this.temperatureInput.value);
        const pushPull = parseFloat(this.pushPullSelect.value);
        const filmForType = filmDatabase[filmKey];

        console.log('🧮 Calculate called with:', {
            filmKey, developerKey, temperature, pushPull
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

        if (filmForType && filmForType.type === 'black_white' && (temperature < 15 || temperature > 30)) {
            this.showError('Black & white development temperature must be between 15 and 30°C.');
            return;
        }

        // Try Rust backend first
        if (window.rustBridge?.isRustBackendAvailable()) {
            try {
                const rustResult = await window.rustBridge.calculateDevelopmentEnhanced(
                    filmKey, developerKey, temperature, pushPull
                );
                
                if (rustResult) {
                    console.log('🦀 Using Rust calculation result');
                    const developerForAdjust = resolveDeveloper(developerKey);
                    const roll = this.applyRollCompensation(rustResult.time, developerForAdjust, temperature);
                    let adjustedRustTime = roll.time;
                    const agitation = this.applyAgitationAdjustment(adjustedRustTime, filmForType, developerForAdjust);
                    adjustedRustTime = agitation.time;
                    const rotaryAdjusted = this.rotary && filmForType && filmForType.type === 'black_white';
                    if (rotaryAdjusted) {
                        adjustedRustTime = Math.max(0.1, adjustedRustTime * (1 - this.rotaryCompensation / 100));
                    }
                    rustResult.time = adjustedRustTime;
                    rustResult.timeFormatted = this.formatMinutes(adjustedRustTime);
                    rustResult.rotary = this.rotary;
                    rustResult.rotaryAdjusted = rotaryAdjusted;
                    rustResult.rotaryPercent = this.rotaryCompensation;
                    rustResult.agitationAdjustment = agitation.comp ? agitation.comp.label : null;
                    rustResult.rollCompensation = roll.comp ? roll.comp.label : null;
                    rustResult.kitTemperature = this.getStandardTemperature();
                    this.updateResults(rustResult);

                    // Show timer section
                    this.timerSection.style.display = 'block';

                    this.updateProcessTimer(filmKey, developerKey, rustResult.time, temperature);
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
        const developer = resolveDeveloper(developerKey);
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
                // Where the database has no published EI row, fall back to the
                // Massive Dev Chart push guideline for the film/developer class.
                const f = this.getPushFactors(film, developer);
                if (pushPull === 1) baseTime = baseData.push_1_stop_minutes || baseTime * f.push1;
                else if (pushPull === 2) baseTime = baseData.push_2_stop_minutes || baseTime * f.push2;
                else if (pushPull === 3) baseTime = baseData.push_3_stop_minutes || baseTime * f.push3;
                else if (pushPull === -1) baseTime = baseData.pull_1_stop_minutes || baseTime * f.pull1;
                else if (pushPull === -2) baseTime = baseData.pull_2_stop_minutes || baseTime * f.pull2;
            } else if (film.type === 'color_negative') {
                const field = {
                    '1': 'push_1_stop_dev_time',
                    '2': 'push_2_stop_dev_time',
                    '3': 'push_3_stop_dev_time',
                    '-1': 'pull_1_stop_dev_time',
                    '-2': 'pull_2_stop_dev_time'
                }[String(pushPull)];
                const published = field ? baseData[field] : null;
                if (published == null) {
                    const label = pushPull > 0 ? `+${pushPull}-stop` : `${pushPull}-stop`;
                    this.showError(`No published ${label} time for ${film.name} in ${developer.name}. Use Normal or check the kit instructions.`);
                    return;
                }
                baseTime = published;
            } else if (film.type === 'slide') {
                const field = {
                    '1': 'push_1_stop_first_dev_time',
                    '2': 'push_2_stop_first_dev_time',
                    '3': 'push_3_stop_first_dev_time',
                    '-1': 'pull_1_stop_first_dev_time',
                    '-2': 'pull_2_stop_first_dev_time'
                }[String(pushPull)];
                const published = field ? baseData[field] : null;
                if (published == null) {
                    const label = pushPull > 0 ? `+${pushPull}-stop` : `${pushPull}-stop`;
                    this.showError(`No published ${label} time for ${film.name} in ${developer.name}. Use Normal or check the kit instructions.`);
                    return;
                }
                baseTime = published;
            }
        }
        
        // Temperature compensation: B&W always; colour kits only when the kit
        // publishes a time/temperature table.
        const hasDevTable = !!(developer && developer.temperature_compensation &&
            Object.keys(developer.temperature_compensation).length > 0);
        const tempCompensation = (film.type === 'black_white' || hasDevTable)
            ? this.getTemperatureCompensation(temperature, developer)
            : 1.0;
        const adjustedTime = baseTime * tempCompensation;
        const roll = this.applyRollCompensation(adjustedTime, developer, temperature);
        const agitation = this.applyAgitationAdjustment(roll.time, film, developer);
        const rotaryAdjusted = this.rotary && film.type === 'black_white';
        const finalTime = rotaryAdjusted
            ? agitation.time * (1 - this.rotaryCompensation / 100)
            : agitation.time;

        // Update results
        this.updateResults({
            time: finalTime,
            temperature: temperature,
            pushPull: pushPull,
            filmType: film.type,
            filmName: film.name,
            developerName: developer.name,
            kitTemperature: this.getStandardTemperature(),
            rotary: this.rotary,
            rotaryAdjusted: rotaryAdjusted,
            rotaryPercent: this.rotaryCompensation,
            rollCompensation: roll.comp ? roll.comp.label : null,
            agitationAdjustment: agitation.comp ? agitation.comp.label : null
        });
        
        // Show timer section
        this.timerSection.style.display = 'block';

        this.updateProcessTimer(filmKey, developerKey, finalTime, temperature);
    }

    updateProcessTimer(filmKey, developerKey, developerMinutes, temperature) {
        if (!window.developmentTimer) return;

        const film = filmDatabase[filmKey];
        const combo = film && film.developers ? film.developers[developerKey] : null;

        if (!film || !combo || !window.processSteps) {
            window.developmentTimer.setDuration(Math.round(developerMinutes * 60));
            return;
        }

        const steps = window.processSteps.buildPresetSteps(film, combo, developerMinutes);
        const actualTemperature = temperature != null ? temperature : this.getStandardTemperature();
        if (steps.length > 0 && actualTemperature != null) {
            steps[0].temperature_c = actualTemperature;
        }
        window.developmentTimer.setSteps(steps, {
            filmKey,
            developerKey,
            temperature: actualTemperature != null ? actualTemperature : 20,
            presetAgitation: window.processSteps.agitationFromCombo(combo),
            rotary: this.rotary
        });
    }

    getTemperatureCompensation(temperature, developer) {
        const table = (developer && developer.temperature_compensation && Object.keys(developer.temperature_compensation).length > 0)
            ? developer.temperature_compensation
            : temperatureCompensation;

        if (!table) return 1.0;

        // Round to nearest 0.5 degree
        const roundedTemp = Math.round(temperature * 2) / 2;

        const keys = Object.keys(table).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
        if (keys.length === 0) return 1.0;

        // Exact match (works for integer and half-degree keys)
        if (keys.includes(roundedTemp)) {
            return table[roundedTemp];
        }

        // Interpolate between the surrounding keys; clamp at the table edges
        let lower = null;
        let upper = null;
        for (const key of keys) {
            if (key < roundedTemp) lower = key;
            else if (key > roundedTemp && upper === null) upper = key;
        }

        if (lower !== null && upper !== null) {
            const factor = (roundedTemp - lower) / (upper - lower);
            const lo = table[lower];
            const hi = table[upper];
            if (lo > 0 && hi > 0) {
                // Development time responds exponentially to temperature, so
                // interpolate the factor in log space; linear interpolation
                // over sparse colour-kit tables overestimates mid-range times.
                const value = Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * factor);
                return Math.round(value * 10000) / 10000;
            }
            return lo + (hi - lo) * factor;
        }

        const nearest = lower !== null ? lower : upper;
        return nearest !== null ? table[nearest] : 1.0;
    }

    // Massive Dev Chart push guideline, used when no EI row is published for a
    // combination. Compensating developers = Microphen / T-Max developer.
    getPushFactors(film, developer) {
        const devName = (developer && developer.name ? developer.name : '').toLowerCase();
        const filmName = (film && film.name ? film.name : '').toLowerCase();
        const isTMaxFilm = filmName.includes('t-max') || filmName.includes('tmax');
        const isCompensating = devName.includes('microphen') || devName.includes('t-max');
        if (isTMaxFilm) return { push1: 1.0, push2: 1.33, push3: 1.66, pull1: 0.7, pull2: 0.5 };
        if (isCompensating) return { push1: 1.4, push2: 1.85, push3: 2.5, pull1: 0.7, pull2: 0.5 };
        return { push1: 1.5, push2: 2.25, push3: 4.5, pull1: 0.7, pull2: 0.5 };
    }

    formatMinutes(minutes) {
        const totalSeconds = Math.max(0, Math.round(minutes * 60));
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateResults(results) {
        // Format time as MM:SS from total seconds to avoid a ":60" rollover
        const timeString = this.formatMinutes(results.time);
        results.timeFormatted = timeString;
        
        this.devTimeElement.textContent = timeString;
        
        // Update time note based on film type and adjustments
        let timeNote = `${results.filmName} in ${results.developerName}`;
        const colorLabel = results.filmType === 'color_negative'
            ? 'C-41 Developer'
            : results.filmType === 'slide' ? 'E-6 First Developer' : null;
        if (colorLabel) {
            timeNote += ` (${colorLabel} @ ${results.temperature}°C)`;
        }

        const adjustments = [];
        if (results.filmType === 'black_white' && results.temperature !== 20) {
            adjustments.push(`${results.temperature}°C`);
        }
        if (results.pushPull !== 0) {
            const pushPullText = results.pushPull > 0 ? `+${results.pushPull}` : results.pushPull;
            adjustments.push(`${pushPullText} stops`);
        }
        if (results.rotaryAdjusted) {
            adjustments.push(`rotary −${results.rotaryPercent}%`);
        }
        if (results.rollCompensation) {
            adjustments.push(results.rollCompensation);
        }
        if (results.agitationAdjustment) {
            adjustments.push(results.agitationAdjustment);
        }
        if (adjustments.length > 0) {
            timeNote += ` (${adjustments.join(', ')})`;
        }
        this.timeNoteElement.textContent = timeNote;
        
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
            this.exportBtn.textContent = 'Calculate first';
            setTimeout(() => { this.exportBtn.textContent = 'Export Results'; }, 1600);
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
            const originalText = this.exportBtn.textContent;
            this.exportBtn.textContent = 'Export failed';
            this.exportBtn.style.borderColor = 'var(--error)';
            setTimeout(() => {
                this.exportBtn.textContent = originalText;
                this.exportBtn.style.borderColor = '';
            }, 2000);
        }
    }

    showError(message) {
        this.devTimeElement.textContent = 'Error';
        this.timeNoteElement.textContent = message;
        
        // Hide timer section
        this.timerSection.style.display = 'none';
    }
}

// Initialize calculator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.calculator = new DevelopmentCalculator();
});