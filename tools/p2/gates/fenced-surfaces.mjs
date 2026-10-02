/**
 * GATE: fenced-surfaces — criterion B9.  →  `FENCED OK — 0 reachable`
 *
 * B9 fences three different kinds of thing and the contract uses three different verbs for them:
 * the paywall is **unmounted**, Register/OTP and the dead routes are **removed**, and Supabase and
 * RevenueCat are **archived out of the dependency manifest**. The gate checks each against what its
 * verb actually asks, rather than flattening all three into "the file is gone".
 *
 * REACHABILITY IS DERIVED FROM THE IMPORT GRAPH, walked from the real entry points. The inherited
 * test read `expect(source).not.toContain('BenefitsScreen')` over a hand-written list of seven
 * files — so a module reached from a file that was not on that list was invisible to it, and eight
 * fenced modules were reachable while it passed. B9 says `0 reachable`, and reachable is a property
 * of the graph.
 *
 * WHAT IS DECLARED AND WHAT IS DERIVED, stated plainly rather than blurred: the LIST of fenced
 * surfaces is declared in `tools/p2/fenced.json`, because the contract names them individually in
 * prose and there is no machine-readable source to derive them from. Their REACHABILITY is derived.
 * The gate additionally refuses a declaration that has gone stale — a `removed` path that is back
 * on disk fails, and so does an entry whose archive record is missing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, APP_ENTRIES } from '../lib/import-graph.mjs';
import { ok, fail } from '../lib/report.mjs';
import { scanUndeclaredImports } from '../lib/undeclared-imports.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['B9'];
export const SENTINEL = 'FENCED OK — 0 reachable';

export const run = async ({ root }) => {
  const spec = JSON.parse(readFileSync(join(HERE, '..', 'fenced.json'), 'utf8')).b9;
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const graph = buildGraph(root, APP_ENTRIES);

  const problems = [];
  const lines = [];

  lines.push('entry points    ' + APP_ENTRIES.join(', '));
  lines.push('graph           ' + graph.reachable.size + ' project files · ' + graph.external.size + ' external packages');

  // No vacuous pass: a fence over nothing is not a fence.
  if (spec.modules.length === 0 || spec.packages.length === 0) {
    return fail('fenced.json declares no modules or no packages — a fence over nothing proves nothing');
  }

  // --- unresolved edges are reported, never assumed absent ---------------------------
  if (graph.unresolved.length) {
    for (const u of graph.unresolved.slice(0, 5)) {
      problems.push('unresolved import ' + JSON.stringify(u.spec) + ' in ' + u.from + ' — a module reached only through it would be invisible to this gate');
    }
  }
  if (graph.dynamic.length) {
    for (const d of graph.dynamic.slice(0, 5)) {
      problems.push('dynamic import with a computed specifier in ' + d.from + ' (' + d.expression + ') — reachability through it cannot be decided statically');
    }
  }

  // --- modules ----------------------------------------------------------------------
  let reachableCount = 0;
  for (const m of spec.modules) {
    const reachable = graph.reachable.has(m.path);
    const onDisk = existsSync(join(root, m.path));
    if (reachable) { reachableCount += 1; problems.push(m.path + ' is REACHABLE from the entry point (' + m.what + ')'); }
    if (m.requirement === 'removed' && onDisk) {
      problems.push(m.path + ' still exists on disk, and B9 says removed — unreachable is not the same as gone');
    }
    lines.push('  ' + (reachable ? 'REACHABLE' : 'not reached').padEnd(12) + (onDisk ? 'on disk ' : 'gone    ') + m.path);
  }

  // --- packages ---------------------------------------------------------------------
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const p of spec.packages) {
    if (deps[p.name]) problems.push(p.name + ' is still in the dependency manifest at ' + deps[p.name]);
    if (graph.external.has(p.name)) {
      reachableCount += 1;
      problems.push(p.name + ' is still reached, by ' + [...graph.external.get(p.name)].join(', '));
    }
    lines.push('  ' + (graph.external.has(p.name) ? 'REACHED   ' : 'not reached').padEnd(12)
      + (deps[p.name] ? 'in manifest ' : 'not in manifest ') + p.name);
  }

  // --- no source file may import a package the manifest does not declare --------------
  //
  // THE CHECK THAT WAS MISSING WHEN THIS GATE FIRST PRINTED GREEN. Reachability said "0 reachable"
  // and was right; `src/hooks/useProfileShare.ts` still imported `expo-camera`, unreached and
  // therefore invisible here, and it broke `tsc` on any clean install. UNREACHABLE IS NOT ABSENT.
  //
  // The population is derived from `src/**`, and the declaration is read from package.json rather
  // than from node_modules — so the answer cannot depend on what happens to be installed on the
  // machine running it, which is exactly how the original miss survived local verification.
  const undeclared = scanUndeclaredImports(root);
  if (undeclared.scanned === 0) {
    problems.push('scanned 0 files under src/ — an empty population cannot clear anything');
  }
  for (const u of undeclared.findings) {
    problems.push(u.file + ':' + u.line + ' names ' + u.package + (u.via ? ' in ' + u.via : '')
      + ', which package.json does not declare — unreachable is not absent, and a clean install cannot use this');
  }
  if (undeclared.plugins === 0) {
    problems.push('app.json declares no expo plugins — either the config moved or this check is reading the wrong file, and both are worth stopping for');
  }
  lines.push('undeclared      ' + undeclared.findings.length + ' reference(s) to packages the manifest does not declare · '
    + undeclared.scanned + ' files and ' + undeclared.plugins + ' expo plugin(s) checked against ' + undeclared.declared + ' declared');

  // --- the archive B9 asks for -------------------------------------------------------
  if (!existsSync(join(root, spec.archive))) {
    problems.push('B9 says ARCHIVED, and ' + spec.archive + ' does not exist. A dependency that disappears without a record leaves the next reader unable to tell a decision from an accident');
  } else {
    lines.push('archive         ' + spec.archive);
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'FENCED OK — ' + reachableCount + ' reachable, of '
      + spec.modules.length + ' modules and ' + spec.packages.length + ' packages fenced',
  };
};
