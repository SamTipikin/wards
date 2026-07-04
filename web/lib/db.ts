import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const DATA_DIR = process.env.DATA_DIR ?? '../data';
const DB_PATH = resolve(process.cwd(), DATA_DIR, 'radar.db');

let cached: Database.Database | null = null;

/** Open the radar DB read-only. Cached for the build process. */
export function db(): Database.Database {
  if (!cached) {
    cached = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  }
  return cached;
}
