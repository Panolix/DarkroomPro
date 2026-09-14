import { STEP_LIBRARY, buildPresetSteps, createStep, summarizeSteps, buildAgitationCues, describeAgitation } from '../steps.js';

let failures = 0;

function check(name, condition, detail) {
    if (condition) {
        console.log(`  ok  ${name}`);
    } else {
        failures++;
        console.error(`FAIL  ${name}${detail ? ' - ' + detail : ''}`);
    }
}

const bwCombo = { temperature_c: 20, agitation_initial_seconds: 30, agitation_interval_seconds: 10, agitation_frequency_minutes: 1 };
const c41Combo = { developer_temp_c: 37.8, agitation_initial_seconds: 30, agitation_interval_seconds: 15, agitation_frequency_minutes: 0.5 };
const e6Combo = { first_dev_temp_c: 37.8, agitation_initial_seconds: 15, agitation_interval_seconds: 15, agitation_frequency_minutes: 0.5 };

console.log('B&W preset');
const bwSteps = buildPresetSteps({ type: 'black_white' }, bwCombo, 7.5);
check('single developer step', bwSteps.length === 1, JSON.stringify(bwSteps.map(s => s.name)));
check('developer time applied', bwSteps[0].time_minutes === 7.5);
check('developer temp 20C', bwSteps[0].temperature_c === 20);

console.log('C-41 preset');
const c41Steps = buildPresetSteps({ type: 'color_negative' }, c41Combo, 3.25);
check('single developer step', c41Steps.length === 1, JSON.stringify(c41Steps.map(s => s.name)));
check('developer uses calculated time', c41Steps[0].time_minutes === 3.25);
check('developer temp 37.8C', c41Steps[0].temperature_c === 37.8);
check('no bath steps preset', !c41Steps.some(s => s.kind !== 'developer'));

console.log('E-6 preset');
const e6Steps = buildPresetSteps({ type: 'slide' }, e6Combo, 6);
check('single first developer step', e6Steps.length === 1 && e6Steps[0].name === 'First Developer', JSON.stringify(e6Steps.map(s => s.name)));
check('first dev temp 37.8C', e6Steps[0].temperature_c === 37.8);

console.log('Step library');
check('all library times are empty', Object.values(STEP_LIBRARY).every(entry => entry.time == null), JSON.stringify(Object.entries(STEP_LIBRARY).filter(([, v]) => v.time != null)));
check('generic step types only', Object.keys(STEP_LIBRARY).join(',') === 'developer,first_dev,stop,reversal,color_dev,bleach,blix,fixer,wash,stabilizer,custom');
check('stop has no default time', createStep('stop').time_minutes === null);
check('fixer has no default time', createStep('fixer').time_minutes === null);
check('stabilizer has no default time', createStep('stabilizer').time_minutes === null);
check('custom has no default time', createStep('custom').time_minutes === null);
check('custom developer step gets default agitation', !!createStep('developer').agitation);
check('custom fixer has no agitation', !createStep('fixer').agitation);
check('overrides apply', createStep('fixer', { time_minutes: 3, temperature_c: 20 }).time_minutes === 3);
check('new step temperature default applies', createStep('fixer', { temperature_c: 37.8 }).temperature_c === 37.8);

console.log('Agitation cues');
const agitationSteps = buildPresetSteps({ type: 'black_white' }, bwCombo, 7.5);
check('preset step has agitation', !!agitationSteps[0].agitation && agitationSteps[0].agitation.initialSeconds === 30);

const cues = buildAgitationCues(agitationSteps[0]);
check('cue count for 7.5 min at 1/min', cues.length === 8, JSON.stringify(cues));
check('first cue starts at 0', cues[0].startSeconds === 0 && cues[0].durationSeconds === 10);
check('second cue at 60s', cues[1].startSeconds === 60);
check('no cues without agitation', buildAgitationCues({ name: 'Fixer', kind: 'fixer', time_minutes: 5 }).length === 0);
check('no cues for untimed step', buildAgitationCues({ name: 'Rinse', kind: 'wash', time_minutes: null, agitation: { initialSeconds: 10, intervalSeconds: 5, frequencyMinutes: 1 } }).length === 0);

const rapidCues = buildAgitationCues({ name: 'Developer', kind: 'developer', time_minutes: 1, agitation: { initialSeconds: 5, intervalSeconds: 5, frequencyMinutes: 0.5 } });
check('cues every 30s give 2 entries', rapidCues.length === 2, JSON.stringify(rapidCues));
check('agitation description', describeAgitation({ initialSeconds: 30, intervalSeconds: 10, frequencyMinutes: 1 }).includes('Agitate 30s'));

console.log('Summary');
const userSteps = [
    createStep('developer', { time_minutes: 3.25 }),
    createStep('blix', { time_minutes: 6.5 }),
    createStep('wash'),
    createStep('stabilizer'),
];
const summary = summarizeSteps(userSteps);
check('count', summary.count === 4);
check('timed seconds', summary.timedSeconds === Math.round((3.25 + 6.5) * 60));
check('has untimed', summary.hasUntimed === true);

if (failures > 0) {
    console.error(`\n${failures} step test(s) failed`);
    process.exit(1);
}
console.log('\nAll step tests passed');
