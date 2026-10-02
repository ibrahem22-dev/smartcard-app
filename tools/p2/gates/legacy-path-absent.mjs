/**
 * GATE: legacy-path-absent — criterion D3.  →  `LEGACY-PATH OK — 0 reachable`
 *
 * D3 asks for three distinct things and only one of them is "delete the file":
 *
 *   - the three bundled JSON datasets are **out of runtime** — and the plan says
 *     `fxAbroad.v2.json` is *"archived as a data lesson, removed from runtime"*, so a gate that
 *     demanded deletion would fail the instruction it is enforcing;
 *   - `useCardRatesDatabase.ts`, `useFxAbroad.ts` and `nonAuthorityDataAccess.ts` are **removed**;
 *   - the `DisabledDataAuthorityAdapter` **singleton** is removed, while WP-2.2 says to *keep the
 *     seam idea*.
 *
 * So the gate checks: out of the graph AND present in the archive · gone from disk · the symbol
 * absent from the runtime · and the seam present, because "keep the seam idea" is part of the
 * instruction and a gate that only checked removals would let it be dropped silently.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, APP_ENTRIES } from '../lib/import-graph.mjs';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['D3'];
export const SENTINEL = 'LEGACY-PATH OK — 0 reachable';

/**
 * CODE, WITH THE COMMENTS TAKEN OUT.
 *
 * The first version of the symbol check searched raw file text, and once the singleton was actually
 * removed it went on failing — on the three comments that EXPLAIN the removal, in the file it was
 * removed from, in the seam that replaced it, and in the test that used to exercise it.
 *
 * A symbol that no longer exists cannot be used; what remained was documentation naming what went.
 * Forbidding that would push the campaign toward deleting its own explanations to satisfy a gate,
 * which is exactly backwards.
 *
 * So comments are stripped and the search runs over code. This is STRICTER in the way that matters
 * — it still catches every real declaration, import, export and call — and it stops being satisfied
 * or defeated by prose either way.
 */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** Every source file under src/, derived — the population for the symbol search. */
const srcFiles = (dir, acc = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) srcFiles(p, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

export const run = async ({ root }) => {
  const spec = JSON.parse(readFileSync(join(HERE, '..', 'fenced.json'), 'utf8')).d3;
  const graph = buildGraph(root, APP_ENTRIES);
  const problems = [];
  const lines = [];

  if (spec.outOfRuntime.length === 0 || spec.removed.length === 0) {
    return fail('fenced.json declares no legacy path — a check over nothing is not a check');
  }

  lines.push('graph           ' + graph.reachable.size + ' project files reachable from ' + APP_ENTRIES.join(', '));

  let reachable = 0;

  // --- the datasets: out of the runtime, and the lesson kept -------------------------
  for (const d of spec.outOfRuntime) {
    if (graph.reachable.has(d.path)) { reachable += 1; problems.push(d.path + ' is still REACHABLE'); }
    if (existsSync(join(root, d.path))) problems.push(d.path + ' is still under src/ — D3 says out of runtime');
    if (!existsSync(join(root, d.archivedTo))) {
      problems.push(d.archivedTo + ' is missing. The plan: "Deleting it without archiving loses the lesson; leaving it in runtime keeps a second FX answer alive." Both halves are required');
    }
    lines.push('  dataset       ' + (existsSync(join(root, d.path)) ? 'STILL IN src/ ' : 'out of runtime')
      + ' · archived: ' + (existsSync(join(root, d.archivedTo)) ? 'yes' : 'NO') + ' · ' + d.path);
  }

  // --- the modules: removed ---------------------------------------------------------
  for (const m of spec.removed) {
    if (graph.reachable.has(m.path)) { reachable += 1; problems.push(m.path + ' is still REACHABLE'); }
    if (existsSync(join(root, m.path))) problems.push(m.path + ' still exists on disk — D3 says removed');
    lines.push('  module        ' + (existsSync(join(root, m.path)) ? 'ON DISK' : 'removed') + ' · ' + m.path);
  }

  // --- the singleton: absent from every source file ----------------------------------
  const files = srcFiles(join(root, 'src'));
  for (const s of spec.symbols) {
    const hits = files.filter((f) => stripComments(readFileSync(f, 'utf8')).includes(s.symbol))
      .map((f) => relative(root, f).replace(/\\/g, '/'));
    const mentions = files.filter((f) => readFileSync(f, 'utf8').includes(s.symbol)).length;
    if (hits.length) problems.push(s.symbol + ' is still USED in ' + hits.join(', '));
    lines.push('  symbol        ' + (hits.length ? 'USED in ' + hits.length + ' file(s)' : 'not used in code')
      + ' · mentioned in ' + mentions + ' comment(s)/file(s) · ' + s.symbol);
  }
  if (files.length === 0) problems.push('no source files found under src/ — the symbol search would pass vacuously');

  // --- the seam: kept, and reachable ------------------------------------------------
  if (!existsSync(join(root, spec.seam))) {
    problems.push(spec.seam + ' is missing. WP-2.2 says "keep the seam idea, drop the singleton" — a gate that only checked removals would let the seam be dropped silently');
  } else if (!graph.reachable.has(spec.seam)) {
    problems.push(spec.seam + ' exists but nothing reaches it. A seam nothing calls is not a seam; it means a consumer is still answering the question some other way');
  }
  lines.push('  seam          ' + (graph.reachable.has(spec.seam) ? 'present and reached' : 'NOT REACHED') + ' · ' + spec.seam);

  // --- the ADR E3 requires ----------------------------------------------------------
  if (!existsSync(join(root, spec.adr))) {
    problems.push('ADR missing at ' + spec.adr + ' — E3 requires every regression-net failure to be a deliberate, ADR-recorded consequence');
  } else {
    lines.push('  adr           ' + spec.adr);
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'LEGACY-PATH OK — ' + reachable + ' reachable, of '
      + (spec.outOfRuntime.length + spec.removed.length) + ' legacy paths and '
      + spec.symbols.length + ' symbol(s) checked',
  };
};
