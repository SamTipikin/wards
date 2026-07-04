// Copy screenshots into public/ so the static export can serve them, and
// verify the SQLite DB is reachable. Runs before `next dev` / `next build`.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '..', process.env.DATA_DIR ?? '../data');
const db = resolve(dataDir, 'radar.db');
const shots = resolve(dataDir, 'screenshots');
const publicShots = resolve(__dirname, '..', 'public', 'screenshots');

if (!existsSync(db)) {
  console.error(`[prepare-data] radar.db not found at ${db}`);
  process.exit(1);
}

mkdirSync(publicShots, { recursive: true });
if (existsSync(shots)) {
  cpSync(shots, publicShots, { recursive: true });
  console.log(`[prepare-data] copied screenshots → public/screenshots`);
} else {
  console.log('[prepare-data] no screenshots dir yet (skipping)');
}
