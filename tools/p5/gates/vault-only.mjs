/**
 * GATE: vault-only — criterion U2.  →  `VAULT-ONLY OK`
 *
 *   > **U2.** *"All P5 user state reaches the encrypted vault through the store; no surface writes a
 *   > raw persisted value."*
 *
 * MEASURES: 'source'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "THROUGH THE STORE" IS A ROUTE, AND THE SHORTCUT IS ALWAYS AVAILABLE
 *
 * `keyVault.getEncryptedStorage()` is exported and reachable from anywhere. A surface that wants to
 * remember one number can call it in two lines, and the value is genuinely encrypted, so nothing
 * visibly breaks. What is lost is everything the store does around the write: knowing which profile
 * is active, parsing what comes back, and being the single place a shape is defined.
 *
 * P5 writes user state in two places — `N3`'s card-cost overrides and `J1`'s commitment cap — and
 * both go through their stores. This gate exists so the third one does too.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE POPULATION IS THE SURFACES, NOT THE STORES
 *
 * `src/store/**` is where writing belongs, so sweeping it would flag the correct code. The rule is
 * about **surfaces**: screens, and the seam. A screen that reaches the vault directly is the defect;
 * a store that does it is the design.
 *
 * NEGATIVE CONTROL: write a value to encrypted storage from a screen and watch this fail.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['U2'];
export const SENTINEL = 'VAULT-ONLY OK';
export const MEASURES = 'source';

const SURFACE_ROOTS = ['src/screens', 'src/surfaces'];
const STORE = 'src/store';

/** Reaching around the store to the storage itself. */
const RAW_WRITE = [
  [/getEncryptedStorage\s*\(\s*\)\s*\.\s*set\b/, 'writes to encrypted storage directly'],
  [/getEncryptedStorage\s*\(\s*\)\s*\.\s*delete\b/, 'deletes from encrypted storage directly'],
  [/\bkeyVault\b[^\n]{0,60}\.set\s*\(/, 'reaches the key vault to set a value'],
  [/AsyncStorage\.(setItem|removeItem)/, 'writes to AsyncStorage — not the vault at all'],
  [/localStorage\.(setItem|removeItem)/, 'writes to localStorage'],
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const walk = (abs, acc = []) => {
  if (!existsSync(abs)) return acc;
  for (const entry of readdirSync(abs)) {
    const p = join(abs, entry);
    if (statSync(p).isDirectory()) { if (entry !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
};

export const run = async ({ root }) => {
  const files = SURFACE_ROOTS.flatMap((d) => walk(join(root, d)));
  if (files.length === 0) {
    return fail('no surface files under ' + SURFACE_ROOTS.join(', ') + ' — a sweep over zero files is the vacuous pass §2 rule 5 refuses');
  }
  if (!existsSync(join(root, STORE))) {
    return fail(STORE + ' does not exist — "through the store" has nothing to route through');
  }

  const problems = [];
  for (const abs of files) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    for (const [re, why] of RAW_WRITE) {
      if (re.test(src)) {
        problems.push(
          rel + ' ' + why + '. The value would still be encrypted, so nothing visibly breaks — what is lost is what '
            + 'the store does around the write: knowing which profile is active, parsing what comes back, and being '
            + 'the one place a shape is defined',
        );
        break;
      }
    }
  }

  if (problems.length) return fail(problems.join(' · '));

  return ok(SENTINEL, [
    'CRITERION U2 — vault writes go through the store, over ' + files.length + ' surface file(s).',
    'The population is the SURFACES, not the stores: ' + STORE + ' is where writing belongs, and',
    '  sweeping it would flag the correct code. A screen reaching the vault directly is the defect; a',
    '  store doing it is the design.',
    'The shortcut is always available — getEncryptedStorage() is exported and two lines from anywhere,',
    '  and the value it writes is genuinely encrypted, so nothing visibly breaks. What is lost is the',
    '  active profile, the parsing, and the single definition of a shape.',
    'P5 writes user state in two places today — N3\'s card-cost overrides and J1\'s commitment cap —',
    '  and both go through their stores. This gate is here so the third one does too.',
  ].join('\n'));
};
