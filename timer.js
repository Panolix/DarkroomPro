// Development Timer - multi-step process timer with Auto/Buffer/Manual transitions
class DevelopmentTimer {
    constructor() {
        this.steps = [];
        this.context = null;
        this.customized = false;
        this.presetSteps = [];
        this.currentIndex = 0;
        this.remaining = 0;
        this.state = 'idle'; // idle | running | buffering | awaiting | done
        this.interval = null;
        this.deadline = null;
        this.autoPromptTimeout = null;

        this.transitionMode = this.loadSetting('darkroompro.timer.mode', 'auto');
        this.bufferSeconds = this.clampBuffer(parseInt(this.loadSetting('darkroompro.timer.buffer', '5'), 10));

        this.darkroom = {
            enabled: false,
            focus: this.loadSetting('darkroompro.darkroom.focus', 'on') === 'on',
            chimes: this.loadSetting('darkroompro.darkroom.chimes', 'on') === 'on',
            sleep: this.loadSetting('darkroompro.darkroom.sleep', 'on') === 'on',
        };
        try {
            localStorage.removeItem('darkroompro.darkroom');
        } catch (error) {
            console.warn('Unable to clear stored darkroom setting', error);
        }
        this.cues = [];
        this.firedCues = new Set();
        this.activeCue = null;
        this.focusVisible = false;
        this.sleepBlocked = false;

        this.initializeElements();
        this.bindEvents();
        this.applyModeUI();
        this.applyDarkroomUI();
        this.render();
    }

    initializeElements() {
        this.displayElement = document.getElementById('timer-display');
        this.startBtn = document.getElementById('start-timer');
        this.pauseBtn = document.getElementById('pause-timer');
        this.resetBtn = document.getElementById('reset-timer');
        this.skipBtn = document.getElementById('skip-timer');
        this.extendBtn = document.getElementById('extend-timer');
        this.progressBar = document.getElementById('progress-bar');
        this.stepLabelElement = document.getElementById('timer-step-label');
        this.stepNameElement = document.getElementById('timer-step-name');
        this.nextElement = document.getElementById('timer-next');
        this.stepperElement = document.getElementById('timer-stepper');
        this.segmentsElement = document.getElementById('timer-progress-segments');
        this.modeButtons = document.querySelectorAll('#timer-mode .mode-btn');
        this.bufferInput = document.getElementById('buffer-seconds');
        this.toggleCustomBtn = document.getElementById('toggle-custom');
        this.customBadge = document.getElementById('custom-badge');
        this.editorElement = document.getElementById('timer-editor');
        this.timerCardElement = document.querySelector('.timer-card');
        this.darkroomToggle = document.getElementById('darkroom-toggle');
        this.darkroomOptions = document.getElementById('darkroom-options');
        this.darkroomFocusBtn = document.getElementById('darkroom-focus');
        this.darkroomChimesBtn = document.getElementById('darkroom-chimes');
        this.darkroomSleepBtn = document.getElementById('darkroom-sleep');
        this.focusOverlay = document.getElementById('focus-overlay');
        this.focusStepLabel = document.getElementById('focus-step-label');
        this.focusStepName = document.getElementById('focus-step-name');
        this.focusTime = document.getElementById('focus-time');
        this.focusNext = document.getElementById('focus-next');
        this.focusPauseBtn = document.getElementById('focus-pause');
        this.focusSkipBtn = document.getElementById('focus-skip');
        this.focusExitBtn = document.getElementById('focus-exit');
        this.editorOpen = false;
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.skipBtn.addEventListener('click', () => this.skip());
        this.extendBtn.addEventListener('click', () => this.extend(30));

        this.modeButtons.forEach(button => {
            button.addEventListener('click', () => this.setTransitionMode(button.dataset.mode));
        });

        this.bufferInput.addEventListener('change', () => {
            this.bufferSeconds = this.clampBuffer(parseInt(this.bufferInput.value, 10));
            this.bufferInput.value = this.bufferSeconds;
            this.saveSetting('darkroompro.timer.buffer', String(this.bufferSeconds));
        });

        this.toggleCustomBtn.addEventListener('click', () => this.toggleEditor());

        this.darkroomToggle.addEventListener('click', () => this.toggleDarkroom());
        this.darkroomFocusBtn.addEventListener('click', () => this.toggleDarkroomOption('focus'));
        this.darkroomChimesBtn.addEventListener('click', () => this.toggleDarkroomOption('chimes'));
        this.darkroomSleepBtn.addEventListener('click', () => this.toggleDarkroomOption('sleep'));

        this.focusPauseBtn.addEventListener('click', () => this.focusPrimary());
        this.focusSkipBtn.addEventListener('click', () => this.skip());
        this.focusExitBtn.addEventListener('click', () => this.hideFocus());

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.focusVisible) this.hideFocus();
        });
    }

    // --- Settings ---
    loadSetting(key, fallback) {
        try {
            return localStorage.getItem(key) || fallback;
        } catch (error) {
            return fallback;
        }
    }

    saveSetting(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn('Unable to persist timer setting', error);
        }
    }

    clampBuffer(value) {
        if (!Number.isFinite(value)) return 5;
        return Math.min(60, Math.max(1, value));
    }

    setTransitionMode(mode) {
        if (!['auto', 'buffer', 'manual'].includes(mode)) return;
        this.transitionMode = mode;
        this.saveSetting('darkroompro.timer.mode', mode);
        this.applyModeUI();
    }

    applyModeUI() {
        this.modeButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.mode === this.transitionMode);
        });
        this.bufferInput.style.display = this.transitionMode === 'buffer' ? 'inline-block' : 'none';
        if (this.transitionMode === 'buffer') {
            this.bufferInput.value = this.bufferSeconds;
        }
    }

    // --- Darkroom mode ---
    toggleDarkroom() {
        this.darkroom.enabled = !this.darkroom.enabled;
        this.applyDarkroomUI();
        if (this.darkroom.enabled) {
            this.showFocus();
            this.playSound('start');
        } else {
            this.hideFocus();
            this.playSound('reset');
        }
    }

    toggleDarkroomOption(option) {
        this.darkroom[option] = !this.darkroom[option];
        this.saveSetting(`darkroompro.darkroom.${option}`, this.darkroom[option] ? 'on' : 'off');
        this.applyDarkroomUI();
    }

    applyDarkroomUI() {
        document.body.classList.toggle('darkroom', this.darkroom.enabled);
        if (this.darkroomToggle) this.darkroomToggle.classList.toggle('active', this.darkroom.enabled);
        if (this.darkroomOptions) this.darkroomOptions.style.display = this.darkroom.enabled ? 'inline-flex' : 'none';
        if (this.darkroomFocusBtn) this.darkroomFocusBtn.classList.toggle('active', this.darkroom.focus);
        if (this.darkroomChimesBtn) this.darkroomChimesBtn.classList.toggle('active', this.darkroom.chimes);
        if (this.darkroomSleepBtn) this.darkroomSleepBtn.classList.toggle('active', this.darkroom.sleep);
        this.updateSleepBlock();
    }

    updateSleepBlock() {
        const active = this.state === 'running' || this.state === 'buffering' || this.state === 'awaiting' || !!this.pendingResume;
        const shouldBlock = this.darkroom.enabled && this.darkroom.sleep && active;
        if (shouldBlock === this.sleepBlocked) return;
        this.sleepBlocked = shouldBlock;
        if (window.rustBridge && window.rustBridge.setSleepBlock) {
            window.rustBridge.setSleepBlock(shouldBlock);
        }
    }

    // --- Focus display ---
    showFocus() {
        this.focusVisible = true;
        document.body.classList.add('focus-open');
        if (this.focusOverlay) this.focusOverlay.style.display = 'flex';
        if (window.rustBridge && window.rustBridge.setFullscreen) {
            window.rustBridge.setFullscreen(true);
        }
        this.updateFocusOverlay();
    }

    hideFocus() {
        this.focusVisible = false;
        document.body.classList.remove('focus-open');
        if (this.focusOverlay) this.focusOverlay.style.display = 'none';
        if (window.rustBridge && window.rustBridge.setFullscreen) {
            window.rustBridge.setFullscreen(false);
        }
    }

    updateFocusOverlay() {
        if (!this.focusOverlay || !this.focusVisible) return;
        const step = this.steps[this.currentIndex];
        this.focusStepLabel.textContent = this.stepLabelElement ? this.stepLabelElement.textContent : '';
        this.focusStepName.textContent = step ? step.name : '';
        this.focusTime.textContent = this.displayElement ? this.displayElement.textContent : '00:00';
        this.focusNext.textContent = this.nextElement ? this.nextElement.textContent : '';

        if (this.state === 'running' || this.state === 'buffering') {
            this.focusPauseBtn.textContent = 'Pause';
        } else if (this.state === 'awaiting') {
            this.focusPauseBtn.textContent = 'Start Next Step';
        } else if (this.pendingResume) {
            this.focusPauseBtn.textContent = 'Resume';
        } else {
            this.focusPauseBtn.textContent = 'Start';
        }
    }

    focusPrimary() {
        if (this.state === 'idle' && !this.pendingResume && this.steps.length > 0) {
            this.start();
        } else {
            this.pause();
        }
    }

    // --- Agitation cues ---
    prepareCues() {
        this.firedCues = new Set();
        this.activeCue = null;
        const step = this.steps[this.currentIndex];
        this.cues = (window.processSteps && step && step.agitation && step.time_minutes != null)
            ? window.processSteps.buildAgitationCues(step)
            : [];
    }

    updateCueState() {
        if (this.state !== 'running' || this.cues.length === 0) {
            this.activeCue = null;
            return;
        }

        const duration = this.currentStepDuration();
        const elapsed = Math.max(0, duration - this.remaining);

        for (const cue of this.cues) {
            if (!this.firedCues.has(cue.startSeconds) && elapsed >= cue.startSeconds) {
                this.firedCues.add(cue.startSeconds);
                if (this.darkroom.enabled && this.darkroom.chimes) {
                    this.playSound('agitate');
                }
            }
        }

        this.activeCue = this.cues.find(cue => elapsed >= cue.startSeconds && elapsed < cue.startSeconds + cue.durationSeconds) || null;
        if (this.timerCardElement) {
            this.timerCardElement.classList.toggle('agitating', !!this.activeCue);
        }
    }

    // --- Steps ---
    setSteps(steps, context) {
        this.presetSteps = (steps || []).map(step => ({ ...step }));
        this.context = context || null;
        this.customized = false;

        const stored = this.context ? this.loadSetting(this.customKey(), null) : null;
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.steps = parsed;
                    this.customized = true;
                }
            } catch (error) {
                console.warn('Ignoring invalid stored custom steps', error);
            }
        }
        if (!this.customized) {
            this.steps = this.presetSteps.map(step => ({ ...step }));
        }

        this.stopTicking();
        this.state = 'idle';
        this.currentIndex = 0;
        this.remaining = this.stepDuration(0);
        this.prepareCues();
        this.render();
    }

    setDuration(seconds) {
        this.setSteps([{ name: 'Developer', kind: 'developer', time_minutes: seconds / 60, temperature_c: null }], null);
    }

    getSteps() {
        return this.steps.map(step => ({ ...step }));
    }

    customKey() {
        if (!this.context) return 'darkroompro.timer.custom';
        return `darkroompro.timer.custom.${this.context.filmKey}.${this.context.developerKey}`;
    }

    persistCustom() {
        if (!this.context) return;
        this.saveSetting(this.customKey(), JSON.stringify(this.steps));
    }

    stepDuration(index) {
        const step = this.steps[index];
        if (!step || step.time_minutes == null) return 0;
        return Math.round(step.time_minutes * 60);
    }

    // --- Controls ---
    start() {
        if (this.steps.length === 0) {
            alert('Please calculate development time first');
            return;
        }

        if (this.state === 'awaiting') {
            this.advanceToNextTimed();
            return;
        }

        if (this.state === 'idle' || this.state === 'done') {
            if (this.state === 'done') this.reset();
            if (!this.pendingResume && this.darkroom.enabled && this.darkroom.focus) this.showFocus();
            this.beginStep();
        } else if (this.state === 'running' || this.state === 'buffering') {
            return;
        }
    }

    pause() {
        if (this.state === 'running') {
            this.remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
            this.stopTicking();
            this.state = 'idle';
            this.pendingResume = true;
            this.updateButtons();
            this.playSound('pause');
        } else if (this.state === 'buffering') {
            this.remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
            this.stopTicking();
            this.state = 'idle';
            this.pendingResume = 'buffer';
            this.updateButtons();
            this.playSound('pause');
        } else if (this.pendingResume) {
            if (this.pendingResume === 'buffer') {
                this.startBufferCountdown(true);
            } else {
                this.resumeStep();
            }
            this.pendingResume = false;
        }
    }

    reset() {
        this.stopTicking();
        this.clearAutoPrompt();
        this.state = 'idle';
        this.currentIndex = 0;
        this.pendingResume = false;
        this.remaining = this.stepDuration(0);
        this.prepareCues();
        this.hideFocus();
        this.render();
        this.playSound('reset');
    }

    skip() {
        if (this.steps.length === 0 || this.state === 'done') return;

        if (this.state === 'idle') {
            if (this.currentIndex < this.steps.length - 1) {
                this.currentIndex++;
                this.remaining = this.stepDuration(this.currentIndex);
                this.pendingResume = false;
                this.prepareCues();
                this.render();
            } else {
                this.complete();
            }
            return;
        }

        this.stopTicking();
        this.clearAutoPrompt();
        this.onStepComplete({ skipped: true });
    }

    extend(seconds) {
        if (this.state === 'running' || this.state === 'buffering') {
            this.deadline += seconds * 1000;
            this.remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
        } else if (this.steps.length > 0) {
            this.remaining += seconds;
        }
        this.updateDisplay();
    }

    beginStep(resume = false) {
        this.pendingResume = false;
        this.state = 'running';
        if (!resume) this.prepareCues();
        this.remaining = this.remaining > 0 ? this.remaining : this.stepDuration(this.currentIndex);
        this.deadline = Date.now() + this.remaining * 1000;
        this.startTicking();
        this.updateButtons();
        this.playSound('start');
        this.render();
    }

    resumeStep() {
        this.beginStep(true);
    }

    startTicking() {
        this.stopTicking();
        this.interval = setInterval(() => this.tick(), 250);
    }

    stopTicking() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    tick() {
        const now = Date.now();
        const previous = this.remaining;
        this.remaining = Math.max(0, Math.ceil((this.deadline - now) / 1000));

        this.updateCueState();
        this.updateDisplay();
        this.updateProgress();

        if (previous !== this.remaining) {
            if (this.remaining === 30 || this.remaining === 10 || (this.remaining === 5 && previous > 5 && this.currentStepDuration() <= 45)) {
                this.playSound('warning');
            }
        }

        if (now >= this.deadline) {
            this.onStepComplete({});
        }
    }

    currentStepDuration() {
        return this.stepDuration(this.currentIndex);
    }

    onStepComplete({ skipped }) {
        this.stopTicking();

        const wasLast = this.currentIndex >= this.steps.length - 1;
        if (wasLast) {
            this.complete();
            return;
        }

        if (skipped || this.transitionMode === 'auto') {
            if (!skipped) this.playSound('step');
            this.autoAdvance();
        } else if (this.transitionMode === 'buffer') {
            this.playSound('step');
            this.startBufferCountdown();
        } else {
            this.playSound('step');
            this.waitForManual();
        }
    }

    autoAdvance() {
        const nextIndex = this.nextTimedIndex(this.currentIndex + 1);
        if (nextIndex === -1) {
            this.currentIndex = this.steps.length - 1;
            this.complete();
            return;
        }

        const untimedSkipped = [];
        for (let i = this.currentIndex + 1; i < nextIndex; i++) {
            untimedSkipped.push(this.steps[i].name);
        }

        this.currentIndex = nextIndex;
        this.remaining = this.stepDuration(this.currentIndex);
        this.beginStep();

        if (untimedSkipped.length > 0) {
            this.showAutoPrompt(untimedSkipped.join(' → '));
        }
    }

    startBufferCountdown(resume) {
        let nextIndex = this.currentIndex + 1;
        const labels = [];
        while (nextIndex < this.steps.length && this.steps[nextIndex].time_minutes == null) {
            labels.push(this.steps[nextIndex].name);
            nextIndex++;
        }

        if (nextIndex >= this.steps.length) {
            this.currentIndex = this.steps.length - 1;
            this.complete();
            return;
        }

        this.pendingIndex = nextIndex;
        this.bufferLabels = labels.length > 0 ? labels.join(' → ') : this.steps[nextIndex].name;
        this.state = 'buffering';
        if (!resume || !this.remaining) {
            this.remaining = this.bufferSeconds;
        }
        this.deadline = Date.now() + this.remaining * 1000;
        this.startTicking();
        this.updateButtons();
        this.render();
    }

    waitForManual() {
        this.state = 'awaiting';
        this.remaining = 0;

        let nextIndex = this.currentIndex + 1;
        while (nextIndex < this.steps.length && this.steps[nextIndex].time_minutes == null) {
            nextIndex++;
        }
        this.pendingIndex = nextIndex;
        this.render();
        this.updateButtons();
    }

    advanceToNextTimed() {
        if (this.pendingIndex == null || this.pendingIndex >= this.steps.length) {
            this.complete();
            return;
        }
        this.currentIndex = this.pendingIndex;
        this.remaining = this.stepDuration(this.currentIndex);
        this.beginStep();
    }

    nextTimedIndex(from) {
        for (let i = from; i < this.steps.length; i++) {
            if (this.steps[i].time_minutes != null) return i;
        }
        return -1;
    }

    complete() {
        this.stopTicking();
        this.state = 'done';
        this.remaining = 0;
        this.updateButtons();
        this.updateDisplay();
        this.render();
        this.playSound('complete');
        this.flashTimer();

        setTimeout(() => {
            alert('🎉 Process Complete!\n\nAll steps are finished.');
        }, 500);
    }

    // --- Rendering ---
    render() {
        this.renderStepper();
        this.renderSegments();
        this.updateDisplay();
        this.updateProgress();
        this.updateButtons();
        this.updateCustomUI();
    }

    renderStepper() {
        if (!this.stepperElement) return;
        this.stepperElement.innerHTML = '';

        this.steps.forEach((step, index) => {
            const chip = document.createElement('div');
            chip.className = 'timer-step-chip';
            if (index < this.currentIndex || this.state === 'done') chip.classList.add('done');
            if (index === this.currentIndex && this.state !== 'done') chip.classList.add('active');
            if (step.time_minutes == null) chip.classList.add('untimed');
            chip.textContent = step.name;
            chip.title = step.time_minutes != null
                ? `${step.time_minutes} min${step.temperature_c != null ? ' @ ' + step.temperature_c + '°C' : ''}`
                : 'Untimed step';
            if (this.state === 'idle' || this.state === 'done') {
                chip.addEventListener('click', () => {
                    this.stopTicking();
                    this.state = 'idle';
                    this.pendingResume = false;
                    this.currentIndex = index;
                    this.remaining = this.stepDuration(index);
                    this.prepareCues();
                    this.render();
                });
            }
            this.stepperElement.appendChild(chip);
        });
    }

    renderSegments() {
        if (!this.segmentsElement) return;
        this.segmentsElement.innerHTML = '';
        this.steps.forEach((step, index) => {
            const segment = document.createElement('div');
            segment.className = 'timer-segment';
            if (index < this.currentIndex) segment.classList.add('done');
            if (index === this.currentIndex) segment.classList.add('active');
            const fill = document.createElement('div');
            fill.className = 'timer-segment-fill';
            segment.appendChild(fill);
            this.segmentsElement.appendChild(segment);
        });
        this.updateSegmentProgress();
    }

    updateSegmentProgress() {
        if (!this.segmentsElement) return;
        const segments = this.segmentsElement.children;
        for (let i = 0; i < segments.length; i++) {
            const fill = segments[i].firstChild;
            if (!fill) continue;
            if (i < this.currentIndex) {
                fill.style.width = '100%';
            } else if (i === this.currentIndex && this.state !== 'done' && this.currentStepDuration() > 0) {
                const progress = Math.max(0, (this.currentStepDuration() - this.remaining) / this.currentStepDuration() * 100);
                fill.style.width = `${Math.min(100, progress)}%`;
            } else {
                fill.style.width = '0%';
            }
        }
    }

    updateDisplay() {
        const wholeSeconds = Math.max(0, Math.round(this.remaining));
        const minutes = Math.floor(wholeSeconds / 60);
        const seconds = wholeSeconds % 60;

        if (this.steps.length === 0) {
            this.displayElement.textContent = '00:00';
            if (this.stepLabelElement) this.stepLabelElement.textContent = 'No process loaded';
            if (this.stepNameElement) this.stepNameElement.textContent = '';
            if (this.nextElement) this.nextElement.textContent = '';
            return;
        }

        const step = this.steps[this.currentIndex];
        const isUntimed = step && step.time_minutes == null;

        if (this.state === 'buffering') {
            this.displayElement.textContent = `00:${seconds.toString().padStart(2, '0')}`;
            if (this.stepNameElement) this.stepNameElement.textContent = 'Buffer';
            if (this.nextElement) this.nextElement.textContent = `Next: ${this.bufferLabels} — pour in ${wholeSeconds}…`;
        } else if (this.state === 'awaiting') {
            this.displayElement.textContent = '00:00';
            const nextStep = this.steps[this.pendingIndex];
            if (this.stepNameElement) this.stepNameElement.textContent = nextStep ? nextStep.name : '';
            if (this.nextElement) this.nextElement.textContent = 'Ready — press Start';
        } else {
            this.displayElement.textContent = isUntimed
                ? '--:--'
                : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            if (this.stepNameElement) this.stepNameElement.textContent = step ? step.name : '';
            if (this.nextElement) {
                const next = this.steps[this.currentIndex + 1];
                this.nextElement.textContent = next ? `Next: ${next.name}` : '';
            }
        }

        if (this.stepLabelElement) {
            this.stepLabelElement.textContent = `Step ${this.currentIndex + 1} of ${this.steps.length}${step && step.temperature_c != null ? ` · ${step.temperature_c}°C` : ''}`;
        }

        if (this.activeCue) {
            const duration = this.currentStepDuration();
            const elapsed = Math.max(0, duration - this.remaining);
            const left = Math.max(1, Math.ceil(this.activeCue.startSeconds + this.activeCue.durationSeconds - elapsed));
            if (this.nextElement) this.nextElement.textContent = `Agitate now — ${left}s`;
        }

        if (this.state === 'buffering') {
            this.displayElement.style.color = 'var(--film-amber)';
        } else if (wholeSeconds <= 0 && this.state !== 'idle') {
            this.displayElement.style.color = 'var(--error)';
        } else if (wholeSeconds <= 30) {
            this.displayElement.style.color = 'var(--warning)';
        } else {
            this.displayElement.style.color = 'var(--accent-color)';
        }

        this.updateFocusOverlay();
    }

    updateProgress() {
        if (!this.progressBar) return;
        const duration = this.currentStepDuration();
        if (duration === 0 || this.state === 'awaiting') {
            this.progressBar.style.width = '0%';
        } else {
            const progress = Math.max(0, (duration - this.remaining) / duration * 100);
            this.progressBar.style.width = `${Math.min(100, progress)}%`;
        }
        this.updateSegmentProgress();
    }

    updateButtons() {
        const hasSteps = this.steps.length > 0;
        const running = this.state === 'running' || this.state === 'buffering';

        if (running) {
            this.startBtn.style.display = 'none';
            this.pauseBtn.style.display = 'inline-block';
            this.pauseBtn.textContent = 'Pause';
        } else if (this.state === 'awaiting') {
            this.startBtn.style.display = 'inline-block';
            this.startBtn.textContent = 'Start Next Step';
            this.pauseBtn.style.display = 'none';
        } else if (this.pendingResume) {
            this.startBtn.style.display = 'none';
            this.pauseBtn.style.display = 'inline-block';
            this.pauseBtn.textContent = 'Resume';
        } else if (this.state === 'done') {
            this.startBtn.style.display = 'none';
            this.pauseBtn.style.display = 'none';
        } else {
            this.startBtn.style.display = 'inline-block';
            this.startBtn.textContent = 'Start';
            this.pauseBtn.style.display = 'inline-block';
            this.pauseBtn.textContent = 'Pause';
        }

        this.skipBtn.style.display = hasSteps && this.state !== 'done' ? 'inline-block' : 'none';
        this.extendBtn.style.display = hasSteps ? 'inline-block' : 'none';

        this.updateSleepBlock();
        this.updateFocusOverlay();
    }

    showAutoPrompt(label) {
        if (!this.nextElement) return;
        this.clearAutoPrompt();
        this.nextElement.textContent = `${label} — done`;
        this.autoPromptTimeout = setTimeout(() => {
            this.autoPromptTimeout = null;
            this.updateDisplay();
        }, 4000);
    }

    clearAutoPrompt() {
        if (this.autoPromptTimeout) {
            clearTimeout(this.autoPromptTimeout);
            this.autoPromptTimeout = null;
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

    // --- Custom editor ---
    toggleEditor() {
        this.editorOpen = !this.editorOpen;
        this.editorElement.style.display = this.editorOpen ? 'block' : 'none';
        this.toggleCustomBtn.textContent = this.editorOpen ? 'Hide Step Editor' : 'Customize Steps';
        if (this.editorOpen) this.renderEditor();
    }

    updateCustomUI() {
        if (this.customBadge) {
            this.customBadge.style.display = this.customized ? 'inline-block' : 'none';
        }
        if (this.editorOpen) this.renderEditor();
    }

    renderEditor() {
        if (!this.editorElement) return;
        this.editorElement.innerHTML = '';

        const list = document.createElement('div');
        list.className = 'timer-editor-list';

        this.steps.forEach((step, index) => {
            const row = document.createElement('div');
            row.className = 'timer-editor-row';

            const name = document.createElement('input');
            name.type = 'text';
            name.className = 'editor-name';
            name.value = step.name;
            name.addEventListener('input', () => { step.name = name.value; this.onCustomEdit(); });

            const time = document.createElement('input');
            time.type = 'number';
            time.className = 'editor-time';
            time.min = '0';
            time.step = '0.25';
            time.placeholder = 'min';
            time.value = step.time_minutes != null ? step.time_minutes : '';
            time.addEventListener('input', () => {
                step.time_minutes = time.value === '' ? null : parseFloat(time.value);
                this.onCustomEdit();
            });

            const temp = document.createElement('input');
            temp.type = 'number';
            temp.className = 'editor-temp';
            temp.step = '0.1';
            temp.placeholder = '°C';
            temp.value = step.temperature_c != null ? step.temperature_c : '';
            temp.addEventListener('input', () => {
                step.temperature_c = temp.value === '' ? null : parseFloat(temp.value);
                this.onCustomEdit();
            });

            const up = document.createElement('button');
            up.className = 'timer-btn ghost small';
            up.textContent = '↑';
            up.title = 'Move up';
            up.disabled = index === 0;
            up.addEventListener('click', () => this.moveStep(index, -1));

            const down = document.createElement('button');
            down.className = 'timer-btn ghost small';
            down.textContent = '↓';
            down.title = 'Move down';
            down.disabled = index === this.steps.length - 1;
            down.addEventListener('click', () => this.moveStep(index, 1));

            const remove = document.createElement('button');
            remove.className = 'timer-btn ghost small danger';
            remove.textContent = '×';
            remove.title = 'Remove step';
            remove.addEventListener('click', () => this.removeStep(index));

            row.appendChild(name);
            row.appendChild(time);
            row.appendChild(temp);
            row.appendChild(up);
            row.appendChild(down);
            row.appendChild(remove);
            list.appendChild(row);
        });

        this.editorElement.appendChild(list);

        const addRow = document.createElement('div');
        addRow.className = 'timer-editor-add';

        const select = document.createElement('select');
        Object.keys(window.processSteps.STEP_LIBRARY).forEach(kind => {
            const option = document.createElement('option');
            option.value = kind;
            option.textContent = window.processSteps.STEP_LIBRARY[kind].name;
            select.appendChild(option);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'timer-btn ghost';
        addBtn.textContent = 'Add Step';
        addBtn.addEventListener('click', () => this.addStep(select.value));

        const resetBtn = document.createElement('button');
        resetBtn.className = 'timer-btn ghost';
        resetBtn.textContent = 'Reset to Preset';
        resetBtn.addEventListener('click', () => this.resetCustom());

        addRow.appendChild(select);
        addRow.appendChild(addBtn);
        addRow.appendChild(resetBtn);
        this.editorElement.appendChild(addRow);
    }

    addStep(kind) {
        const defaultTemperature = this.context && this.context.temperature != null ? this.context.temperature : 20;
        const step = window.processSteps.createStep(kind, { temperature_c: defaultTemperature });
        this.steps.push(step);
        this.customized = true;
        this.persistCustom();
        this.applyCustomChange();
    }

    removeStep(index) {
        if (this.steps.length <= 1) return;
        this.steps.splice(index, 1);
        this.customized = true;
        this.persistCustom();
        this.applyCustomChange();
    }

    moveStep(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= this.steps.length) return;
        const [step] = this.steps.splice(index, 1);
        this.steps.splice(target, 0, step);
        this.customized = true;
        this.persistCustom();
        this.applyCustomChange();
    }

    resetCustom() {
        this.steps = this.presetSteps.map(step => ({ ...step }));
        this.customized = false;
        if (this.context) {
            try {
                localStorage.removeItem(this.customKey());
            } catch (error) {
                console.warn('Unable to clear stored custom steps', error);
            }
        }
        this.applyCustomChange();
    }

    onCustomEdit() {
        this.customized = true;
        this.scheduleCustomPersist();
        if (this.customBadge) {
            this.customBadge.style.display = 'inline-block';
        }
        this.renderStepper();
        this.renderSegments();
        this.updateDisplay();
    }

    scheduleCustomPersist() {
        if (this.persistTimeout) {
            clearTimeout(this.persistTimeout);
        }
        this.persistTimeout = setTimeout(() => {
            this.persistTimeout = null;
            this.persistCustom();
        }, 300);
    }

    applyCustomChange() {
        this.stopTicking();
        this.state = 'idle';
        this.pendingResume = false;
        this.currentIndex = 0;
        this.remaining = this.stepDuration(0);
        this.prepareCues();
        this.render();
    }

    playSound(type) {
        const frequencies = {
            start: 800,
            pause: 600,
            reset: 400,
            warning: 1000,
            step: 950,
            lowstep: 700,
            agitate: 880,
            agitateHigh: 1180,
            complete: 1200
        };

        const beep = (frequency) => {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                return true;
            } catch (error) {
                return false;
            }
        };

        if (!beep(frequencies[type] || 800)) {
            console.log(`Timer ${type} sound`);
            return;
        }

        if (type === 'step') {
            setTimeout(() => beep(frequencies.lowstep), 220);
        } else if (type === 'agitate') {
            setTimeout(() => beep(frequencies.agitateHigh), 140);
            setTimeout(() => beep(frequencies.agitate), 280);
        } else if (type === 'complete') {
            setTimeout(() => beep(frequencies.warning), 300);
            setTimeout(() => beep(frequencies.warning), 600);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.abs(seconds) % 60;
        const sign = seconds < 0 ? '-' : '';
        return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.developmentTimer = new DevelopmentTimer();
});
