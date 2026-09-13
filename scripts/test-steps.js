import { STEP_LIBRARY, buildPresetSteps, createStep, summarizeSteps } from '../steps.js';

let failures = 0;

function check(name, condition, detail) {
    if (condition) {
        console.log(`  ok  ${name}`);
    } else {
        failures++;
        console.error(`FAIL  ${name}${detail ? ' - ' + detail : ''}`);
    }
}

const bwFilm = { type: 'black_white' };
const bwCombo = { time_minutes: 7.5 };

const blixCombo = {
    developer_time_minutes: 3.25, developer_temp_c: 37.8,
    blix_time_minutes: 6.5, blix_temp_c: 37.8,
    stabilizer_time_minutes: 1, stabilizer_temp_c: 37.8,
};
const separateCombo = {
    developer_time_minutes: 3.25, developer_temp_c: 37.8,
    bleach_time_minutes: 6.5, bleach_temp_c: 37.8,
    fixer_time_minutes: 6.5, fixer_temp_c: 37.8,
    stabilizer_time_minutes: 1, stabilizer_temp_c: 37.8,
};

console.log('B&W preset');
const bwSteps = buildPresetSteps(bwFilm, bwCombo, 7.5);
check('single developer step', bwSteps.length === 1);
check('developer time applied', bwSteps[0].time_minutes === 7.5);
check('developer temp 20C', bwSteps[0].temperature_c === 20);

console.log('C-41 blix kit');
const blixSteps = buildPresetSteps({ type: 'color_negative' }, blixCombo, 3.5);
check('step count', blixSteps.length === 5, JSON.stringify(blixSteps.map(s => s.name)));
check('order', blixSteps.map(s => s.name).join(' > ') === 'Developer > Rinse > Blix > Rinse > Stabilizer');
check('developer uses calculated time', blixSteps[0].time_minutes === 3.5);
check('rinse untimed', blixSteps[1].time_minutes === null && blixSteps[1].kind === 'wash');
check('no bleach/fixer steps', !blixSteps.some(s => s.kind === 'bleach' || s.kind === 'fixer'));

console.log('C-41 separate baths');
const sepSteps = buildPresetSteps({ type: 'color_negative' }, separateCombo, 3.25);
check('step count', sepSteps.length === 6, JSON.stringify(sepSteps.map(s => s.name)));
check('order', sepSteps.map(s => s.name).join(' > ') === 'Developer > Bleach > Rinse > Fixer > Rinse > Stabilizer');
check('no blix', !sepSteps.some(s => s.kind === 'blix'));

console.log('E-6 six-bath');
const sixBath = {
    first_dev_time_minutes: 6, first_dev_temp_c: 37.8,
    reversal_time_minutes: 2, reversal_temp_c: 37.8,
    color_dev_time_minutes: 6, color_dev_temp_c: 37.8,
    bleach_time_minutes: 6, bleach_temp_c: 37.8,
    fixer_time_minutes: 4, fixer_temp_c: 37.8,
    stabilizer_time_minutes: 1, stabilizer_temp_c: 37.8,
};
const sixSteps = buildPresetSteps({ type: 'slide' }, sixBath, 6);
check('step count', sixSteps.length === 11, JSON.stringify(sixSteps.map(s => s.name)));
check('first step first developer', sixSteps[0].name === 'First Developer');
check('has reversal and color dev', sixSteps.some(s => s.kind === 'reversal') && sixSteps.some(s => s.name === 'Color Developer'));
check('ends with stabilizer', sixSteps[sixSteps.length - 1].name === 'Stabilizer');

console.log('E-6 three-bath');
const threeBath = {
    first_dev_time_minutes: 6, first_dev_temp_c: 37.8,
    color_dev_time_minutes: 6, color_dev_temp_c: 37.8,
    blix_time_minutes: 6, blix_temp_c: 37.8,
    stabilizer_time_minutes: 1, stabilizer_temp_c: 37.8,
};
const threeSteps = buildPresetSteps({ type: 'slide' }, threeBath, 6);
check('step count', threeSteps.length === 7, JSON.stringify(threeSteps.map(s => s.name)));
check('order', threeSteps.map(s => s.name).join(' > ') === 'First Developer > Rinse > Color Developer > Rinse > Blix > Rinse > Stabilizer');

console.log('Custom library');
check('stop default 0:30', createStep('stop').time_minutes === 0.5);
check('fixer default 5:00', createStep('fixer').time_minutes === 5);
check('stabilizer default 1:00', createStep('stabilizer').time_minutes === 1);
check('typical flagged', createStep('fixer').typical === true);
check('overrides apply', createStep('fixer', { time_minutes: 3 }).time_minutes === 3);

console.log('Summary');
const summary = summarizeSteps(blixSteps);
check('count', summary.count === 5);
check('timed seconds', summary.timedSeconds === Math.round((3.5 + 6.5 + 1) * 60));
check('has untimed', summary.hasUntimed === true);

if (failures > 0) {
    console.error(`\n${failures} step test(s) failed`);
    process.exit(1);
}
console.log('\nAll step tests passed');
