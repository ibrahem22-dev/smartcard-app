#!/usr/bin/env node
/**
 * PACK TEXT BOUNDARY — the durable answer to OQ-MDC-033.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE QUESTION THIS GATE EXISTS TO ANSWER
 *
 * A canonical pack is a research artefact as well as a product one. It carries, next to the Hebrew
 * title a reader is meant to see, the analyst's English note about how the row was extracted, the
 * provenance quote it came from, and — in `catalog.interest.appTreatment` — an instruction
 * addressed to the app itself, in the data. Artifact #7 removed one such leak from Learn
 * (PD-MDC-082); the unified upgrade found a second on the Benefits Hub, where `benefit.description`
 * printed *"Merchant discounts published as logos in a graphic; the merchant-to-rate mapping is not
 * text-extractable"* underneath a Hebrew title.
 *
 * Both were found by a person reading a screen. OQ-MDC-033 asked what should police this
 * statically. This is that instrument.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT IS NOT — AND THE MEASUREMENT THAT RULED IT OUT
 *
 * It is NOT a scan of pack text for research-shaped or login-shaped words. That instrument was
 * tried and measured: it fires on `content.contacts.disputeChannelUrl.note` ("the dispute flow
 * requires an authenticated personal area") — a true sentence about an ISSUER's website that no
 * reader ever sees — and it is silent on `benefit.description`, which reads like ordinary consumer
 * copy and was the actual leak. Shape is not the signal.
 *
 * Nor is it a scan for field NAMES in source. That was also tried and measured: it produced 60
 * hits of which every single one was a false positive — `obligation.description` on a cashflow row,
 * `entry.quote` on an FX quote, and two comments explaining why the pack's `description` is NOT
 * rendered. The names collide with the app's own vocabulary, and a gate answered by renaming a
 * prop teaches nothing. What survives of that idea is check 4 below, narrowed to names the app's
 * own types never declare.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT IS: A CLOSED-WORLD CENSUS PLUS A STRUCTURAL BOUNDARY
 *
 * 1. CENSUS. Walk the four shipped packs and collect every PATH whose values are prose — a string
 *    of at least `minProseChars` containing a space. A path descends through nested objects and
 *    arrays, so `content.rights.whatTheLawSays[].quoteHe` is classified on its own.
 *
 * 2. COMPLETENESS. Every censused path must appear in exactly one register: `consumer`, with the
 *    rule that makes it safe (LOCALIZED_TRIPLE, DISPLAY_NAME, PUBLISHED_SOURCE_TEXT), or
 *    `internal`, with the reason it is not (ANALYST_COMMENTARY, PROVENANCE_COMMENTARY,
 *    ESTATE_INSTRUCTION_TO_THE_APP, INTERNAL_IDENTIFIER). A path in neither fails this gate — so
 *    when the estate ships a new prose field, nobody can render it until somebody classifies it,
 *    and the classification is a diff a reviewer can see.
 *
 * 3. NO DEAD ENTRIES, and NO RAW ALIAS. A register that outlives its data stops being checked, so
 *    every entry must name a path the packs contain. And no module in `src/data/adapter/**` may
 *    re-export a raw adapter row as a consumer type (`export type BenefitView = AdapterBenefit`) —
 *    that alias IS the defect: it hands a surface every field the estate ships, and the type system
 *    then cannot tell `titleHe` from `description`. The consumer types are built by
 *    `consumerProjection.ts` from explicit field lists.
 *
 * 4. PROJECTION CROSS-CHECK. The field lists in `consumerProjection.ts` are read out of the source
 *    and checked against the register: a field classified internal for that unit may not be
 *    projected, and every internal prose field of that unit must be absent from the projection.
 *    Code and register cannot drift apart silently.
 *
 * 5. DISTINCTIVE-NAME REACH. Internal field names that the app's OWN types
 *    (`src/types/**`) never declare are distinctive: `scopeBasis`, `appTreatment`, `joinCaveat`,
 *    `benefitCoverageNote`. No module outside `src/data/adapter/**` may name one, in code — the
 *    scan strips comments first, because a comment saying a field is NOT rendered is the opposite
 *    of a leak.
 *
 * 6. NEGATIVE CONTROL. Both scanning checks are run against planted material and the gate fails if
 *    they do not trip. A check that cannot fail is not a check.
 *
 * Sentinel: PACK-TEXT-BOUNDARY OK | PACK-TEXT-BOUNDARY FAILED — <n> problem(s)
 */
import fs from 'node:fs';
import path from 'node:path';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';

export const SENTINEL = 'PACK-TEXT-BOUNDARY OK';
export const FAILURE_SENTINEL = 'PACK-TEXT-BOUNDARY FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const ADAPTER_DIR = path.join('src', 'data', 'adapter');
const PACK_DIR = path.join(ROOT, ADAPTER_DIR, 'packs');
const REGISTER = path.join(ROOT, ADAPTER_DIR, 'packTextRegister.json');
const PROJECTION = path.join(ROOT, ADAPTER_DIR, 'consumerProjection.ts');
const TYPES_DIR = path.join(ROOT, 'src', 'types');
const PACKS = ['catalog', 'benefits', 'content', 'taxonomy'];

export const run = async () => {
const problems = [];
const add = (m) => problems.push(m);


  const register = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const MIN = register.minProseChars;
  const consumer = register.consumer;
  const internal = register.internal;

  // ── 1. census ─────────────────────────────────────────────────────────────────────────────────
  const census = new Map();
  const isProse = (s) => typeof s === 'string' && s.length >= MIN && /\s/.test(s);
  const LOCALIZED = /[֐-׿؀-ۿ]/;

  function walk(base, value) {
    if (typeof value === 'string') {
      if (!isProse(value)) return;
      const entry = census.get(base) ?? { count: 0, localized: 0, sample: value.slice(0, 90) };
      entry.count += 1;
      if (LOCALIZED.test(value)) entry.localized += 1;
      census.set(base, entry);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(`${base}[]`, item);
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) walk(`${base}.${key}`, item);
    }
  }

  for (const pack of PACKS) {
    const doc = JSON.parse(fs.readFileSync(path.join(PACK_DIR, pack, 'pack.json'), 'utf8'));
    for (const [unit, rows] of Object.entries(doc.units ?? {})) {
      for (const row of rows) {
        for (const [key, value] of Object.entries(row)) walk(`${pack}.${unit}.${key}`, value);
      }
    }
  }

  // ── 2. completeness ───────────────────────────────────────────────────────────────────────────
  for (const [p, entry] of [...census.entries()].sort()) {
    const inConsumer = Object.hasOwn(consumer, p);
    const inInternal = Object.hasOwn(internal, p);
    if (inConsumer && inInternal) add(`classified twice: ${p}`);
    if (!inConsumer && !inInternal) {
      add(
        `UNCLASSIFIED prose path ${p} (${entry.count} value(s), ${entry.localized} localized) — ` +
          `classify it in packTextRegister.json before anything renders it. Sample: ${entry.sample}`,
      );
    }
  }

  // ── 3. no dead entries, no raw alias ──────────────────────────────────────────────────────────
  for (const p of [...Object.keys(consumer), ...Object.keys(internal)]) {
    if (!census.has(p)) add(`register names ${p}, which no shipped pack contains — stale entry`);
  }

  function sourceFiles(dir, acc, skipTests = true) {
    if (!fs.existsSync(dir)) return acc;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        if (skipTests && entry.name === '__tests__') continue;
        sourceFiles(full, acc, skipTests);
      } else if (/\.tsx?$/.test(entry.name)) {
        acc.push(full);
      }
    }
    return acc;
  }

  const RAW_ALIAS = /export\s+type\s+(\w+)\s*=\s*(Adapter\w+)\s*;/g;
  for (const file of sourceFiles(path.join(ROOT, ADAPTER_DIR), [])) {
    const rel = path.relative(ROOT, file);
    if (rel.endsWith(path.join('adapter', 'consumerProjection.ts'))) continue;
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = RAW_ALIAS.exec(text)) !== null) {
      add(
        `${rel} re-exports the raw row \`${m[2]}\` as the consumer type \`${m[1]}\` — a surface given ` +
          'that alias holds every field the estate ships. Project it in consumerProjection.ts instead.',
      );
    }
  }

  // ── 4. projection cross-check ─────────────────────────────────────────────────────────────────
  const projectionSource = fs.readFileSync(PROJECTION, 'utf8');
  const PROJECTED_UNITS = {
    BENEFIT_CONSUMER_FIELDS: 'benefits.benefits',
    MERCHANT_CONSUMER_FIELDS: 'taxonomy.merchants',
    GLOSSARY_CONSUMER_FIELDS: 'content.glossary',
    RIGHT_CONSUMER_FIELDS: 'content.rights',
  };
  const projectedFields = {};
  for (const [name, unit] of Object.entries(PROJECTED_UNITS)) {
    const m = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`).exec(projectionSource);
    if (m === null) {
      add(`consumerProjection.ts declares no ${name} — the projection cannot be checked`);
      continue;
    }
    const fields = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    projectedFields[unit] = fields;
    for (const field of fields) {
      const p = `${unit}.${field}`;
      if (Object.hasOwn(internal, p)) {
        add(`${name} projects ${field}, classified ${internal[p]} in the register`);
      }
    }
  }
  for (const [unit, fields] of Object.entries(projectedFields)) {
    const set = new Set(fields);
    for (const p of Object.keys(internal)) {
      // EXACT paths only. A DEEPER internal path (`benefits.benefits.value.text`) says nothing about
      // whether the projected field carries it: the adapter's own type already drops `value.text`,
      // exposing `{kind, value, unit}`. Whether a nested internal value survives projection is a
      // RUNTIME question, and it is answered at runtime — consumerProjection.test.ts projects every
      // shipped row and asserts no internal prose value survives anywhere inside the result.
      const exact = p === `${unit}.${'' /* leaf follows */}`;
      void exact;
      const leaf = p.slice(unit.length + 1);
      const bare = leaf.replace(/\[\]$/, '');
      if (leaf.includes('.')) continue;
      if (set.has(bare)) add(`the projection for ${unit} carries ${bare}, and ${p} is internal`);
    }
  }

  // ── 5. distinctive-name reach ─────────────────────────────────────────────────────────────────
  const appVocabulary = new Set();
  for (const file of sourceFiles(TYPES_DIR, [], false)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/^\s*(?:readonly\s+)?(\w+)\??\s*:/gm)) appVocabulary.add(m[1]);
  }
  const consumerLeaves = new Set(
    Object.keys(consumer).map((p) => p.split('.').pop().replace(/\[\]$/, '')),
  );
  const reachExempt = register.reachExempt ?? {};
  const distinctive = new Set();
  for (const p of Object.keys(internal)) {
    const leaf = p.split('.').pop().replace(/\[\]$/, '');
    if (appVocabulary.has(leaf)) continue; // the app declares this name on a type of its own
    if (consumerLeaves.has(leaf)) continue; // consumer-safe in another unit; the name cannot decide
    if (Object.hasOwn(reachExempt, leaf)) continue; // named in the register, with the reason
    distinctive.add(leaf);
  }
  for (const name of Object.keys(reachExempt)) {
    const known = Object.keys(internal).some((p) => p.split('.').pop().replace(/\[\]$/, '') === name);
    if (!known) add(`reachExempt names "${name}", which is not an internal leaf name — stale exemption`);
  }

  function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  }

  function reachHits(text, label) {
    const hits = [];
    const stripped = stripComments(text);
    for (const field of distinctive) {
      const re = new RegExp(`(?:\\.${field}\\b|['"\`]${field}['"\`])`, 'g');
      let m;
      while ((m = re.exec(stripped)) !== null) {
        hits.push(`${label} names the internal-only pack field "${field}"`);
        break;
      }
    }
    return hits;
  }

  const scanned = [];
  for (const file of sourceFiles(path.join(ROOT, 'src'), [])) {
    const rel = path.relative(ROOT, file);
    if (rel.startsWith(ADAPTER_DIR)) continue;
    scanned.push(rel);
    for (const hit of reachHits(fs.readFileSync(file, 'utf8'), rel)) add(hit);
  }

  // ── 6. negative controls ──────────────────────────────────────────────────────────────────────
  const probe = [...distinctive][0];
  if (probe === undefined) {
    add('negative control impossible: no distinctive internal field name survived');
  } else if (reachHits(`const x = row.${probe};`, '<control>').length === 0) {
    add(`negative control FAILED: the reach scan missed "${probe}" in a planted line`);
  } else if (reachHits(`// a comment mentioning row.${probe}\n`, '<control>').length !== 0) {
    add(`negative control FAILED: the reach scan fired on "${probe}" inside a comment`);
  }
  if (!isProse('The source pins 1 specific product id(s): cal_365_vip')) {
    add('negative control FAILED: the prose rule does not recognise a known analyst sentence');
  }
  if (isProse('CURRENT')) add('negative control FAILED: the prose rule accepted an enum token');

  // ── report ────────────────────────────────────────────────────────────────────────────────────
  const detail = [
    `${census.size} prose path(s) censused over ${PACKS.length} shipped pack(s): `
      + `${Object.keys(consumer).length} consumer-safe, ${Object.keys(internal).length} internal-only`,
    `${Object.keys(projectedFields).length} projection(s) cross-checked against the register`,
    `${distinctive.size} distinctive internal name(s) swept over ${scanned.length} module(s)`
      + (Object.keys(reachExempt).length ? ` (exempt: ${Object.keys(reachExempt).join(', ')})` : ''),
  ].join(' · ');

  /*
   * THE RUNTIME HALF. The static checks above are about names and lists; these two suites are about
   * VALUES — they project every shipped row and render the six canonical surfaces, then search for
   * the internal strings the artifact actually carries. A boundary proven only on names is a
   * boundary proven only on the parts somebody remembered to name.
   */
  const suites = requireJestCases(ROOT, 'src/data/adapter/__tests__/consumerProjection.test.ts', [
    'benefits', 'merchants', 'glossary terms', 'rights', 'contacts',
    'the RAW rows do carry it — so the assertions above are about the projection',
  ]);
  for (const p of suites.problems) add(p);

  const surfaces = requireJestCases(ROOT, 'src/screens/__tests__/packTextSurfaces.render.test.tsx', [
    'has a non-empty adversary on every pack — or it proves nothing',
    'Benefits Hub — every row expanded',
    'Merchant Radar — chips, a search hit and an evidenced absence',
    'Negotiation Hub — the sheet open on a real issuer',
    'Card DNA — every accordion open, and it is the Card Detail route',
    'Learn — glossary, rights and contacts',
  ]);
  for (const p of surfaces.problems) add(p);

  if (problems.length > 0) {
    return fail(problems[0], { problems, detail });
  }
  return okOverPopulation({
    population: census.size + scanned.length + suites.ran + surfaces.ran,
    unit: 'path(s), module(s) and case(s)',
    detail: `${detail} · ${suites.ran + surfaces.ran} jest case(s) run`,
  });
};
