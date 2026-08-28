/**
 * GATE: state-classification — criterion U1.  →  `STATE-CLASSIFICATION OK`
 *
 *   > **U1.** *"Every user-state field P5 introduces is classified in a declared table checked
 *   > against the code as exactly one of canonical, vault, derived cache, transient UI state,
 *   > permitted analytics or prohibited; an unclassified field fails."*
 *
 * MEASURES: 'source'. The claim is about which fields EXIST and how each is classified, and both
 * are declarations. A runtime assertion could not tell a field that is absent from a field that is
 * merely never set in the fixture.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * BOTH DIRECTIONS, BECAUSE ONE OF THEM CATCHES THE FAILURE NOBODY LOOKS FOR
 *
 * `P5_VALIDATION_PLAN.md` §5: *"a field in the code and not the table fails, and a field in the
 * table and not the code fails too — the second direction catches a table that stopped describing
 * the product."* The first direction is the one people implement; the second is the one that fails
 * quietly, because a table describing a field nobody built reads exactly like a table describing a
 * field everybody built.
 *
 * So this compares three populations against each other:
 *
 *   1. `P5_USER_STATE`            — the declared table
 *   2. `P5UserProfileFields`      — the persisted shape, in the same file, so they cannot drift
 *   3. `UserProfile`              — what the app's own type actually carries
 *
 * plus `MMKV_KEYS`, so a P5 key added without a row fails.
 *
 * AND `prohibited` IS CHECKED IN REVERSE. A row classified `prohibited` names something considered
 * and refused — `homeSuggestionDismissed`, because H6 requires Home's suggestion slot to ship
 * empty. If that field ever appears in the code, this gate fails: the table would otherwise record
 * a refusal the product had quietly stopped honouring.
 *
 * NEGATIVE CONTROL (contract §12 U1): add an unclassified persisted field and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['U1'];
export const SENTINEL = 'STATE-CLASSIFICATION OK';
export const MEASURES = 'source';

const TABLE = 'src/store/p5UserState.ts';
const PROFILE = 'src/types/user.types.ts';
const KEYS = 'src/store/keys.ts';
const SUITE = 'src/store/__tests__/p5UserState.test.ts';
const JEST_CONFIG = 'jest.config.cjs';
const UNIT_PROJECT = 'unit';

const CLASSES = ['canonical', 'vault', 'derived-cache', 'transient', 'permitted-analytics', 'prohibited'];

const REQUIRED_CASES = [
  'declares at least one field — a table over nothing classifies nothing',
  'gives every field exactly one of the six classes contract §12 names',
  'names where each field lives and why its class is that one',
  'records the refusal H6 requires, rather than leaving it as an absence',
  'adds no MMKV key of its own — P5 state rides the profile record that already exists',
];

/** Rows of the declared table, read from its source. */
const tableRows = (src) =>
  [...src.matchAll(/\{\s*\n\s*field:\s*'([^']+)',\s*\n\s*class:\s*'([^']+)',/g)]
    .map((m) => ({ field: m[1], class: m[2] }));

/** Members of an interface, by name. */
const interfaceMembers = (src, name) => {
  const at = src.indexOf('interface ' + name);
  if (at < 0) return null;
  const open = src.indexOf('{', at);
  let depth = 0;
  let end = open;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  const body = src.slice(open, end);
  return [...body.matchAll(/^\s*readonly\s+([A-Za-z0-9_]+)\??:/gm)].map((m) => m[1]);
};

const unitConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const unit = projects.find((p) => p && p.displayName === UNIT_PROJECT);
  if (!unit) return { error: JEST_CONFIG + ' has no "' + UNIT_PROJECT + '" project' };
  return { config: { ...unit, rootDir: root, testMatch: ['**/' + SUITE] } };
};

export const run = async ({ root }) => {
  for (const rel of [TABLE, PROFILE, KEYS, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — U1 has nothing to be about');
  }

  const tableSrc = readFileSync(join(root, TABLE), 'utf8');
  const profileSrc = readFileSync(join(root, PROFILE), 'utf8');
  const keysSrc = readFileSync(join(root, KEYS), 'utf8');
  const problems = [];

  /* 1. The table exists and is not empty. A check over zero rows classifies nothing. */
  const rows = tableRows(tableSrc);
  if (rows.length === 0) {
    return fail(TABLE + ' declares no rows — a classification table over zero fields is the vacuous pass §2 rule 5 refuses');
  }

  /* 2. Every row carries one of the six classes, spelled the way the contract spells it. */
  for (const r of rows) {
    if (!CLASSES.includes(r.class)) {
      problems.push(r.field + ' is classified "' + r.class + '", which is not one of the six contract §12 names: ' + CLASSES.join(', '));
    }
  }

  /* 3. TABLE → CODE. Every non-prohibited row must be a real member of the persisted shape AND of
        the app type that carries it. A row describing a field nobody built reads exactly like a row
        describing one everybody did. */
  const declaredShape = interfaceMembers(tableSrc, 'P5UserProfileFields');
  if (declaredShape === null) {
    problems.push(TABLE + ' declares no P5UserProfileFields interface, so the table has nothing in the same file to be checked against');
  }
  const profileMembers = interfaceMembers(profileSrc, 'UserProfile');
  if (profileMembers === null) {
    problems.push(PROFILE + ' declares no UserProfile interface');
  }
  const expected = rows.filter((r) => r.class !== 'prohibited').map((r) => r.field);
  for (const field of expected) {
    if (declaredShape && !declaredShape.includes(field)) {
      problems.push(field + ' is in the table but not in P5UserProfileFields — the table has stopped describing the shape beside it');
    }
    if (profileMembers && !profileMembers.includes(field)) {
      problems.push(field + ' is in the table but not on UserProfile — the table has stopped describing the product');
    }
  }

  /* 4. CODE → TABLE. Every member of the declared shape must have a row. */
  for (const member of declaredShape ?? []) {
    if (!rows.some((r) => r.field === member)) {
      problems.push(member + ' is a persisted P5 field with no row in the table — a field with no class is a field whose privacy nobody decided');
    }
  }

  /* 5. PROHIBITED IN REVERSE. A refusal that the product quietly stopped honouring. */
  for (const r of rows.filter((x) => x.class === 'prohibited')) {
    if (profileMembers && profileMembers.includes(r.field)) {
      problems.push(r.field + ' is classified prohibited and yet exists on UserProfile — the table records a refusal the product no longer honours');
    }
    if (declaredShape && declaredShape.includes(r.field)) {
      problems.push(r.field + ' is classified prohibited and yet appears in P5UserProfileFields');
    }
  }

  /* 6. No P5 storage key may be added without a row. */
  const p5Keys = [...keysSrc.matchAll(/^\s{2}([A-Za-z0-9_]*[Pp]5[A-Za-z0-9_]*)\s*:/gm)].map((m) => m[1]);
  for (const k of p5Keys) {
    if (!rows.some((r) => r.field === k)) {
      problems.push('MMKV key "' + k + '" names P5 and has no row in the table');
    }
  }

  if (problems.length) return fail(problems.join(' · '));

  /* 7. And the values, exercised, so the two halves of U1 are checked by different means. */
  const { config, error } = unitConfigFor(root);
  if (error) return fail(error);
  const { problems: caseProblems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (caseProblems.length) return fail(caseProblems.join(' · '), summary ?? undefined);
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }

  return ok(SENTINEL, [
    TABLE + ' classifies ' + rows.length + ' field(s), each into one of the six contract §12 classes:',
    ...rows.map((r) => '  · ' + r.field + ' → ' + r.class),
    'Checked BOTH ways: every non-prohibited row is a member of P5UserProfileFields and of',
    'UserProfile in ' + PROFILE + ', and every member of that shape has a row.',
    'Checked in reverse for the refusals: no prohibited field exists in the code.',
    'And ' + KEYS + ' carries no P5-named storage key without a row.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
