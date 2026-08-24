/**
 * GATE: real-artifacts — criterion E6.  →  `REAL-ARTIFACTS OK — 5 of 5 shas matched`
 *
 *   > **E6.** *"Every criterion was validated against the **real shipped artifacts** at their
 *   > measured shas (`catalog` `db49cde7…`, `benefits` `03ba5063…`, `taxonomy` `41f58df7…`,
 *   > `content` `5eba1d06…`, `fx-rates` `fb8d85aa…`), **never against hand-written fixtures**."*  · FRESH
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CONTRACT NAMED THE SHAS BEFORE THE COPY EXISTED, AND THAT IS THE WHOLE COMPARISON
 *
 * A gate that hashed the app's packs and compared them to a manifest the same script wrote would
 * prove that a file equals itself. E6 names five prefixes **in the contract**, written before these
 * bytes were copied into the app — so the comparison has a side that this campaign did not choose.
 *
 * The prefixes cross in the campaign-records mirror, parsed out of the contract's own E6 row. If
 * somebody edited the contract to match a changed pack, the parity check on that mirror is what
 * would notice.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NEVER AGAINST HAND-WRITTEN FIXTURES" IS THE HALF A SHA CANNOT PROVE
 *
 * Matching shas says the artifacts are real. It says nothing about whether the TESTS used them. So
 * the gate also counts, across the suites that validate criteria, how many read from
 * `src/data/adapter/packs/**` versus how many construct their own pack objects — and it requires
 * every named criterion suite to be in the first group.
 *
 * A fixture is not banned outright: `memoryPackSetStore` is a fake, and a store that wrote to a real
 * disk would be testing the filesystem. What is banned is a fixture standing in for **the data**.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['E6'];
export const SENTINEL = 'REAL-ARTIFACTS OK';

const RECORDS = join('tools', 'p2', 'campaign-records.json');
const PACKS_DIR = join('src', 'data', 'adapter', 'packs');
const SHAS = join(PACKS_DIR, 'PACK_SHAS.json');

/** The suites whose criteria are about the data. Each must read the real packs. */
const DATA_SUITES = [
  'src/data/adapter/__tests__/realPacks.test.ts',
  'src/data/adapter/__tests__/formatMatrix.test.ts',
  'src/data/adapter/__tests__/crossSetSkew.test.ts',
  'src/data/adapter/__tests__/fxColdStart.test.ts',
  'src/data/adapter/__tests__/namedRecords.test.ts',
  'src/data/adapter/import/__tests__/ob4Refusals.test.ts',
  'src/data/adapter/import/__tests__/updateRefusals.test.ts',
  'src/data/adapter/import/__tests__/releaseGate.test.ts',
];

/** The body each set ships. Derived per set rather than assumed — fx-rates is not a pack. */
const bodyOf = (dir) => (existsSync(join(dir, 'pack.json')) ? 'pack.json' : 'snapshot.json');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, RECORDS))) {
    return fail(RECORDS + ' does not exist — the contract\'s declared shas cross through it, and '
      + 'without them this gate would compare the app\'s packs against the app\'s own manifest');
  }
  const declared = JSON.parse(readFileSync(join(root, RECORDS), 'utf8')).declaredShas ?? [];
  if (declared.length === 0) {
    return fail('the contract declares no artifact shas. E6 names five, and a gate with nothing to '
      + 'compare against would be measuring a file against itself');
  }

  const base = join(root, PACKS_DIR);
  if (!existsSync(base)) return fail(PACKS_DIR + ' does not exist — there are no artifacts to check');

  // ── every declared sha matches the bytes on disk ─────────────────────────────────
  let matched = 0;
  for (const d of declared) {
    const dir = join(base, d.set);
    if (!existsSync(dir)) {
      problems.push('the contract names "' + d.set + '" and the app does not carry it');
      continue;
    }
    const body = bodyOf(dir);
    const actual = sha256(readFileSync(join(dir, body)));
    if (!actual.startsWith(d.shaPrefix)) {
      problems.push(d.set + '/' + body + ' hashes to ' + actual.slice(0, 8) + ' and the contract '
        + 'names ' + d.shaPrefix + '. E6 is a claim about WHICH artifacts every criterion was '
        + 'validated against, so a different sha means the evidence describes a different corpus');
      continue;
    }
    matched += 1;
    lines.push('  ' + d.set.padEnd(10) + body.padEnd(14) + actual.slice(0, 16) + '  matches the contract');
  }

  // The app must not carry a set the contract does not name, either.
  const carried = readdirSync(base).filter((e) => statSync(join(base, e)).isDirectory()).sort();
  for (const set of carried) {
    if (!declared.some((d) => d.set === set)) {
      problems.push('the app carries "' + set + '" and E6 does not name it. An artifact nobody '
        + 'declared is one no criterion was validated against');
    }
  }

  // ── and PACK_SHAS agrees, so the copy is the mirror's too ────────────────────────
  if (!existsSync(join(root, SHAS))) {
    problems.push(SHAS + ' is missing');
  } else {
    const recorded = JSON.parse(readFileSync(join(root, SHAS), 'utf8')).sets ?? [];
    for (const d of declared) {
      const set = recorded.find((s) => s.set === d.set);
      const file = set?.files?.find((f) => f.file === 'pack.json' || f.file === 'snapshot.json');
      if (!file) { problems.push('PACK_SHAS.json records no body for ' + d.set); continue; }
      if (!file.sha256.startsWith(d.shaPrefix)) {
        problems.push('PACK_SHAS.json records ' + file.sha256.slice(0, 8) + ' for ' + d.set
          + ' and the contract names ' + d.shaPrefix);
      }
    }
  }

  // ── the suites read the real packs, not fixtures ─────────────────────────────────
  let reading = 0;
  for (const suite of DATA_SUITES) {
    const p = join(root, suite);
    if (!existsSync(p)) { problems.push(suite + ' does not exist'); continue; }
    const code = readFileSync(p, 'utf8');
    const readsReal = /packs['"\s),\]]|fsPackReader|PACK_SHAS/.test(code);
    if (!readsReal) {
      problems.push(suite + ' does not read from ' + PACKS_DIR.replace(/\\/g, '/')
        + '. E6 says NEVER AGAINST HAND-WRITTEN FIXTURES: matching shas proves the artifacts are '
        + 'real, and says nothing about whether the tests used them');
      continue;
    }
    reading += 1;
  }

  lines.unshift('artifacts       ' + matched + ' of ' + declared.length + ' shas match the contract');
  lines.push('');
  lines.push('suites          ' + reading + ' of ' + DATA_SUITES.length + ' criterion suites read the real packs');
  lines.push('');
  lines.push('THE CONTRACT NAMED THESE SHAS BEFORE THE COPY EXISTED. A gate that hashed the app\'s');
  lines.push('  packs and compared them to a manifest the same script wrote would prove that a file');
  lines.push('  equals itself. The other side of this comparison is one the campaign did not choose.');
  lines.push('');
  lines.push('A FIXTURE IS NOT BANNED OUTRIGHT. memoryPackSetStore is a fake, and a store that wrote');
  lines.push('  to a real disk would be testing the filesystem. What is banned is a fixture standing');
  lines.push('  in for THE DATA.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'REAL-ARTIFACTS OK — ' + matched + ' of ' + declared.length + ' shas matched',
  };
};
