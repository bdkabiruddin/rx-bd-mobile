// Regenerate src/ui/tokens.ts from the web theme
// (../src/styles/themes/rx-bd.css) so the mobile palette stays in lockstep
// with rx.bd. Parses the `--rxbd-*` reference palette + the semantic layer.
//
// Usage: node scripts/generate-tokens.mjs
//
// This is a convenience generator; tokens.ts is committed and hand-verified.
// Keeping it here documents the provenance and makes future syncs mechanical.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS = resolve(__dirname, '../../src/styles/themes/rx-bd.css');

function main() {
  const css = readFileSync(CSS, 'utf8');
  const vars = {};
  for (const m of css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi)) {
    vars[m[1].trim()] = m[2].trim();
  }
  const tealCount = Object.keys(vars).filter((k) => k.startsWith('--rxbd-teal')).length;
  // Report; a full emitter can write tokens.ts from `vars`. For v1 we keep
  // tokens.ts hand-authored and use this script as a drift check.
  console.log(
    `Parsed ${Object.keys(vars).length} CSS variables (${tealCount} teal). ` +
      'Compare against src/ui/tokens.ts to detect drift.',
  );
}

main();
