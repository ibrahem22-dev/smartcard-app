/**
 * MDC GATE — pack-custody (V8: SIGNING CUSTODY)
 *
 * V8 reads: "release signing custody exists per OB-8, the compromised development key appears nowhere in
 * the release path, and custody procedure is recorded — attested by the Owner." OB-8 is the Ed25519
 * PACK-signing development key that was committed and pushed, then retired: its id is kept in
 * RETIRED_KEY_IDS so an old envelope still explains itself and the key can never be re-admitted, and
 * its public half no longer sits in the shipped trust store. Custody per OD-25 means a HARDWARE_BACKED
 * release authority must exist before public release.
 *
 * This gate MEASURES the pipeline's committed trust store and envelope (the only authority the app
 * compiles in through the adapter) and the campaign's custody record. It is RED until all three hold:
 *   1. release custody exists: exactly ONE HARDWARE_BACKED key is the signing authority — a key whose
 *      lifecycle is ACTIVE_SIGNING, or that carries no lifecycle field (the single-root store). Further
 *      HARDWARE_BACKED keys are allowed only with a non-signing lifecycle (RECOVERY, RETIRED_ACCEPT_ONLY,
 *      REVOKED) and must each be named in the custody record — a hardware-custody claim without its
 *      evidence is exactly OQ-MDC-022's "evidence not recorded" (PD-MDC-081);
 *   2. the retired development key is nowhere in the release path: its id stays in RETIRED_KEY_IDS, and
 *      no release-eligible key carries it or a development custody;
 *   3. the custody procedure is recorded: evidence/external/V8/CUSTODY_RECORD.md exists with its four
 *      sections, no unfilled [FIELD], and names every hardware-backed key the store carries.
 *
 * Reads the pipeline at ../smartcard-data-pipeline. MDC_PACK_CUSTODY_PIPELINE overrides that root — it
 * exists only so the gate can be falsified against fixtures (tools/mdc/fixtures/pack-custody); no
 * campaign command sets it.
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
const PIPELINE = process.env.MDC_PACK_CUSTODY_PIPELINE || join(ROOT, '..', 'smartcard-data-pipeline');
const TRUST_STORE = join(PIPELINE, 'src', 'pack', 'trust-store.ts');
const ENVELOPE = join(PIPELINE, 'src', 'pack', 'envelope.ts');
const RECORD = join(PIPELINE, 'campaign-master', 'evidence', 'external', 'V8', 'CUSTODY_RECORD.md');
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');

const SIGNING_LIFECYCLES = new Set(['ACTIVE_SIGNING']);
const NON_SIGNING_LIFECYCLES = new Set(['RECOVERY', 'RETIRED_ACCEPT_ONLY', 'REVOKED']);

/** One entry per `keyId:` in the TRUST_STORE literal: custody, and lifecycle when the file carries it. */
const parseKeys = (src) => {
  const keys = [];
  const parts = src.split(/keyId:\s*/).slice(1);
  for (const part of parts) {
    const id = part.match(/^["']([^"']+)["']/);
    if (!id) continue;
    const chunk = part.split(/keyId:\s*/)[0];
    const custody = chunk.match(/custody:\s*'([A-Z_]+)'/);
    const lifecycle = chunk.match(/lifecycle:\s*'([A-Z_]+)'/);
    keys.push({ keyId: id[1], custody: custody ? custody[1] : 'UNKNOWN', lifecycle: lifecycle ? lifecycle[1] : null });
  }
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
  clauses.push(`trust store: ${keys.length} key(s) [${keys.map((k) => `${k.keyId.slice(0, 28)}… ${k.custody}${k.lifecycle ? '/' + k.lifecycle : ''}`).join('; ')}] · retired ids ${retired.length}`);

  /* 1. release custody exists — exactly one signing authority among the hardware-backed keys */
  const releaseKeys = keys.filter((k) => eligible.includes(k.custody));
  const signing = releaseKeys.filter((k) => k.lifecycle === null || SIGNING_LIFECYCLES.has(k.lifecycle));
  const others = releaseKeys.filter((k) => !signing.includes(k));
  if (releaseKeys.length === 0) problems.push('NO release-signing custody exists: the committed trust store holds no HARDWARE_BACKED key (OB-8 stands; OD-25 requires one before public release)');
  else if (signing.length !== 1) problems.push(`${signing.length} HARDWARE_BACKED signing authorities (ACTIVE_SIGNING or lifecycle-less) — signingKeyIdFor requires exactly one`);
  else clauses.push(`release custody: ${signing[0].keyId}${signing[0].lifecycle ? ' (' + signing[0].lifecycle + ')' : ''}`);
  for (const k of others) {
    if (!NON_SIGNING_LIFECYCLES.has(k.lifecycle)) problems.push(`hardware-backed key ${k.keyId} carries lifecycle '${k.lifecycle}', which is neither a signing nor a recognised non-signing lifecycle`);
  }
  if (others.length) clauses.push(`${others.length} further hardware-backed key(s), non-signing: ${others.map((k) => `${k.keyId} (${k.lifecycle})`).join(', ')}`);

  /* 2. the retired development key is nowhere in the release path */
  const devKeys = keys.filter((k) => /DEV|NOT_FOR_RELEASE/i.test(k.keyId) || /DEV/.test(k.custody));
  if (retired.length === 0) problems.push('RETIRED_KEY_IDS is empty — the leaked development key id must stay named so it can never be re-admitted');
  for (const k of releaseKeys) if (retired.includes(k.keyId) || /DEV|NOT_FOR_RELEASE/i.test(k.keyId)) problems.push(`a release-eligible key is a development or retired key: ${k.keyId}`);
  clauses.push(`${devKeys.length} development key(s) in the store, none release-eligible; ${retired.length} retired id(s) kept`);

  /* 3. the custody procedure is recorded — and names EVERY hardware-backed key the store carries */
  if (!existsSync(RECORD)) problems.push('no custody record at evidence/external/V8/CUSTODY_RECORD.md — the procedure is not recorded');
  else {
    const rec = readFileSync(RECORD, 'utf8');
    const holes = [...new Set((rec.match(/\[[A-Z][A-Z0-9 /_\-]+\]/g) || []))];
    if (holes.length) problems.push(`the custody record still carries ${holes.length} unfilled field(s): ${holes.slice(0, 6).join(' ')}${holes.length > 6 ? ' …' : ''}`);
    for (const needed of ['## Release authority', '## Ceremony', '## Procedure', '## Retired key']) if (!rec.includes(needed)) problems.push(`the custody record lacks the section '${needed}'`);
    for (const k of releaseKeys) if (!rec.includes(k.keyId)) problems.push(`the custody record does not name the hardware-backed key the trust store carries: ${k.keyId}`);
    if (!problems.some((p) => p.includes('custody record'))) clauses.push(`custody procedure recorded, every field filled, names ${releaseKeys.length} hardware-backed key(s)`);
  }

  const population = keys.length + retired.length + 1;
  if (problems.length) return fail(problems.join(' · '), { population });
  return okOverPopulation({ population, unit: 'key(s), retired id(s) and record', detail: clauses.join(' · ') });
};
