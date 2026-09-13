// Process step builder - pure functions shared by the UI and the CI tests.
// Steps: { name, kind, time_minutes (null = untimed prompt), temperature_c, typical? }

const STEP_LIBRARY = {
    developer: { name: 'Developer', kind: 'developer', time: null, temp: null },
    stop: { name: 'Stop Bath', kind: 'stop', time: 0.5, temp: null, typical: true },
    reversal: { name: 'Reversal Bath', kind: 'reversal', time: null, temp: null },
    color_dev: { name: 'Color Developer', kind: 'developer', time: null, temp: null },
    bleach: { name: 'Bleach', kind: 'bleach', time: null, temp: null },
    blix: { name: 'Blix', kind: 'blix', time: null, temp: null },
    fixer: { name: 'Fixer', kind: 'fixer', time: 5, temp: null, typical: true },
    wash: { name: 'Rinse', kind: 'wash', time: null, temp: null },
    stabilizer: { name: 'Stabilizer', kind: 'stabilizer', time: 1, temp: null, typical: true },
    custom: { name: 'Custom Step', kind: 'custom', time: 1, temp: null, typical: true },
};

function timed(name, kind, minutes, temperature) {
    return {
        name,
        kind,
        time_minutes: minutes != null ? minutes : null,
        temperature_c: temperature != null ? temperature : null,
    };
}

function untimed(name, kind) {
    return { name, kind, time_minutes: null, temperature_c: null };
}

function buildPresetSteps(film, combo, developerMinutes) {
    const steps = [];

    if (!film || !combo) return steps;

    if (film.type === 'black_white') {
        steps.push(timed('Developer', 'developer', developerMinutes, combo.temperature_c || 20));
        return steps;
    }

    if (film.type === 'color_negative') {
        steps.push(timed('Developer', 'developer', developerMinutes, combo.developer_temp_c != null ? combo.developer_temp_c : 37.8));
        if (combo.blix_time_minutes != null) {
            steps.push(untimed('Rinse', 'wash'));
            steps.push(timed('Blix', 'blix', combo.blix_time_minutes, combo.blix_temp_c != null ? combo.blix_temp_c : combo.developer_temp_c));
        } else {
            steps.push(timed('Bleach', 'bleach', combo.bleach_time_minutes, combo.bleach_temp_c));
            steps.push(untimed('Rinse', 'wash'));
            steps.push(timed('Fixer', 'fixer', combo.fixer_time_minutes, combo.fixer_temp_c));
        }
        steps.push(untimed('Rinse', 'wash'));
        steps.push(timed('Stabilizer', 'stabilizer', combo.stabilizer_time_minutes != null ? combo.stabilizer_time_minutes : 1, combo.stabilizer_temp_c));
        return steps;
    }

    if (film.type === 'slide') {
        steps.push(timed('First Developer', 'developer', developerMinutes, combo.first_dev_temp_c != null ? combo.first_dev_temp_c : 37.8));
        steps.push(untimed('Rinse', 'wash'));
        if (combo.blix_time_minutes != null) {
            steps.push(timed('Color Developer', 'developer', combo.color_dev_time_minutes, combo.color_dev_temp_c));
            steps.push(untimed('Rinse', 'wash'));
            steps.push(timed('Blix', 'blix', combo.blix_time_minutes, combo.blix_temp_c));
        } else {
            steps.push(timed('Reversal Bath', 'reversal', combo.reversal_time_minutes, combo.reversal_temp_c));
            steps.push(untimed('Rinse', 'wash'));
            steps.push(timed('Color Developer', 'developer', combo.color_dev_time_minutes, combo.color_dev_temp_c));
            steps.push(untimed('Rinse', 'wash'));
            steps.push(timed('Bleach', 'bleach', combo.bleach_time_minutes, combo.bleach_temp_c));
            steps.push(untimed('Rinse', 'wash'));
            steps.push(timed('Fixer', 'fixer', combo.fixer_time_minutes, combo.fixer_temp_c));
        }
        steps.push(untimed('Rinse', 'wash'));
        steps.push(timed('Stabilizer', 'stabilizer', combo.stabilizer_time_minutes != null ? combo.stabilizer_time_minutes : 1, combo.stabilizer_temp_c));
        return steps;
    }

    return steps;
}

function createStep(kind, overrides = {}) {
    const base = STEP_LIBRARY[kind] || STEP_LIBRARY.custom;
    return {
        name: overrides.name != null ? overrides.name : base.name,
        kind: base.kind,
        time_minutes: overrides.time_minutes !== undefined ? overrides.time_minutes : base.time,
        temperature_c: overrides.temperature_c !== undefined ? overrides.temperature_c : (base.temp != null ? base.temp : null),
        typical: base.typical === true,
    };
}

function summarizeSteps(steps) {
    const list = steps || [];
    let timedSeconds = 0;
    for (const step of list) {
        if (step.time_minutes != null) timedSeconds += Math.round(step.time_minutes * 60);
    }
    return {
        count: list.length,
        timedSeconds,
        hasUntimed: list.some(step => step.time_minutes == null),
    };
}

const api = { STEP_LIBRARY, buildPresetSteps, createStep, summarizeSteps };

if (typeof window !== 'undefined') {
    window.processSteps = api;
}

export { STEP_LIBRARY, buildPresetSteps, createStep, summarizeSteps };
