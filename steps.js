// Process step builder - pure functions shared by the UI and the CI tests.
// Steps: { name, kind, time_minutes (null = untimed prompt), temperature_c, agitation? }
// Only the developer step is timed by the app; every other step starts untimed
// and its duration is entered by the user.

const STEP_LIBRARY = {
    developer: { name: 'Developer', kind: 'developer', time: null },
    first_dev: { name: 'First Developer', kind: 'developer', time: null },
    stop: { name: 'Stop Bath', kind: 'stop', time: null },
    reversal: { name: 'Reversal Bath', kind: 'reversal', time: null },
    color_dev: { name: 'Color Developer', kind: 'developer', time: null },
    bleach: { name: 'Bleach', kind: 'bleach', time: null },
    blix: { name: 'Blix', kind: 'blix', time: null },
    fixer: { name: 'Fixer', kind: 'fixer', time: null },
    wash: { name: 'Rinse', kind: 'wash', time: null },
    stabilizer: { name: 'Stabilizer', kind: 'stabilizer', time: null },
    custom: { name: 'Custom Step', kind: 'custom', time: null },
};

const DEFAULT_AGITATION = { initialSeconds: 30, intervalSeconds: 10, frequencyMinutes: 1 };

function agitationFromCombo(combo) {
    if (!combo) return null;
    if (combo.agitation_frequency_minutes == null) return null;
    return {
        initialSeconds: combo.agitation_initial_seconds != null ? combo.agitation_initial_seconds : 30,
        intervalSeconds: combo.agitation_interval_seconds != null ? combo.agitation_interval_seconds : 10,
        frequencyMinutes: combo.agitation_frequency_minutes,
    };
}

function withAgitation(step, combo) {
    const agitation = agitationFromCombo(combo);
    if (agitation) step.agitation = agitation;
    return step;
}

function timed(name, kind, minutes, temperature) {
    return {
        name,
        kind,
        time_minutes: minutes != null ? minutes : null,
        temperature_c: temperature != null ? temperature : null,
    };
}

function buildPresetSteps(film, combo, developerMinutes) {
    if (!film || !combo) return [];

    if (film.type === 'black_white') {
        return [withAgitation(timed('Developer', 'developer', developerMinutes, combo.temperature_c || 20), combo)];
    }

    if (film.type === 'color_negative') {
        return [withAgitation(timed('Developer', 'developer', developerMinutes, combo.developer_temp_c != null ? combo.developer_temp_c : 37.8), combo)];
    }

    if (film.type === 'slide') {
        return [withAgitation(timed('First Developer', 'developer', developerMinutes, combo.first_dev_temp_c != null ? combo.first_dev_temp_c : 37.8), combo)];
    }

    return [];
}

function createStep(kind, overrides = {}) {
    const base = STEP_LIBRARY[kind] || STEP_LIBRARY.custom;
    const step = {
        name: overrides.name != null ? overrides.name : base.name,
        kind: base.kind,
        time_minutes: overrides.time_minutes !== undefined ? overrides.time_minutes : null,
        temperature_c: overrides.temperature_c !== undefined ? overrides.temperature_c : null,
    };
    if (base.kind === 'developer') {
        step.agitation = overrides.agitation !== undefined ? overrides.agitation : { ...DEFAULT_AGITATION };
    }
    return step;
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

function describeAgitation(agitation) {
    if (!agitation) return null;
    return `Agitate ${agitation.initialSeconds}s at start, then ${agitation.intervalSeconds}s every ${agitation.frequencyMinutes} min`;
}

function buildAgitationCues(step) {
    const cues = [];
    if (!step || !step.agitation || step.time_minutes == null) return cues;

    const agitation = step.agitation;
    const stepSeconds = Math.round(step.time_minutes * 60);
    const frequencySeconds = Math.round(agitation.frequencyMinutes * 60);

    if (frequencySeconds <= 0) return cues;

    let start = 0;
    while (start < stepSeconds) {
        const duration = Math.min(agitation.intervalSeconds, stepSeconds - start);
        if (duration > 0) {
            cues.push({ startSeconds: start, durationSeconds: duration });
        }
        start += frequencySeconds;
    }

    return cues;
}

const api = { STEP_LIBRARY, buildPresetSteps, createStep, summarizeSteps, buildAgitationCues, describeAgitation, DEFAULT_AGITATION };

if (typeof window !== 'undefined') {
    window.processSteps = api;
}

export { STEP_LIBRARY, buildPresetSteps, createStep, summarizeSteps, buildAgitationCues, describeAgitation, DEFAULT_AGITATION };
