/**
 * GATE: node-apis-absent — Gate 7's third guarantee, and the one that keeps `fsPackReader` honest.
 *   →  `NODE-APIS OK — 0 node builtins in the runtime graph`
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * `src/data/adapter/fsPackReader.ts` imports `node:fs`. It has to: it is the reader that opens the
 * real packs in the environment where they can be verified before anybody's phone is involved, and
 * `node:fs` is how a file is read there.
 *
 * Its own header claims *"nothing in the app's runtime graph reaches this module"*. **That sentence
 * was a comment until this gate existed**, and a comment is not a boundary — the campaign has
 * already found a load-time check replaced by prose (handoff §2, IF-7) and a successor lint weaker
 * than the predecessor whose backlog it closed.
 *
 * React Native has no `fs`. A single import chain from `App.tsx` to this module produces a red
 * screen at startup on a real device — the one environment where nobody can attach a debugger, and
 * the environment CI never enters.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT MEASURES
 *
 * The graph reachable from the app's real entry points, walked, and every bare specifier that is a
 * Node builtin. Not a filename convention, not a directory rule: reachability. A module can be
 * called anything and sit anywhere; what matters is whether the bundler will follow an edge to it.
 *
 * REFUSES an empty graph. A gate reporting "0 builtins in 0 files" is the vacuous pass, and the
 * entry points are the first thing that could silently stop resolving.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';
import { buildGraph, APP_ENTRIES } from '../lib/import-graph.mjs';

export const CRITERIA = [];
export const SENTINEL = 'NODE-APIS OK — 0 node builtins in the runtime graph';

/**
 * The Node builtins, by name and by `node:` prefix.
 *
 * Listed rather than derived because the list is the definition: `module.builtinModules` on the
 * running Node would describe THIS Node, and the question is what React Native's bundler cannot
 * resolve, which is all of them regardless of the version running the gate.
 */
const BUILTINS = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto',
  'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https',
  'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events', 'tty',
  'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
];

const isBuiltin = (pkg) => {
  const bare = pkg.startsWith('node:') ? pkg.slice(5) : pkg;
  return BUILTINS.includes(bare);
};

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  for (const entry of APP_ENTRIES) {
    if (!existsSync(join(root, entry))) {
      return fail('the entry point ' + entry + ' does not exist. Reachability from nowhere is not '
        + 'a measurement, and this gate would report zero builtins for a graph it never walked');
    }
  }

  const graph = buildGraph(root, APP_ENTRIES);
  if (graph.reachable.size === 0) {
    return fail('the runtime graph is empty — an empty graph contains no builtins and proves nothing');
  }

  const offenders = [];
  for (const [pkg, importers] of graph.external) {
    if (!isBuiltin(pkg)) continue;
    for (const importer of importers) offenders.push({ pkg, importer });
  }

  for (const o of offenders.slice(0, 6)) {
    problems.push(o.importer + ' imports the Node builtin "' + o.pkg + '" and is REACHABLE from '
      + APP_ENTRIES.join(' / ') + '. React Native has no such module: this is a red screen at '
      + 'startup on a device, in the one environment nobody can attach a debugger to and CI never '
      + 'enters');
  }
  if (offenders.length > 6) problems.push('… and ' + (offenders.length - 6) + ' more');

  lines.push('entries         ' + APP_ENTRIES.join(', '));
  lines.push('runtime graph   ' + graph.reachable.size + ' file(s) reachable · '
    + graph.external.size + ' package(s) imported');
  lines.push('node builtins   ' + offenders.length + ' in the runtime graph');

  // The module this gate was written for, named, so the report says what it is protecting.
  const READER = 'src/data/adapter/fsPackReader.ts';
  if (existsSync(join(root, READER))) {
    const reached = graph.reachable.has(READER);
    lines.push('fsPackReader    ' + (reached ? 'REACHABLE — this is the failure' : 'not reachable from the app entry, which is the claim its header makes'));
    if (reached) {
      problems.push(READER + ' is reachable from the app entry. It imports node:fs because it is '
        + 'the reader tests use; the device reader is criterion C1 and Phase 8. Its header says '
        + 'nothing in the runtime graph reaches it, and that is now false');
    }
  } else {
    lines.push('fsPackReader    absent — nothing to protect, and this gate says so rather than passing quietly');
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 3).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'NODE-APIS OK — ' + offenders.length + ' node builtins in the runtime graph',
  };
};
