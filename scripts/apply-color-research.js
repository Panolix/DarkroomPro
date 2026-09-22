// Applies researched C-41 / E-6 process data to complete_database.json.
// Sources: Kodak CIS-211/Z-131 (C-41), Kodak Z-119/E-28 (E-6),
// Tetenal Colortec C-41 & E-6 kit instructions, CineStill CS41 instructions,
// Unicolor C-41/E-6 kit instructions, Bellini C41-RA technical data sheet.
// Run: node scripts/apply-color-research.js [--dry]
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = join(root, 'complete_database.json');
const dry = process.argv.includes('--dry');
const db = JSON.parse(readFileSync(dbPath, 'utf8'));

const round = (n, d = 3) => (n == null ? null : Number(n.toFixed(d)));

// Per-kit C-41 data. std = standard developer temp/time. push/pull in minutes.
const C41 = {
  kodak_flexicolor_c41: {
    stdTemp: 37.8, devTime: 3.25, tolerance: 0.15,
    push: { 1: 3.75, 2: 4.25 }, pull: {},
    agitation: { initial: 30, interval: 2, frequency: 0.25 },
    tempTable: null, // Kodak C-41 is temperature-critical, no alternative times
    capacity: 15,
    source: 'Kodak Flexicolor C-41 (CIS-211 / Z-131)',
    url: 'https://125px.com/docs/techpubs/kodak/cis211-2010_08.pdf',
  },
  tetenal_c41_kit: {
    stdTemp: 38, devTime: 3.25, tolerance: 0.5,
    push: { 1: 3.75, 2: 4.25, 3: 4.75 }, pull: {},
    agitation: { initial: 15, interval: 15, frequency: 0.5 },
    // 45C = 2:00, 38C = 3:15, 30C = 8:00
    tempTable: { 45: 0.615, 38: 1.0, 30: 2.462 },
    capacity: 16,
    source: 'Tetenal Colortec C-41 Kit instructions',
    url: 'https://www.digitaltruth.com/products/tetenal_tech/Tetenal-Colortec-C41-Kit-2.5L-Instructions.pdf',
  },
  unicolor_c41_kit: {
    stdTemp: 38.9, devTime: 3.5, tolerance: 0.3,
    push: { 1: 4.4, 2: 5.25 }, pull: {},
    agitation: { initial: 10, interval: 10, frequency: 0.5 },
    // 39C = 3:30, 23.9C = 17:30
    tempTable: { 39: 1.0, 24: 5.0 },
    capacity: 8,
    source: 'Unicolor C-41 powder kit instructions',
    url: 'https://www.freestylephoto.com/static/pdf/product_pdfs/unicolor/unicolor-c-41-powder-1-liter-instructions.pdf',
  },
  cinestill_c41_kit: {
    stdTemp: 39, devTime: 3.5, tolerance: 0.5,
    push: { 1: 4.55, 2: 6.13, 3: 8.75 }, pull: { 1: 2.75 },
    agitation: { initial: 10, interval: 10, frequency: 0.5 },
    // 39C = 3:30, 35C = 5:45, 32C = 8:30, 29.5C = 13:00, 27C = 21:00, 24C = 35:00, 22C = 50:00
    tempTable: { 39: 1.0, 35: 1.643, 32: 2.429, 29.5: 3.714, 27: 6.0, 24: 10.0, 22: 14.286 },
    capacity: 24,
    source: 'CineStill CS41 powder kit instructions',
    url: 'https://cdn.shopify.com/s/files/1/0339/5113/files/CS41powder_Instructions_Complete.pdf',
  },
  bellini_c41_kit: {
    stdTemp: 38, devTime: 3.25, tolerance: 0.2,
    push: {}, pull: {},
    agitation: { initial: 15, interval: 5, frequency: 0.5 },
    tempTable: null,
    capacity: 16,
    source: 'Bellini C41-RA technical data sheet',
    url: 'https://www.freestylephoto.com/static/pdf/product_pdf/bellini/C41_TECH_DATA_SHEET.pdf',
  },
};

// Per-kit E-6 data (first developer).
const E6 = {
  kodak_e6_kit: {
    stdTemp: 37.8, devTime: 6.0, tolerance: 0.2,
    push: { 1: 8.0, 2: 11.0, 3: 13.0 }, pull: {},
    agitation: { initial: 15, interval: 5, frequency: 0.3333 },
    tempTable: null, // temperature-critical; no alternative times published
    capacity: 10,
    source: 'Kodak Process E-6 (Z-119 / E-28)',
    url: 'https://125px.com/docs/techpubs/kodak/z119-9.pdf',
  },
  tetenal_e6_kit: {
    stdTemp: 38, devTime: 6.25, tolerance: 0.3,
    push: { 1: 8.25, 2: 11.75 }, pull: { 1: 4.25 },
    agitation: { initial: 15, interval: 10, frequency: 0.25 },
    // 38C = 6:15, 39C = 7:00
    tempTable: { 38: 1.0, 39: 1.12 },
    capacity: 12,
    source: 'Tetenal Colortec E-6 3-bath kit instructions',
    url: 'https://www.digitaltruth.com/products/tetenal_tech/Tetenal-Colortec-E6-3-Bath-Kit-2.5L-Instructions.pdf',
  },
  unicolor_e6_kit: {
    stdTemp: 37.8, devTime: 6.5, tolerance: 0.3,
    push: {}, pull: {},
    agitation: { initial: 15, interval: 15, frequency: 0.5 },
    tempTable: null,
    capacity: 8,
    source: 'Unicolor E-6 kit instructions',
    url: 'https://flicfilm.ca/wp-content/uploads/2025/05/Unitcolor-e6-instructions.pdf',
  },
};

const setMaybe = (obj, key, val) => { if (val == null) delete obj[key]; else obj[key] = val; };

function applyKit(combo, type, kit) {
  const isCn = type === 'color_negative';
  if (isCn) {
    combo.developer_time_minutes = kit.devTime;
    combo.developer_temp_c = kit.stdTemp;
    setMaybe(combo, 'push_1_stop_dev_time', kit.push[1]);
    setMaybe(combo, 'push_2_stop_dev_time', kit.push[2]);
    setMaybe(combo, 'push_3_stop_dev_time', kit.push[3]);
    setMaybe(combo, 'pull_1_stop_dev_time', kit.pull[1]);
    setMaybe(combo, 'pull_2_stop_dev_time', kit.pull[2]);
  } else {
    combo.first_dev_time_minutes = kit.devTime;
    combo.first_dev_temp_c = kit.stdTemp;
    setMaybe(combo, 'push_1_stop_first_dev_time', kit.push[1]);
    setMaybe(combo, 'push_2_stop_first_dev_time', kit.push[2]);
    setMaybe(combo, 'push_3_stop_first_dev_time', kit.push[3]);
    setMaybe(combo, 'pull_1_stop_first_dev_time', kit.pull[1]);
    setMaybe(combo, 'pull_2_stop_first_dev_time', kit.pull[2]);
  }
  combo.temperature_tolerance_c = kit.tolerance;
  combo.agitation_initial_seconds = kit.agitation.initial;
  combo.agitation_interval_seconds = kit.agitation.interval;
  combo.agitation_frequency_minutes = kit.agitation.frequency;
  combo.source = kit.source;
  combo.source_url = kit.url;
  combo.verified_date = new Date().toISOString().slice(0, 10);
}

let combosUpdated = 0;
for (const film of Object.values(db.films)) {
  if (film.type !== 'color_negative' && film.type !== 'slide') continue;
  const map = film.type === 'color_negative' ? C41 : E6;
  for (const [devKey, combo] of Object.entries(film.developers)) {
    const kit = map[devKey];
    if (!kit) continue;
    applyKit(combo, film.type, kit);
    combosUpdated++;
  }
}

// Store per-kit temperature tables on the developer records so the engines can
// compensate colour development time for temperature.
for (const [devKey, kit] of Object.entries({ ...C41, ...E6 })) {
  const dev = db.developers[devKey];
  if (!dev) continue;
  if (kit.tempTable) {
    dev.temperature_compensation = kit.tempTable;
    dev.temperature_compensation_source = `${kit.source} (normalised to ${kit.stdTemp}°C)`;
  } else {
    delete dev.temperature_compensation;
    dev.temperature_compensation_source = `${kit.source} (temperature-critical; no time compensation)`;
  }
  if (kit.capacity != null) dev.capacity_rolls_per_liter = kit.capacity;
}

// Correct the informational process templates.
db.processes.c41 = {
  name: 'C-41 Color Negative Process',
  steps: ['developer', 'bleach', 'wash', 'fixer', 'wash', 'stabilizer'],
  developer_time_minutes: 3.25,
  developer_temp_c: 37.8,
  bleach_time_minutes: 6.5,
  wash_time_minutes: 3.25,
  fixer_time_minutes: 6.5,
  stabilizer_time_minutes: 1.5,
  temperature_tolerance_c: 0.15,
  temperature_critical: true,
  agitation_standard: { initial_seconds: 30, interval_seconds: 2, frequency_seconds: 15 },
  push_pull_adjustments: {
    push_1_stop: { developer_time_minutes: 3.75 },
    push_2_stop: { developer_time_minutes: 4.25 },
    note: 'Kodak does not officially support C-41 push/pull; values vary by kit.',
  },
  variable_temperature: {
    note: 'Home kits support lower temperatures with longer developer times.',
    examples: {
      tetenal_c41_kit: { '38C': 3.25, '30C': 8.0, '45C': 2.0 },
      cinestill_c41_kit: { '39C': 3.5, '35C': 5.75, '32C': 8.5, '29.5C': 13.0, '27C': 21.0, '24C': 35.0, '22C': 50.0 },
      unicolor_c41_kit: { '39C': 3.5, '24C': 17.5 },
    },
  },
  simplified_kits: {
    two_bath: { steps: ['developer', 'blix', 'stabilizer'], note: 'Simplified home processing versions available' },
  },
};

db.processes.e6 = {
  name: 'E-6 Slide Film Process',
  steps: ['first_developer', 'reversal', 'color_developer', 'pre_bleach', 'bleach', 'fixer', 'wash', 'stabilizer'],
  first_dev_time_minutes: 6.0,
  first_dev_temp_c: 37.8,
  reversal_time_minutes: 2.0,
  color_dev_time_minutes: 6.0,
  color_dev_temp_c: 37.8,
  pre_bleach_time_minutes: 2.0,
  bleach_time_minutes: 6.0,
  fixer_time_minutes: 4.0,
  final_wash_time_minutes: 4.0,
  stabilizer_time_minutes: 1.0,
  temperature_tolerance_c: 0.2,
  temperature_critical: true,
  agitation_standard: { initial_seconds: 15, interval_seconds: 5, frequency_seconds: 20 },
  push_pull_adjustments: {
    push_1_stop: { first_dev_time_minutes: 8.0 },
    push_2_stop: { first_dev_time_minutes: 11.0 },
    push_3_stop: { first_dev_time_minutes: 13.0 },
    note: 'Kodak E-6 publishes push times (E-28) but no pull times.',
  },
  kits: {
    kodak_e6_kit: { first_dev: '6:00 @ 37.8C', push: '8:00 / 11:00 / 13:00' },
    tetenal_e6_kit: { first_dev: '6:15 @ 38C', push: '8:15 / 11:45', pull: '4:15 (+ lower temp for heavier pull)' },
    unicolor_e6_kit: { first_dev: '6:30 @ 37.8C', color_dev: '4:30 @ 37.8C' },
  },
  simplified_kits: {
    three_bath: {
      steps: ['first_developer', 'color_developer', 'bleach_fix', 'stabilizer'],
      note: 'Home 3-bath kits combine reversal+colour developer and bleach+fix; the first developer is still separate.',
    },
  },
  reversal_bath: { chemical_reversal: true, flash_reversal: false, note: 'Modern E-6 uses chemical reversal, not light reversal.' },
};

console.log('Color combos updated:', combosUpdated);
console.log('Colour temp tables added:', Object.entries(db.developers)
  .filter(([, d]) => d.temperature_compensation && Object.keys(d.temperature_compensation).length > 0 && d.film_types.some((t) => t !== 'black_white'))
  .map(([k]) => k).join(', '));

if (dry) {
  console.log('DRY RUN - no files written');
} else {
  writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
  copyFileSync(dbPath, join(root, 'public', 'complete_database.json'));
  console.log('Wrote complete_database.json and synced public copy');
}
