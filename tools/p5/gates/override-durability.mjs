/**
 * GATE: override-durability — criterion N4.  →  `OVERRIDE-DURABILITY OK`
 *
 *   > **N4.** *"An edited value survives a catalog pack update: after importing a pack version whose
 *   > value for that field differs, the read still returns the user's number and the chip still
 *   > reads 'Your value'."*
 *
 * MEASURES: 'artifact'. The claim is about a sequence of writes and reads against a real store, not
 * about a rendered tree and not about what the source says. Contract §8.1 calls it *"a real import
 * of a pack version whose value for that field differs, followed by a read that still returns the
 * user's number"* — the measurement IS the sequence.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS CRITERION'S FAILURE MODE IS NOT A RED. IT IS A GREEN THAT MEANS NOTHING.
 *
 * `D-015` records how close it came. `readCardCost` consulted the pack store only inside the branch
 * that had already established an override existed; the catalog path read `EngineCard` fields. So a
 * pack import could not change what §A showed under any circumstances — and *"import a differing
 * pack, confirm the user's number survives"* was therefore true whatever the override layer did,
 * including if it had been deleted. A test doing real work, passing honestly, proving nothing.
 *
 * §2 rule 5 refuses a check over zero items. This is the harder shape: the population is not empty,
 * the **effect** is. So the gate does not merely require the durability case. It requires, by name,
 * the two cases that make the durability case falsifiable:
 *
 *   · the pack store can reach the screen **before** any override exists;
 *   · the update visibly changed a **different** row that nobody overrode.
 *
 * Without the second, *"the value did not change"* is equally well explained by an import that did
 * nothing at all — which is exactly the state the code was in when this gate was written.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * N4 IS NOT C2, AND THIS GATE WILL NOT LET IT BORROW C2's EVIDENCE
 *
 * Contract §8.1 is unusually blunt: *"P2's deferred `C2` — a pack update applying and rolling back
 * **on a device** — sits with the Owner and the release gate under OD-25… P5 may not close C2 and
 * may not borrow its evidence."* The two are easy to conflate because both say "pack update": C2 is
 * the signed staged-file flow with backup and rollback, N4 is the merge-at-read property. So the
 * suite is refused if it reaches for the file-level import machinery — `importPackSets`, the
 * staging steps, `restoreBackup` — instead of the row-level update `replacePackSet`.
 *
 * NEGATIVE CONTROL (contract §8.1 N4): disable the override merge at read and watch the imported
 * catalog value win. That control is only observable once the catalog value CAN win, which is the
 * whole reason for the two falsifiability cases above.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N4'];
export const SENTINEL = 'OVERRIDE-DURABILITY OK';
export const MEASURES = 'artifact';

const RESOLUTION = 'src/store/cardCostResolution.ts';
const SUITE = 'src/store/__tests__/overrideDurability.test.ts';
const PACK_STORE = 'src/store/packStore.ts';
const ADAPTER = 'src/store/storeAdapter.ts';
const JEST_CONFIG = 'jest.config.cjs';
const UNIT_PROJECT = 'unit';

const REQUIRED_CASES = [
  /* The two that make the third falsifiable. Order matters to a reader, not to jest. */
  'reads the catalog value from the pack store before any override exists',
  'shows the user number once the pencil has written one',
  'keeps the user number after a pack update that carries a different value',
  'proves the pack update really landed, by reading a row the user never overrode',
  'keeps the user number even when the pack drops the key entirely',
];

/** C2's machinery. Reaching for it here is borrowing evidence §8.1 forbids. */
const C2_MACHINERY = [
  'importPackSets',
  'restoreBackup',
  'promoteStaged',
  'backupInstalled',
  'recoverAtStartup',
  'IMPORT_STEPS',
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const unitConfig = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const unit = projects.find((p) => p && p.displayName === UNIT_PROJECT);
  if (!unit) return { error: JEST_CONFIG + ' has no "' + UNIT_PROJECT + '" project' };
  return { config: { ...unit, rootDir: root, testMatch: ['**/' + SUITE] } };
};

export const run = async ({ root }) => {
  for (const rel of [RESOLUTION, SUITE, PACK_STORE, ADAPTER]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — N4 has nothing to be about');
  }

  const resolutionSrc = stripComments(readFileSync(join(root, RESOLUTION), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const problems = [];

  /*
   * 1. THE EFFECT MUST EXIST. The catalog path has to reach the pack store, or nothing an import
   *    does can be observed and every later assertion is vacuously true.
   */
  if (!/resolveValue\s*\(/.test(resolutionSrc)) {
    problems.push(RESOLUTION + ' never calls resolveValue — the merge P2 built is not in the read path at all');
  }
  /* The call must not be reachable ONLY after an override has been found. That was D-015's shape:
     the adapter consulted as a confirmation of something already known, never as the way in. */
  const overrideFirst = /if\s*\(\s*readCardCostOverride\s*\([^)]*\)\s*!==\s*null\s*\)[\s\S]{0,400}?resolveValue\s*\(/.test(resolutionSrc);
  if (overrideFirst) {
    problems.push(
      RESOLUTION + ' still calls resolveValue only inside a branch guarded by readCardCostOverride(...) !== null. '
        + 'That is D-015 exactly: the pack store is consulted to confirm an override that was already found, so an '
        + 'import can never change the value and "the user\'s number survived" is true whatever the override layer does',
    );
  }

  /* 2. THE REAL UPDATE PATH, and not a hand-written substitute for it. */
  if (!/replacePackSet/.test(suiteSrc)) {
    problems.push(SUITE + ' never calls replacePackSet — §8.1 requires a REAL import, and "the shape a pack UPDATE takes" is that function');
  }

  /* 3. NOT C2. Same words, different criterion, and the contract forbids the borrow by name. */
  for (const name of C2_MACHINERY) {
    if (new RegExp('\\b' + name + '\\b').test(suiteSrc)) {
      problems.push(
        SUITE + ' reaches for ' + name + ', which belongs to the staged-file import flow. §8.1: "P5 may not close C2 and '
          + 'may not borrow its evidence." N4 is the merge-at-read property; C2 is apply-and-roll-back on a device, and it '
          + 'sits with the Owner under OD-25',
      );
    }
  }

  /* 4. THE SUITE MUST NOT BE P2's. B4 already proved USER outranks at read; N4 is a different claim
        and may not be satisfied by pointing at the file that proved the other one. */
  if (/overrideSurvivesPackUpdate/.test(suiteSrc)) {
    problems.push(SUITE + ' imports from P2\'s overrideSurvivesPackUpdate suite. Borrowing its mocking is fine; citing its assertions is not — B4 is the precedence rule, N4 is durability across a real update');
  }

  if (problems.length) return fail(problems.join(' · '));

  /* 5. THE SEQUENCE, RUN. */
  const { config, error } = unitConfig(root);
  if (error) return fail(error);
  const { problems: caseProblems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (caseProblems.length) return fail(caseProblems.join(' · '), summary ?? undefined);
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }

  return ok(SENTINEL, [
    'The user\'s number survives a real pack update, and the survival is FALSIFIABLE:',
    '  · the pack store reaches the read before any override exists, so an import can change what',
    '    section A shows — without this the rest of the criterion is true whatever the code does',
    '    (D-015, which is how close this came to being unmeasurable),',
    '  · the same replacePackSet visibly changes a row nobody overrode, so "it did not change" is',
    '    not equally explained by an import that did nothing,',
    '  · and only then: the overridden row keeps the user\'s number, chip still USER, including when',
    '    the new pack drops the key entirely.',
    'Precedence is still only in ' + ADAPTER + '; the update is ' + PACK_STORE + '.replacePackSet,',
    '  "the shape a pack UPDATE takes", and not the staged-file flow.',
    'C2 is untouched and uncited: no importPackSets, no staging, no rollback. §8.1 forbids the',
    '  borrow, and the two are easy to conflate because both sentences say "pack update".',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
