/**
 * GATE: pack-custody — the machinery half of criterion V8.  →  `PACK-CUSTODY OK`
 *
 *   > **V8.** *"SIGNING CUSTODY: release signing custody exists per OB-8, the compromised
 *   > development key appears nowhere in the release path, and custody procedure is recorded —
 *   > attested by the Owner"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS GATE READS, AND WHY IT IS RED TODAY
 *
 * OB-8 is about the PACK-signing key: an Ed25519 development key that was tracked in the repository
 * and whose public half sat in the shipped trust store. Custody per OD-25 means a HARDWARE_BACKED
 * release authority. This gate reads the pipeline's COMMITTED trust store (`src/pack/trust-store.ts`
 * and `src/pack/envelope.ts`) — the source the adapter the app ships is built from — and states the
 * three facts EV-V8 attests:
 *   1. release custody exists: at least one key whose custody is release-eligible (HARDWARE_BACKED),
 *      resolvable by `signingKeyIdFor`;
 *   2. the retired development key appears nowhere in the release path: its id is in
 *      RETIRED_KEY_IDS, and no release-eligible key carries it;
 *   3. the custody procedure is recorded: evidence/external/V8/CUSTODY_RECORD.md exists with its
 *      required fields filled (no bracketed placeholder left).
 * Until the Owner lands the custody work on main and fills the record, this gate is RED. That is the
 * truthful state; the gate does not read the foreign Phase 19→20 signer material and never will.
 *
 * MEASURES: source (the pipeline's committed trust store) and the V8 evidence record.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, okOverPopulation } from '../lib/report.mjs';

export const SENTINEL = 'PACK-CUSTODY OK';
export const FAILURE_SENTINEL = 'PACK-CUSTODY FAILED';
export const MEASURES = 'source';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PIPELINE = join(ROOT, '..', 'smartcard-data-pipeline');
const TRUST_STORE = join(PIPELINE, 'src', 'pack', 'trust-store.ts');
const ENVELOPE = join(PIPELINE, 'src', 'pack', 'envelope.ts');
const RECORD = join(PIPELINE, 'campaign-master', 'evidence', 'external', 'V8', 'CUSTODY_RECORD.md');
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');

const parseKeys = (src) => {
  const keys = [];
  const re = /keyId:\s*["']([^"']+)["'][\s\S]*?custody:\s*'([A-Z_]+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) keys.push({ keyId: m[1], custody: m[2] });
  return keys;
};
const parseRetired = (src) => {
  const block = src.match(/RETIRED_KEY_IDS[^=]*=\s*\[([\s\S]*?)\]/);
  return block ? [...block[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]) : [];
};
const parseEligible = (src) => {
  const block = src.match(/RELEASE_ELIGIBLE_CUSTODIES[^=]*=\s*\[([\s\S]*?)\]/);
  return block ? [...block[1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]) : [];
};

export const run = async () => {
  const problems = [];
  const clauses = [];
  if (!existsSync(TRUST_STORE) || !existsSync(ENVELOPE)) return fail(`the pipeline's committed trust store is not readable at ${rel(TRUST_STORE)}`);
  const store = readFileSync(TRUST_STORE, 'utf8');
  const envelope = readFileSync(ENVELOPE, 'utf8');
  const keys = parseKeys(store);
  const retired = parseRetired(store);
  const eligible = parseEligible(envelope);
  if (!eligible.includes('HARDWARE_BACKED')) problems.push('envelope.ts no longer names HARDWARE_BACKED as a release-eligible custody (OD-25)');
  if (eligible.some((c) => c !== 'HARDWARE_BACKED')) problems.push(`release-eligible custodies widened beyond HARDWARE_BACKED: ${eligible.join(', ')}`);
  clauses.push(`trust store: ${keys.length} key(s) [${keys.map((k) => `${k.keyId.slice(0, 28)}… ${k.custody}`).join('; ')}] · retired ids ${retired.length}`);

  /* 1. release custody exists */
  const releaseKeys = keys.filter((k) => eligible.includes(k.custody));
  if (releaseKeys.length === 0) problems.push('NO release-signing custody exists: the committed trust store holds no HARDWARE_BACKED key (OB-8 stands; OD-25 requires one before public release)');
  else if (releaseKeys.length !== 1) problems.push(`${releaseKeys.length} HARDWARE_BACKED keys — signingKeyIdFor requires exactly one`);
  else clauses.push(`release custody: ${releaseKeys[0].keyId}`);

  /* 2. the retired development key is nowhere in the release path */
  const devKeys = keys.filter((k) => /DEV|NOT_FOR_RELEASE/i.test(k.keyId) || /DEV/.test(k.custody));
  if (retired.length === 0) problems.push('RETIRED_KEY_IDS is empty — the leaked development key id must stay named so it can never be re-admitted');
  for (const k of releaseKeys) if (retired.includes(k.keyId) || /DEV|NOT_FOR_RELEASE/i.test(k.keyId)) problems.push(`a release-eligible key is a development or retired key: ${k.keyId}`);
  clauses.push(`${devKeys.length} development key(s) in the store, none release-eligible; ${retired.length} retired id(s) kept`);

  /* 3. the custody procedure is recorded */
  if (!existsSync(RECORD)) problems.push('no custody record at evidence/external/V8/CUSTODY_RECORD.md — the procedure is not recorded');
  else {
    const rec = readFileSync(RECORD, 'utf8');
    const holes = [...new Set((rec.match(/\[[A-Z][A-Z0-9 /_\-]+\]/g) || []))];
    if (holes.length) problems.push(`the custody record still carries ${holes.length} unfilled field(s): ${holes.slice(0, 6).join(' ')}${holes.length > 6 ? ' …' : ''}`);
    for (const needed of ['## Release authority', '## Ceremony', '## Procedure', '## Retired key']) if (!rec.includes(needed)) problems.push(`the custody record lacks the section '${needed}'`);
    if (releaseKeys.length === 1 && !rec.includes(releaseKeys[0].keyId)) problems.push('the custody record does not name the release key the trust store carries');
    if (!problems.some((p) => p.includes('custody record'))) clauses.push('custody procedure recorded, every field filled, names the release key');
  }

  const population = keys.length + retired.length + 1;
  if (problems.length) return fail(problems.join(' · '), { population });
  return okOverPopulation({ population, unit: 'key(s), retired id(s) and record', detail: clauses.join(' · ') });
};
