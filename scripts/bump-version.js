#!/usr/bin/env node
/* eslint-disable */
// ---------------------------------------------------------------------------
// Bumps the app's release build number and stamps the generation date/time.
// Writes the result to src/version.ts, which is displayed on the splash/loading
// screen. Run automatically before release builds (see package.json scripts),
// or manually with: npm run version:bump
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '..', 'src', 'version.ts');
const pkg = require(path.join(__dirname, '..', 'package.json'));

// Read the current build number from the existing version file (default 0).
let currentBuild = 0;
try {
  const existing = fs.readFileSync(versionFile, 'utf8');
  const match = existing.match(/build:\s*(\d+)/);
  if (match) {
    currentBuild = parseInt(match[1], 10);
  }
} catch {
  // No existing file — start fresh.
}

const nextBuild = currentBuild + 1;
const now = new Date();

// Human-readable label, e.g. "23 Jun 2026, 14:05".
const label = now.toLocaleString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const contents = `// AUTO-GENERATED FILE — DO NOT EDIT MANUALLY.
// Updated by scripts/bump-version.js on each release build.
export const APP_VERSION = {
  /** Semantic version, kept in sync with app.config.js / package.json. */
  version: '${pkg.version}',
  /** Monotonic build number, incremented on every release build. */
  build: ${nextBuild},
  /** ISO timestamp of when this release was generated. */
  generatedAt: '${now.toISOString()}',
  /** Human-readable generation date/time for display on the splash screen. */
  generatedAtLabel: '${label}',
} as const;
`;

fs.writeFileSync(versionFile, contents);
console.log(`[bump-version] v${pkg.version} build ${nextBuild} — ${label}`);
