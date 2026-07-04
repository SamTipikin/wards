import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static export — no server, deploys as flat files to Vercel/anywhere.
  output: 'export',
  // Pin the workspace root (multiple lockfiles exist above this dir).
  outputFileTracingRoot: __dirname,
  images: {
    // Static export can't use the Next image optimizer.
    unoptimized: true,
  },
  // better-sqlite3 is a native module; only used at build time in server code.
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
