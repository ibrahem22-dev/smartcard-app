/**
 * GATE: provenance-single-enum — criterion B5.  →  `PROVENANCE-ENUM OK — 1 vocabulary`
 *
 *   > **B5.** *"`USER` is the **same enum member** the Data Contract defines. **No second provenance
 *   > vocabulary exists anywhere in the app.**"*
 *
 *   > **Data Contract §2.2.** *"Without `USER` in this enum, the application **inevitably grows a
 *   > second provenance enum for overrides** — and two enums for one concept is exactly the
 *   > divergence class this contract exists to prevent. It is the same failure mode as the three
 *   > coexisting FX implementations E1 found: **not that any one is wrong, but that nothing forces
 *   > them to agree**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CONTRACT PREDICTED THIS IN WRITING AND IT HAPPENED ANYWAY
 *
 * When this gate was written the app had:
 *
 *   1. `PROVENANCES = ['OFFICIAL_AUTHORITY', 'BUNDLED_DATASET', 'USER_INPUT', 'DERIVED_CALCULATION']`
 *      — four members, none of them the contract's, `USER_INPUT` standing in for `USER`;
 *   2. `CHIP_STATES = ['verified', 'user', 'estimate', 'unknown']` — a THIRD spelling, added by
 *      this campaign in Phase 4, under a header that declared it was not a second vocabulary.
 *
 * Nothing was comparing the app against the contract. That is the only reason a warning written
 * into the contract could come true twice under a campaign whose entire subject is this defect
 * class.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FOUR CHECKS
 *
 *   1. **The app's members ARE the contract's**, read from `tools/p2/provenance-chip.json`, which is
 *      generated from §2 and parity-checked in the pipeline preflight.
 *   2. **`USER` exists.** Named separately because §2.2 says its absence is what causes the rest.
 *   3. **No second vocabulary.** Any other array or union of provenance-shaped members anywhere in
 *      `src/**` is a second one, whatever it is called.
 *   4. **The retired members are gone.** The four names the app used to carry appear nowhere —
 *      including in a test, where a stale member would keep a dead vocabulary compiling.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['B5'];
export const SENTINEL = 'PROVENANCE-ENUM OK — 1 vocabulary';

const MIRROR = join(HERE, '..', 'provenance-chip.json');
const VOCAB = 'src/authority/provenanceChip.ts';

/** The members the app used to carry. Their reappearance is a regression, not a coincidence. */
const RETIRED = ['OFFICIAL_AUTHORITY', 'BUNDLED_DATASET', 'USER_INPUT', 'DERIVED_CALCULATION'];

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => {
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, b, c) => b + blank(c));
};

const lineAt = (code, i) => code.slice(0, i).split('\n').length;

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(MIRROR)) {
    return fail('tools/p2/provenance-chip.json is missing. B5 says the app uses THE DATA CONTRACT\'s '
      + 'enum, and without the contract mirrored here this gate would compare the app against itself');
  }
  const mirror = JSON.parse(readFileSync(MIRROR, 'utf8'));
  const contractChips = (mirror.chips ?? []).map((c) => c.chip);
  if (contractChips.length === 0) return fail('the mirror declares no chips — an empty contract clears nothing');

  if (!existsSync(join(root, VOCAB))) {
    return fail(VOCAB + ' does not exist — B5 asks for one vocabulary and there is none to check');
  }
  const vocabSrc = readFileSync(join(root, VOCAB), 'utf8');

  // ── 1. the app's members are the contract's, in the contract's spelling ──────────
  const declared = vocabSrc.match(/export const PROVENANCE_CHIPS = \[([^\]]*)\] as const;/);
  if (!declared) return fail('could not read PROVENANCE_CHIPS out of ' + VOCAB);
  const appChips = [...declared[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

  const onlyApp = appChips.filter((c) => !contractChips.includes(c));
  const onlyContract = contractChips.filter((c) => !appChips.includes(c));
  for (const c of onlyApp) problems.push('the app declares the chip "' + c + '" and the Data Contract does not');
  for (const c of onlyContract) problems.push('the Data Contract defines the chip "' + c + '" and the app does not');
  if (appChips.length !== contractChips.length) {
    problems.push('the app has ' + appChips.length + ' chips and the contract has ' + contractChips.length
      + '. §2.1 calls the four-state vocabulary a published product promise: "It MUST be exactly '
      + 'these four states, not ad hoc variations."');
  }

  // ── 2. USER exists ───────────────────────────────────────────────────────────────
  if (!appChips.includes('USER')) {
    problems.push('the app has no USER member. §2.2: "Without USER in this enum, the application '
      + 'inevitably grows a second provenance enum for overrides" — which is exactly what happened');
  }

  // ── 3, 4. no second vocabulary, and the retired members are gone ─────────────────
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files under src/ — an empty population proves nothing');

  const second = [];
  const revived = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));

    if (rel !== VOCAB) {
      // A SECOND VOCABULARY IS A DECLARATION, NOT A VALUE OF THE EXISTING ONE.
      //
      // The first version flagged `const nonAuthority: Provenance[] = ['ESTIMATE', 'USER']` in a
      // test — a fixture LISTING members of the one vocabulary, annotated with its type. That is
      // the vocabulary being used, which is the opposite of a second one.
      //
      // What creates a new type is `as const` on an array, or a string-literal union. Both are
      // matched; an annotated value is not.
      for (const m of code.matchAll(/(?:type\s+\w+\s*=\s*|=\s*\[)((?:\s*'[A-Z_]+'\s*[,|])+\s*'[A-Z_]+'\s*\]?\s*(?:as const)?)/g)) {
        const isUnion = /\|/.test(m[1]);
        const isAsConst = /as const/.test(m[0]);
        if (!isUnion && !isAsConst) continue;
        const members = [...m[1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
        const overlap = members.filter((x) => contractChips.includes(x));
        if (overlap.length >= 2) {
          second.push({ file: rel, line: lineAt(code, m.index), members: members.join(', ') });
        }
      }
    }

    // WHOLE IDENTIFIERS ONLY. `OFFICIAL_AUTHORITY_REQUIRED` is a data-requirement GRADE — a
    // different enum that happens to start with a retired member's name — and a substring match
    // reported it three times. A check that cannot tell a name from a prefix of another name
    // produces findings nobody can act on, which is how a gate earns the reputation of noise.
    for (const name of RETIRED) {
      for (const m of code.matchAll(new RegExp('(?<![A-Z_])' + name + '(?![A-Z_])', 'g'))) {
        revived.push({ file: rel, line: lineAt(code, m.index), name });
      }
    }
  }

  for (const s of second.slice(0, 4)) {
    problems.push(s.file + ':' + s.line + ' declares a second provenance vocabulary (' + s.members
      + '). Two enums for one concept is the divergence class the Data Contract exists to prevent — '
      + 'not that either is wrong, but that nothing forces them to agree');
  }
  for (const r of revived.slice(0, 4)) {
    problems.push(r.file + ':' + r.line + ' names the retired member "' + r.name + '". It was part of '
      + 'the second vocabulary B5 removed, and a stale member keeps a dead enum compiling');
  }

  lines.push('contract        ' + mirror.source);
  lines.push('vocabulary      ' + VOCAB + ' · ' + appChips.join(' · '));
  lines.push('agreement       ' + (onlyApp.length + onlyContract.length === 0
    ? 'exact — same members, same spelling' : 'DIVERGENT'));
  lines.push('stale modifier  ' + (mirror.staleIsModifier ? 'yes — §2.3, not a fifth chip' : 'NOT DECLARED'));
  lines.push('USER outranks   ' + (mirror.userOutranks ? 'yes — §2.2' : 'NOT DECLARED')
    + ' · survives a pack update: ' + (mirror.userSurvivesPackUpdate ? 'yes' : 'NOT DECLARED'));
  lines.push('population      ' + files.length + ' files · ' + second.length + ' second vocabular(ies) · '
    + revived.length + ' retired member(s)');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
