// DarkroomPro Calculator Engine
class DevelopmentCalculator {
    constructor() {
        this.initializeElements();
        this.bindEvents();
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

    updateFilmInfo() {
        const filmKey = this.filmSelect.value;
        if (!filmKey) {
            this.filmDetailsElement.textContent = 'Select a film stock to see details';
            return;
        }

        const film = filmDatabase[filmKey];
        this.filmDetailsElement.innerHTML = `
            <strong>${film.name}</strong> (ISO ${film.iso})<br>
            <em>${film.type}</em><br><br>
            ${film.description}<br><br>
            <strong>Characteristics:</strong> ${film.characteristics}
        `;
    }

    updateDeveloperInfo() {
        const developerKey = this.developerSelect.value;
        if (!developerKey) {
            this.developerDetailsElement.textContent = 'Select a developer to see details';
            return;
        }

        const developer = developerDatabase[developerKey];
        this.developerDetailsElement.innerHTML = `
            <strong>${developer.name}</strong> (${developer.type})<br><br>
            ${developer.description}<br><br>
            <strong>Characteristics:</strong> ${developer.characteristics}<br>
            <strong>Common Dilutions:</strong> ${developer.dilutions.join(', ')}<br>
            <strong>Shelf Life:</strong> ${developer.shelfLife}
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
        const developer = developerDatabase[developerKey];
        
        // Check if this film/developer combination exists
        if (!film.developers[developerKey]) {
            this.showError('This film/developer combination is not in our database');
            return;
        }

        const baseData = film.developers[developerKey];
        
        // Calculate development time with temperature and push/pull compensation
        const tempCompensation = this.getTemperatureCompensation(temperature);
        const pushCompensation = pushPullCompensation[pushPull.toString()];
        
        const adjustedTime = baseData.time * tempCompensation * pushCompensation;
        
        // Calculate dilution amounts
        const dilutionRatio = this.parseDilution(baseData.dilution);
        const developerAmount = volume / (dilutionRatio.developer + dilutionRatio.water) * dilutionRatio.developer;
        const waterAmount = volume - developerAmount;
        
        // Update results
        this.updateResults({
            time: adjustedTime,
            dilution: baseData.dilution,
            developerAmount: Math.round(developerAmount),
            waterAmount: Math.round(waterAmount),
            temperature: temperature,
            pushPull: pushPull
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
        
        // Update time note based on adjustments
        let timeNote = 'Base time';
        if (results.temperature !== 20 || results.pushPull !== 0) {
            const adjustments = [];
            if (results.temperature !== 20) {
                adjustments.push(`${results.temperature}°C`);
            }
            if (results.pushPull !== 0) {
                const pushPullText = results.pushPull > 0 ? `+${results.pushPull}` : results.pushPull;
                adjustments.push(`${pushPullText} stops`);
            }
            timeNote = `Adjusted for ${adjustments.join(', ')}`;
        }
        this.timeNoteElement.textContent = timeNote;
        
        // Update dilution
        this.dilutionElement.textContent = results.dilution;
        this.developerAmountElement.textContent = `${results.developerAmount} ml developer`;
        this.waterAmountElement.textContent = `${results.waterAmount} ml water`;
        
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