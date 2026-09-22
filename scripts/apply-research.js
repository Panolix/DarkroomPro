// Applies researched Massive Dev Chart values to complete_database.json.
// Strategy (guarded):
//  - B&W combo: if researched base is present AND within 20% of the current base,
//    apply the researched base and a strictly monotonic push/pull chain.
//    Otherwise keep the current base and only null-out inconsistent push/pull
//    values (so the app falls back to its documented multipliers).
//  - Non-B&W: reconcile push/pull with the process tables.
// Run: node scripts/apply-research.js [--dry]
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = join(root, 'complete_database.json');
const researchPath = join(root, 'scripts', 'research', 'bw-mdc.json');
const dry = process.argv.includes('--dry');

const db = JSON.parse(readFileSync(dbPath, 'utf8'));
const research = JSON.parse(readFileSync(researchPath, 'utf8'));

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const within = (a, b, pct) => a != null && b != null && Math.abs(a - b) / b <= pct;

function chainUp(base, cands) {
  let prev = base;
  return cands.map((c) => {
    const v = num(c);
    if (v != null && v > prev + 1e-9) { prev = v; return v; }
    return null;
  });
}
function chainDown(base, cands) {
  let prev = base;
  return cands.map((c) => {
    const v = num(c);
    if (v != null && v < prev - 1e-9) { prev = v; return v; }
    return null;
  });
}
function setMaybe(obj, key, val) {
  if (val == null) delete obj[key];
  else obj[key] = val;
}
function consistencyFix(cd) {
  const base = num(cd.time_minutes);
  if (base == null) return false;
  const [p1, p2, p3] = chainUp(base, [cd.push_1_stop_minutes, cd.push_2_stop_minutes, cd.push_3_stop_minutes]);
  const [q1, q2] = chainDown(base, [cd.pull_1_stop_minutes, cd.pull_2_stop_minutes]);
  const before = JSON.stringify([cd.push_1_stop_minutes, cd.push_2_stop_minutes, cd.push_3_stop_minutes, cd.pull_1_stop_minutes, cd.pull_2_stop_minutes]);
  setMaybe(cd, 'push_1_stop_minutes', p1);
  setMaybe(cd, 'push_2_stop_minutes', p2);
  setMaybe(cd, 'push_3_stop_minutes', p3);
  setMaybe(cd, 'pull_1_stop_minutes', q1);
  setMaybe(cd, 'pull_2_stop_minutes', q2);
  const after = JSON.stringify([cd.push_1_stop_minutes, cd.push_2_stop_minutes, cd.push_3_stop_minutes, cd.pull_1_stop_minutes, cd.pull_2_stop_minutes]);
  return before !== after;
}

const report = { applied: [], baseKept: [], consistency: [], color: [] };

// Cases where the researched base differs >20% but the current DB value is a
// known underestimate and the MDC value is the correct one.
const forceApply = new Set([
  'fuji_acros_100|ilford_ddx_1_4',
  'fuji_acros_100|kodak_d76_1_1',
  'fuji_acros_100|ilford_id11_stock',
  'fuji_acros_100|ilford_id11_1_1',
  'fuji_acros_ii_100|ilford_ddx_1_4',
  'fuji_acros_ii_100|kodak_d76_1_1',
  'fuji_acros_ii_100|ilford_id11_stock',
  'fuji_acros_ii_100|ilford_id11_1_1',
  'ilford_fp4_plus|kodak_d76_1_3',
  'kodak_tmax_p3200|kodak_xtol_stock',
]);

for (const [filmKey, film] of Object.entries(db.films)) {
  if (film.type !== 'black_white') continue;
  let rFilm = research.films[filmKey];
  if (!rFilm && filmKey === 'fuji_acros_100') rFilm = research.films['fuji_acros_ii_100'];
  for (const [devKey, cd] of Object.entries(film.developers)) {
    const r = rFilm && rFilm.combos ? rFilm.combos[devKey] : null;
    const curBase = num(cd.time_minutes);
    if (r && num(r.base) != null && (within(r.base, curBase, 0.2) || forceApply.has(`${filmKey}|${devKey}`))) {
      const base = r.base;
      cd.time_minutes = base;
      const [p1, p2, p3] = chainUp(base, [r.push1, r.push2, r.push3]);
      const [q1, q2] = chainDown(base, [r.pull1, r.pull2]);
      cd.push_1_stop_minutes = p1;
      cd.push_2_stop_minutes = p2;
      setMaybe(cd, 'push_3_stop_minutes', p3);
      setMaybe(cd, 'pull_1_stop_minutes', q1);
      setMaybe(cd, 'pull_2_stop_minutes', q2);
      cd.source = 'Massive Dev Chart (digitaltruth.com)';
      cd.source_url = `https://www.digitaltruth.com/devchart.php?Film=${encodeURIComponent(film.name)}&Developer=&mdc=Search&TempUnits=C&TimeUnits=D`;
      cd.verified_date = new Date().toISOString().slice(0, 10);
      report.applied.push(`${film.name} / ${devKey}: base ${curBase} -> ${base} [p ${p1}/${p2}/${p3} q ${q1}/${q2}]`);
    } else {
      if (consistencyFix(cd)) report.consistency.push(`${film.name} / ${devKey}`);
      if (r && num(r.base) != null) {
        report.baseKept.push(`${film.name} / ${devKey}: kept ${curBase}, MDC ${r.base}`);
      }
    }
  }
}

// HC-110 dilution E is 1:47 (Kodak J-24); 1:63 is the unofficial "Dilution H".
const hc = db.developers.kodak_hc110;
if (hc && hc.dilutions && hc.dilutions.dilution_e) {
  hc.dilutions.dilution_e.ratio = '1:47';
  hc.dilutions.dilution_e.description = 'Dilution E (1+47)';
}

// Corrected developer introduction years.
Object.assign(db.developers.ilford_id11 || {}, { year_introduced: 1950 });
Object.assign(db.developers.ilford_ilfosol_3 || {}, { year_introduced: 2005 });

// Corrected film release years and native-ISO notes for pushed films.
Object.assign(db.films.kodak_portra_160 || {}, { year_released: 2011 });
Object.assign(db.films.kodak_portra_400 || {}, { year_released: 2010 });
Object.assign(db.films.kodak_tmax_p3200 || {}, {
  iso_note: 'Native ISO ~800; P3200 is a push rating.',
});
Object.assign(db.films.ilford_delta_3200 || {}, {
  iso_note: 'Native ISO ~1000; rated 3200 (push).',
});

// Colour (C-41/E-6) process data, push/pull, agitation and temperature tables
// are applied by scripts/apply-color-research.js. This script only handles B&W.

// Agitation: Ilford developers use Ilford's 10s initial pattern; everything else
// keeps the Kodak 30s pattern.
for (const film of Object.values(db.films)) {
  if (film.type !== 'black_white') continue;
  for (const [devKey, cd] of Object.entries(film.developers)) {
    if (devKey.startsWith('ilford_')) {
      cd.agitation_initial_seconds = 10;
      cd.agitation_interval_seconds = 10;
      cd.agitation_frequency_minutes = 1;
    } else {
      cd.agitation_initial_seconds = 30;
      cd.agitation_interval_seconds = 10;
      cd.agitation_frequency_minutes = 1;
    }
  }
}

// Rodinal coverage gaps: add combos that the chart supports but the DB lacked.
// Values are the same MDC EI rows used elsewhere (box ISO = base).
const rodinalGaps = {
  ilford_delta_3200: {
    adox_rodinal_1_25: {
      dilution: '1:25', base: 11,
      push_1: 20, push_2: 40, // EI 6400 / 12800
      pull_1: 9, pull_2: 7, // EI 1600 / 800
    },
  },
  kodak_tmax_p3200: {
    adox_rodinal_1_50: { dilution: '1:50', base: 16 }, // EI 3200 row
  },
};

let rodinalAdded = 0;
for (const [filmKey, combos] of Object.entries(rodinalGaps)) {
  const film = db.films[filmKey];
  if (!film) continue;
  for (const [devKey, spec] of Object.entries(combos)) {
    if (film.developers[devKey]) continue;
    const combo = {
      dilution: spec.dilution,
      time_minutes: spec.base,
      temperature_c: 20,
      agitation_initial_seconds: 30,
      agitation_interval_seconds: 10,
      agitation_frequency_minutes: 1,
      source: 'Massive Dev Chart (digitaltruth.com)',
      source_url: `https://www.digitaltruth.com/devchart.php?Film=${encodeURIComponent(film.name)}&Developer=&mdc=Search&TempUnits=C&TimeUnits=D`,
      verified_date: new Date().toISOString().slice(0, 10),
    };
    if (spec.push_1 != null) combo.push_1_stop_minutes = spec.push_1;
    if (spec.push_2 != null) combo.push_2_stop_minutes = spec.push_2;
    if (spec.pull_1 != null) combo.pull_1_stop_minutes = spec.pull_1;
    if (spec.pull_2 != null) combo.pull_2_stop_minutes = spec.pull_2;
    film.developers[devKey] = combo;
    rodinalAdded++;
  }
}

// Merge manufacturer exposure-index tables (Ilford datasheets, Kodak F-4016/17,
// Fuji/Foma/CineStill) so push/pull comes from the manufacturer where published.
const DEV_MAP = {
  'ID-11|stock': 'ilford_id11_stock', 'ID-11|1+1': 'ilford_id11_1_1', 'ID-11|1+3': 'ilford_id11_1_3',
  'Ilfosol 3|1+9': 'ilford_ilfosol_3_1_9', 'Ilfosol 3|1+14': 'ilford_ilfosol_3_1_14',
  'Ilfotec DD-X|1+4': 'ilford_ddx_1_4',
  'Microphen|stock': 'ilford_microphen_stock', 'Microphen|1+1': 'ilford_microphen_1_1',
  'Perceptol|stock': 'ilford_perceptol_stock', 'Perceptol|1+1': 'ilford_perceptol_1_1',
  'D-76|stock': 'kodak_d76_stock', 'D-76|1+1': 'kodak_d76_1_1', 'D-76|1+3': 'kodak_d76_1_3',
  'HC-110|A': 'kodak_hc110_a', 'HC-110|B': 'kodak_hc110_b', 'HC-110|E': 'kodak_hc110_e',
  'XTOL|stock': 'kodak_xtol_stock', 'XTOL|1+1': 'kodak_xtol_1_1', 'XTOL|1+2': 'kodak_xtol_1_2', 'XTOL|1+3': 'kodak_xtol_1_3',
  'T-Max Developer|1+4': 'kodak_tmax_developer',
  'Rodinal|1+25': 'adox_rodinal_1_25', 'Rodinal|1+50': 'adox_rodinal_1_50',
};
const COMBO_MASTER = {
  kodak_d76: 'kodak_d76', kodak_hc110: 'kodak_hc110', kodak_xtol: 'kodak_xtol',
  kodak_tmax_developer: 'kodak_tmax_developer', ilford_id11: 'ilford_id11', ilford_ddx: 'ilford_ddx',
  ilford_ilfosol_3: 'ilford_ilfosol_3', ilford_microphen: 'ilford_microphen',
  ilford_perceptol: 'ilford_perceptol', adox_rodinal: 'adox_rodinal',
};
function masterFor(comboKey) {
  for (const prefix of Object.keys(COMBO_MASTER)) {
    if (comboKey === prefix || comboKey.startsWith(prefix + '_')) return COMBO_MASTER[prefix];
  }
  return null;
}
function nearestEI(times, target) {
  const keys = Object.keys(times).map(Number).filter(Number.isFinite);
  let best = null;
  let bestDelta = Infinity;
  for (const key of keys) {
    const delta = Math.abs(key - target) / target;
    if (delta < bestDelta) { bestDelta = delta; best = key; }
  }
  return bestDelta <= 0.1 ? times[String(best)] : null;
}

let mfr = { films: {} };
try {
  mfr = JSON.parse(readFileSync(join(root, 'scripts', 'research', 'manufacturer-ei.json'), 'utf8'));
} catch (error) {
  console.warn('manufacturer-ei.json not loaded:', error.message);
}

const mfrReport = { overridden: 0, added: 0, fields: 0 };
const mfrFilms = { ...mfr.films };
if (mfrFilms.fuji_acros_ii_100) mfrFilms.fuji_acros_100 = mfrFilms.fuji_acros_ii_100;

for (const [filmKey, mFilm] of Object.entries(mfrFilms)) {
  const film = db.films[filmKey];
  if (!film) continue;
  const box = mFilm.box_iso || film.iso;
  const override = mFilm.eiOverride || {};
  const targets = {
    base: override.base != null ? override.base : box,
    push1: override.push1 != null ? override.push1 : box * 2,
    push2: override.push2 != null ? override.push2 : box * 4,
    push3: override.push3 != null ? override.push3 : box * 8,
    pull1: override.pull1 != null ? override.pull1 : box / 2,
    pull2: override.pull2 != null ? override.pull2 : box / 4,
  };

  for (const row of mFilm.rows) {
    const comboKey = DEV_MAP[`${row.dev}|${row.dilution}`];
    if (!comboKey) continue;
    const derived = {
      base: nearestEI(row.times, targets.base),
      p1: nearestEI(row.times, targets.push1),
      p2: nearestEI(row.times, targets.push2),
      p3: nearestEI(row.times, targets.push3),
      q1: nearestEI(row.times, targets.pull1),
      q2: nearestEI(row.times, targets.pull2),
    };

    let combo = film.developers[comboKey];
    if (!combo) {
      if (derived.base == null || !masterFor(comboKey)) continue;
      combo = {
        dilution: comboKey.includes('1_3') ? '1:3' : comboKey.includes('1_2') ? '1:2'
          : comboKey.includes('1_50') ? '1:50' : comboKey.includes('1_25') ? '1:25'
          : comboKey.includes('1_14') ? '1:14' : comboKey.includes('1_9') ? '1:9'
          : comboKey.includes('1_4') && !comboKey.includes('ddx') && !comboKey.includes('tmax_developer') ? '1:4'
          : comboKey.includes('1_1') ? '1:1' : 'stock',
        temperature_c: 20,
        agitation_initial_seconds: comboKey.startsWith('ilford_') ? 10 : 30,
        agitation_interval_seconds: comboKey.startsWith('ilford_') ? 10 : 10,
        agitation_frequency_minutes: 1,
        source: mFilm.source,
        source_url: `https://www.digitaltruth.com/devchart.php?Film=${encodeURIComponent(film.name)}&Developer=&mdc=Search&TempUnits=C&TimeUnits=D`,
        verified_date: new Date().toISOString().slice(0, 10),
      };
      film.developers[comboKey] = combo;
      mfrReport.added++;
    }

    if (derived.base != null) { combo.time_minutes = derived.base; combo.source = mFilm.source; mfrReport.overridden++; }
    const setIf = (key, val) => { if (val != null) { combo[key] = val; mfrReport.fields++; } };
    setIf('push_1_stop_minutes', derived.p1);
    setIf('push_2_stop_minutes', derived.p2);
    setIf('push_3_stop_minutes', derived.p3);
    setIf('pull_1_stop_minutes', derived.q1);
    setIf('pull_2_stop_minutes', derived.q2);
  }
}

// Final consistency pass: pushes non-decreasing (manufacturers sometimes specify
// the same time for +1 stop), pulls strictly decreasing.
for (const film of Object.values(db.films)) {
  if (film.type !== 'black_white') continue;
  for (const combo of Object.values(film.developers)) {
    const base = combo.time_minutes;
    if (base == null) continue;
    let prev = base;
    for (const key of ['push_1_stop_minutes', 'push_2_stop_minutes', 'push_3_stop_minutes']) {
      const value = combo[key];
      if (value == null) continue;
      if (value >= prev) prev = value; else delete combo[key];
    }
    prev = base;
    for (const key of ['pull_1_stop_minutes', 'pull_2_stop_minutes']) {
      const value = combo[key];
      if (value == null) continue;
      if (value < prev) prev = value; else delete combo[key];
    }
  }
}

console.log('Manufacturer EI: combos re-based', mfrReport.overridden, '| push/pull fields set', mfrReport.fields, '| combos added', mfrReport.added);

// Keep metadata consistent with the actual combination count.
db.metadata.total_combinations = Object.values(db.films)
  .reduce((total, film) => total + Object.keys(film.developers).length, 0);

// Document the push/pull guideline model (Massive Dev Chart) in the database.
db.calculation_formulas = {
  temperature_adjustment: {
    formula: 'adjusted_time = base_time * compensation_factor',
    description: 'Multiply base development time by the temperature compensation factor',
  },
  push_processing: {
    note: 'Massive Dev Chart push guideline, used only when no EI row is published for the combination.',
    standard_developer: { '1_stop': 1.5, '2_stop': 2.25, '3_stop': 4.5 },
    compensating_developer: { '1_stop': 1.4, '2_stop': 1.85, '3_stop': 2.5 },
    tmax_film: { '1_stop': 1.0, '2_stop': 1.33, '3_stop': 1.66 },
    source: 'https://www.digitaltruth.com/devchart.php?doc=pushproc',
  },
  pull_processing: {
    note: 'Estimated; manufacturers do not publish pull times.',
    '1_stop': 0.7,
    '2_stop': 0.5,
  },
  dilution_calculator: {
    formula: 'developer_volume = volume * developer_parts / (developer_parts + water_parts)',
    description: 'Calculate working solution from concentrate',
  },
};

console.log('B&W researched base+pull applied:', report.applied.length);
console.log('B&W consistency-only fixes:', report.consistency.length);
console.log('B&W base kept (MDC differs >20%):', report.baseKept.length);
console.log('Color/slide combos reconciled:', report.color.length);
console.log('Rodinal combos added:', rodinalAdded, '| total combinations:', db.metadata.total_combinations);
console.log('\n-- base kept (review these) --');
report.baseKept.forEach((l) => console.log('  ' + l));

if (dry) {
  console.log('\nDRY RUN - no files written');
} else {
  writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
  copyFileSync(dbPath, join(root, 'public', 'complete_database.json'));
  console.log('\nWrote complete_database.json and synced public copy');
}
