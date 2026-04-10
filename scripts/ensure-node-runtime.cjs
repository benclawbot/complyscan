#!/usr/bin/env node
'use strict';

if (process.versions && process.versions.bun) {
  console.error('[runtime-check] Detected Bun runtime. This project must run with Node.js for local DB compatibility (better-sqlite3).');
  console.error('[runtime-check] Use: PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" npm <command>');
  process.exit(1);
}
