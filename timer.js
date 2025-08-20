// Development Timer
class DevelopmentTimer {
    constructor() {
        this.duration = 0; // Total duration in seconds
        this.remaining = 0; // Remaining time in seconds
        this.isRunning = false;
        this.isPaused = false;
        this.interval = null;
        
        this.initializeElements();
        this.bindEvents();
        this.updateDisplay();
    }

    initializeElements() {
        this.displayElement = document.getElementById('timer-display');
        this.startBtn = document.getElementById('start-timer');
        this.pauseBtn = document.getElementById('pause-timer');
        this.resetBtn = document.getElementById('reset-timer');
        this.progressBar = document.getElementById('progress-bar');
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());
    }

    setDuration(seconds) {
        // Round to whole seconds to avoid decimal places in timer
        this.duration = Math.round(seconds);
        this.remaining = Math.round(seconds);
        this.updateDisplay();
        this.updateProgress();
    }

    start() {
        if (this.duration === 0) {
            alert('Please calculate development time first');
            return;
        }

        if (!this.isRunning) {
            this.isRunning = true;
            this.isPaused = false;
            
            this.interval = setInterval(() => {
                this.tick();
            }, 1000);
            
            this.updateButtons();
            this.playSound('start');
        }
    }

    pause() {
        if (this.isRunning) {
            this.isRunning = false;
            this.isPaused = true;
            clearInterval(this.interval);
            this.updateButtons();
            this.playSound('pause');
        } else if (this.isPaused) {
            this.start();
        }
    }

    reset() {
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this.interval);
        // Ensure we reset to whole seconds
        this.remaining = Math.round(this.duration);
        this.updateDisplay();
        this.updateProgress();
        this.updateButtons();
        this.playSound('reset');
    }

    tick() {
        // Ensure we're always working with whole seconds
        this.remaining = Math.round(this.remaining) - 1;
        this.updateDisplay();
        this.updateProgress();
        
        // Check for completion
        if (this.remaining <= 0) {
            this.complete();
        }
        
        // Warning sounds
        if (this.remaining === 30 || this.remaining === 10) {
            this.playSound('warning');
        }
    }

    complete() {
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this.interval);
        this.updateButtons();
        this.playSound('complete');
        
        // Flash the timer
        this.flashTimer();
        
        // Show completion alert
        setTimeout(() => {
            alert('🎉 Development Complete!\n\nTime to stop the developer and move to stop bath.');
        }, 500);
    }

    updateDisplay() {
        // Ensure we're working with whole seconds only
        const wholeSeconds = Math.round(this.remaining);
        const minutes = Math.floor(Math.abs(wholeSeconds) / 60);
        const seconds = Math.abs(wholeSeconds) % 60;
        const sign = wholeSeconds < 0 ? '-' : '';
        
        this.displayElement.textContent = 
            `${sign}${minutes.toString().padStart(2, '0')}:${Math.round(seconds).toString().padStart(2, '0')}`;
        
        // Change color when time is up
        if (wholeSeconds <= 0) {
            this.displayElement.style.color = 'var(--error)';
        } else if (wholeSeconds <= 30) {
            this.displayElement.style.color = 'var(--warning)';
        } else {
            this.displayElement.style.color = 'var(--accent-color)';
        }
    }

    updateProgress() {
        if (this.duration === 0) {
            this.progressBar.style.width = '0%';
            return;
        }
        
        const progress = Math.max(0, (this.duration - this.remaining) / this.duration * 100);
        this.progressBar.style.width = `${progress}%`;
        
        // Change progress bar color based on remaining time
        if (this.remaining <= 0) {
            this.progressBar.style.background = 'var(--error)';
        } else if (this.remaining <= 30) {
            this.progressBar.style.background = 'var(--warning)';
        } else {
            this.progressBar.style.background = 'linear-gradient(90deg, var(--success) 0%, var(--accent-color) 100%)';
        }
    }

    updateButtons() {
        if (this.isRunning) {
            this.startBtn.style.display = 'none';
            this.pauseBtn.textContent = 'Pause';
            this.pauseBtn.style.display = 'inline-block';
        } else if (this.isPaused) {
            this.startBtn.style.display = 'none';
            this.pauseBtn.textContent = 'Resume';
            this.pauseBtn.style.display = 'inline-block';
        } else {
            this.startBtn.style.display = 'inline-block';
            this.pauseBtn.textContent = 'Pause';
            this.pauseBtn.style.display = 'inline-block';
        }
    }

    flashTimer() {
        let flashes = 0;
        const flashInterval = setInterval(() => {
            this.displayElement.style.opacity = this.displayElement.style.opacity === '0.3' ? '1' : '0.3';
            flashes++;
            
            if (flashes >= 6) {
                clearInterval(flashInterval);
                this.displayElement.style.opacity = '1';
            }
        }, 200);
    }

    playSound(type) {
        // Create audio context for beeps (Web Audio API)
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Different frequencies for different events
            const frequencies = {
                start: 800,
                pause: 600,
                reset: 400,
                warning: 1000,
                complete: 1200
            };
            
            oscillator.frequency.setValueAtTime(frequencies[type] || 800, audioContext.currentTime);
            oscillator.type = 'sine';
            
            // Volume and duration
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            
            // Special handling for completion sound (multiple beeps)
            if (type === 'complete') {
                setTimeout(() => this.playSound('warning'), 300);
                setTimeout(() => this.playSound('warning'), 600);
            }
        } catch (error) {
            // Fallback: just console log if audio doesn't work
            console.log(`Timer ${type} sound`);
        }
    }

    // Format time for display
    formatTime(seconds) {
        const mins = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.abs(seconds) % 60;
        const sign = seconds < 0 ? '-' : '';
        return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize timer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.developmentTimer = new DevelopmentTimer();
});