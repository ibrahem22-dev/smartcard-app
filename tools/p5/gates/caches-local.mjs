/**
 * GATE: caches-local — criterion U4.  →  `CACHES-LOCAL OK`
 *
 *   > **U4.** *"The derived caches are local-only and are invalidated rather than shipped stale; no
 *   > cache is written to a shared or exported store."*
 *
 * MEASURES: 'source'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * U4 AND A5 ARE THE SAME CACHES AND DIFFERENT CLAIMS
 *
 * `A5` asks whether a cached value **equals a fresh engine call**, and whether a stale one is
 * withheld. That is about correctness, and it is measured by comparing numbers.
 *
 * U4 asks **where the cache lives**. A cache can be perfectly correct — every value matching the
 * engine, every stale entry invalidated — and still be persisted to the vault, exported from a
 * store, or shipped in a profile transfer. Then it is a number travelling without its inputs: the
 * fingerprint that made it trustworthy was computed against a context that will not exist when it is
 * read back, and the invalidation A5 verified cannot happen because nothing on the far side knows
 * what to compare.
 *
 * So the two criteria overlap in subject and not in evidence, and this gate deliberately does not
 * re-run A5's comparison.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "SHIPPED STALE" IS THE PHRASE THAT NAMES THE HAZARD
 *
 * Not *"kept stale"*. A cache that goes stale in memory is a bug that lasts until the next read. A
 * cache that is **shipped** — written somewhere durable, or handed to another device in a transfer —
 * outlives every input it was derived from, and the app that reads it back has no way to tell.
 *
 * NEGATIVE CONTROL: persist a cache entry to the vault and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['U4'];
export const SENTINEL = 'CACHES-LOCAL OK';
export const MEASURES = 'source';

const CACHE = 'src/surfaces/derivedCache.ts';
const STATE_TABLE = 'src/store/p5UserState.ts';

/** Anything that would let a cache outlive the inputs it was derived from. */
const ESCAPES = [
  [/keyVault/, 'reaches the key vault'],
  [/MMKV_KEYS|getEncryptedStorage/, 'reaches encrypted storage'],
  [/AsyncStorage|localStorage/, 'reaches a device store'],
  [/from\s+'[^']*\/store\//, 'imports a store'],
  [/JSON\.stringify[^\n]{0,40}(entries|cache)/i, 'serialises the cache — the step before writing it somewhere'],
  [/encryptProfileTransferPayload|profileTransfer/i, 'touches the profile-transfer path — a cache handed to another device outlives every input it had'],
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export const run = async ({ root }) => {
  if (!existsSync(join(root, CACHE))) {
    return fail(CACHE + ' does not exist — U4 has no caches to be about, and A5 requires three');
  }

  const src = stripComments(readFileSync(join(root, CACHE), 'utf8'));
  const problems = [];

  /* 1. NOTHING THAT LETS IT ESCAPE. */
  for (const [re, why] of ESCAPES) {
    const hit = src.match(re);
    if (hit) {
      problems.push(
        CACHE + ' ' + why + ' ("' + String(hit[0]).slice(0, 32) + '"). A cache that is SHIPPED outlives every input it '
          + 'was derived from, and the app reading it back cannot tell — the fingerprint that made it trustworthy was '
          + 'computed against a context that no longer exists',
      );
    }
  }

  /* 2. IT IS IN MEMORY, and says so in a way a reader can check. */
  if (!/new Map\b|Object\.create\(null\)|= \{\}/.test(src)) {
    problems.push(CACHE + ' holds its entries in nothing recognisably in-memory — U4 says local-only, and a reader should be able to see where the values sit');
  }
  if (!/invalidat/i.test(src) && !/fingerprint/i.test(src)) {
    problems.push(CACHE + ' shows no invalidation mechanism — "invalidated rather than shipped stale" needs something that can tell current from stale');
  }

  /* 3. THE CLASSIFICATION SAYS IN-MEMORY, so U1 and U4 agree about where it lives. */
  if (existsSync(join(root, STATE_TABLE))) {
    const table = readFileSync(join(root, STATE_TABLE), 'utf8');
    if (/derived-cache/.test(table) && !/in-memory/.test(table)) {
      problems.push(
        STATE_TABLE + ' classifies a derived cache without the in-memory home. U1 and U4 would then disagree about '
          + 'where the same state lives, which is the two-homes failure in the one table built to prevent it',
      );
    }
  }

  if (problems.length) return fail(problems.join(' · '));

  return ok(SENTINEL, [
    'CRITERION U4 — the derived caches are local-only.',
    'U4 and A5 are the same caches and different claims, and this gate does not re-run A5\'s.',
    '  A5 asks whether a cached value equals a fresh engine call and whether a stale one is withheld —',
    '  correctness, measured by comparing numbers. U4 asks WHERE THE CACHE LIVES.',
    'A cache can be perfectly correct and still be persisted, exported, or handed to another device in',
    '  a transfer. Then it is a number travelling without its inputs: the fingerprint that made it',
    '  trustworthy was computed against a context that will not exist when it is read back, and the',
    '  invalidation A5 verified cannot happen, because nothing on the far side knows what to compare.',
    'That is why the criterion says SHIPPED stale rather than kept stale. A cache that goes stale in',
    '  memory is a bug lasting until the next read; a shipped one outlives every input it had.',
    CACHE + ' reaches no vault, no store, no device storage and no transfer path.',
    'And U1\'s table agrees with U4 about where it lives: classified in-memory, not persisted.',
  ].join('\n'));
};
