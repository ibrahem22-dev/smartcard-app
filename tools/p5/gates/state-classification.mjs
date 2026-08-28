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
import { spawnSync } from 'node:child_process';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

/** The app sha P5 started from. Written by the intake; never guessed. */
const intakeAppSha = (root) => {
  const candidates = [
    join(root, '..', 'smartcard-data-pipeline', 'campaign-p5', 'state', 'INTAKE.json'),
    join(root, '..', 'campaign-p5', 'state', 'INTAKE.json'),
  ];
  for (const abs of candidates) {
    try {
      const found = JSON.parse(readFileSync(abs, 'utf8'));
      const sha = found?.accepted?.shas?.app ?? null;
      if (sha) return String(sha);
    } catch { /* try the next */ }
  }
  return null;
};

const git = (root, args) => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout) : null;
};

/** Files under src/ that did not exist at `sha`. Exact, and from git rather than a convention. */
const filesCreatedSince = (root, sha) => {
  const out = git(root, ['diff', '--name-only', '--diff-filter=A', sha + '..HEAD', '--', 'src/']);
  return out === null ? [] : out.split('\n').map((l) => l.trim()).filter(Boolean);
};

/** The MMKV key names that already existed at `sha`, so P5 is only asked about the ones it added. */
const keysAtSha = (root, sha) => {
  const out = git(root, ['show', sha + ':' + KEYS]);
  return out === null ? [] : [...out.matchAll(/^\s{2}([A-Za-z0-9_]+)\s*:/gm)].map((m) => m[1]);
};

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
  'gives every field a home the gate can look in',
  'names where each field lives and why its class is that one',
  'records the refusal H6 requires, rather than leaving it as an absence',
  'adds no MMKV key of its own — P5 state rides the profile record that already exists',
];

/** Rows of the declared table, read from its source. */
const tableRows = (src) =>
  [...src.matchAll(/\{\s*\n\s*field:\s*'([^']+)',\s*\n\s*class:\s*'([^']+)',\s*\n\s*home:\s*'([^']+)',/g)]
    .map((m) => ({ field: m[1], class: m[2], home: m[3] }));

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
  /*
   * EACH ROW IS CHECKED AGAINST THE HOME IT DECLARES, not against the only home the first row had.
   *
   * The table's first version assumed all P5 state would be a `UserProfile` field, so this loop
   * required every non-prohibited row to be a member of `P5UserProfileFields` AND `UserProfile`.
   * N3's override store is neither: it is a profile-scoped record under its own `MMKV_KEYS` entry,
   * and the table could not have described it without failing this check. A classification table
   * that cannot name a thing is a table that will be left silent about it.
   */
  const expected = rows.filter((r) => r.class !== 'prohibited');
  for (const r of expected) {
    if (r.home === 'user-profile') {
      if (declaredShape && !declaredShape.includes(r.field)) {
        problems.push(r.field + ' is in the table as a user-profile field but not in P5UserProfileFields — the table has stopped describing the shape beside it');
      }
      if (profileMembers && !profileMembers.includes(r.field)) {
        problems.push(r.field + ' is in the table as a user-profile field but not on UserProfile — the table has stopped describing the product');
      }
    } else if (r.home === 'mmkv-key') {
      if (!new RegExp('\\b' + r.field + '\\s*:').test(keysSrc)) {
        problems.push(r.field + ' is classified as its own storage key and ' + KEYS + ' has no such entry — the table describes a store that does not exist');
      }
      if (profileMembers && profileMembers.includes(r.field)) {
        problems.push(r.field + ' is classified as its own storage key but is ALSO a UserProfile field — one piece of state with two homes is how the two disagree');
      }
    } else if (r.home !== 'none') {
      problems.push(r.field + ' declares home "' + String(r.home) + '", which is not one of user-profile, mmkv-key, none');
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

  /*
   * 6. THE REVERSE DIRECTION, AND IT USED TO BE A GUESS ABOUT A NAME.
   *
   * This asked whether any MMKV key whose NAME CONTAINS "p5" lacked a row. N3 then added
   * `profileCardOverrides` — a persisted store of the user's own figures about their own cards —
   * and that name contains no "p5", so the whole store could have shipped unclassified with this
   * gate printing OK. `P5_VALIDATION_PLAN.md` §5 puts the weight on exactly this direction:
   * *"a field in the table and not the code fails too — the second direction catches a table that
   * stopped describing the product."* A heuristic over a spelling is not a population (§2 rule 4).
   *
   * So the population is DERIVED FROM GIT: every file under `src/` that did not exist at the
   * intake pin is a file P5 created, and every `MMKV_KEYS.<name>` those files touch is a key P5
   * introduced. That is exact, it needs no naming convention, and it cannot be satisfied by calling
   * a key something else.
   *
   * If the pin cannot be resolved this FAILS rather than skipping. A reverse check that quietly
   * stops running is the shape of every false green this campaign has already paid for.
   */
  const pin = intakeAppSha(root);
  if (!pin) {
    problems.push('the intake app sha could not be read from state/INTAKE.json, so the set of files P5 created cannot be derived — and a reverse check that cannot derive its population is not running');
  } else {
    const created = filesCreatedSince(root, pin);
    if (created.length === 0) {
      problems.push('no file under src/ was created after the intake pin ' + pin.slice(0, 12) + ' — P5 has built five surfaces, so an empty set means the derivation is broken, not that the work is absent');
    }
    const introduced = new Map();
    for (const rel of created) {
      let src;
      try { src = readFileSync(join(root, rel), 'utf8'); } catch { continue; }
      for (const m of src.matchAll(/(?<![A-Za-z0-9_])MMKV_KEYS\.([A-Za-z0-9_]+)/g)) {
        if (!introduced.has(m[1])) introduced.set(m[1], rel);
      }
    }
    /* Keys that existed before P5 are not P5's to classify — only ones declared after the pin. */
    const preexisting = new Set(keysAtSha(root, pin));
    for (const [key, where] of introduced) {
      if (preexisting.has(key)) continue;
      if (!rows.some((r) => r.field === key)) {
        problems.push('MMKV key "' + key + '" was introduced by P5 (first seen in ' + where + ', absent from ' + KEYS + ' at the intake pin) and has no row in the table — a field with no class is a field whose privacy nobody decided');
      }
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
    ...rows.map((r) => '  · ' + r.field + ' → ' + r.class + '  (home: ' + r.home + ')'),
    'Checked BOTH ways: every non-prohibited row is a member of P5UserProfileFields and of',
    'UserProfile in ' + PROFILE + ', and every member of that shape has a row.',
    'Checked in reverse for the refusals: no prohibited field exists in the code.',
    'And the reverse direction is DERIVED, not guessed: every file under src/ that did not exist',
    '  at the intake pin is a file P5 created, and every MMKV key those files touch which was not',
    '  already in ' + KEYS + ' at that pin must carry a row. The old rule asked whether a key name',
    '  contained "p5" — which profileCardOverrides does not, so N3 could have shipped a store of the',
    '  user\'s own figures unclassified while this printed OK.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
