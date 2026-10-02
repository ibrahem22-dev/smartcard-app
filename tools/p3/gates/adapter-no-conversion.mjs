/**
 * GATE: adapter-no-conversion — criterion X2.  →  `ADAPTER-NO-CONVERSION OK`
 *
 *   > *"The adapter still performs no currency conversion: OD-23a holds, and the boundary refuses a
 *   > converter inside it."*
 *
 * Now that the ENGINE divides (X1), this gate is what keeps the divide from creeping back toward
 * the boundary: no quoteUnit arithmetic in data/**, no per-one field minted anywhere app-side, and
 * none in the SHIPPED snapshot bytes either (the estate's own pre-divided record is deliberately
 * not read).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['X2'];
export const SENTINEL = 'ADAPTER-NO-CONVERSION OK';

const DIRS = ['src/data/adapter', 'src/data/fx'];
const SNAPSHOT = join('src', 'data', 'adapter', 'packs', 'fx-rates', 'snapshot.json');
const PER_ONE_FIELDS = ['ratePerOneUnit', 'rateIlsPerOne', 'rateIlsPerOneUnit', 'normalizedRate'];

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

export const run = async ({ root }) => {
  if (!existsSync(join(root, SNAPSHOT))) return fail(SNAPSHOT + ' does not exist — nothing to guard');

  // 1. The shipped bytes carry no pre-divided field. This is l13's check, run against the copy
  //    the app actually reads.
  const bytes = readFileSync(join(root, SNAPSHOT), 'utf8');
  for (const field of PER_ONE_FIELDS) {
    const re = new RegExp('"' + field + '"\\s*:');
    const m = bytes.match(re);
    if (m) {
      return fail(SNAPSHOT + ' carries "' + field + '". OD-23a: no derived ILS field crosses the '
        + 'boundary, in any pack or artifact');
    }
  }

  // 2. No module on the boundary side of the line computes with the unit.
  let scanned = 0;
  for (const dir of DIRS) {
    const files = walk(join(root, dir));
    scanned += files.length;
    for (const abs of files) {
      const rel = relative(root, abs).replace(/\\/g, '/');
      const code = stripComments(readFileSync(abs, 'utf8'));
      for (const m of code.matchAll(/[/*]\s*\w*\.?quoteUnit\b|\bquoteUnit\s*[*/]/g)) {
        return fail(rel + ':' + code.slice(0, m.index).split('\n').length
          + ' computes with quoteUnit ("' + m[0].trim() + '"). OD-23a: the boundary returns the '
          + 'native fact only; the divide is the engine\'s (src/engines/currency.ts)');
      }
      for (const field of PER_ONE_FIELDS) {
        const decl = new RegExp('[{,]\\s*' + field + '\\s*[:=]');
        const d = code.match(decl);
        if (d) {
          return fail(rel + ':' + code.slice(0, d.index).split('\n').length + ' mints "'
            + field + '" — a per-one field is a conversion wearing a property name');
        }
      }
    }
  }
  if (scanned === 0) return fail('scanned 0 files across ' + DIRS.join(', ') + ' — a vacuous pass');

  // 3. The engine still owns exactly one dividing site (so "moved back into the boundary" cannot
  //    happen quietly while the engine keeps its own copy).
  const engine = join(root, 'src/engines/currency.ts');
  if (!existsSync(engine)) return fail('src/engines/currency.ts missing — the divide has nowhere to live');
  const engineSrc = stripComments(readFileSync(engine, 'utf8'));
  const sites = [...engineSrc.matchAll(/rateIlsPerQuoteUnit\s*\/\s*\w+/g)].length;
  if (sites !== 1) return fail('the engine now has ' + sites + ' dividing sites; expected exactly one');

  return ok(SENTINEL, [
    SNAPSHOT + ': no per-one field in ' + bytes.length + ' shipped bytes',
    scanned + ' file(s) scanned under ' + DIRS.join(', ') + ': no quoteUnit arithmetic, no minted per-one field',
    'engine holds exactly one dividing site',
  ].join('\n'));
};
