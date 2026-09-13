import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'complete_database.json');
const target = join(root, 'public', 'complete_database.json');

copyFileSync(source, target);
console.log('Synced complete_database.json -> public/complete_database.json');
