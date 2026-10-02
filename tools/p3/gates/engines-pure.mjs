/**
 * GATE: engines-pure — criterion N6.  →  `ENGINES-PURE OK`
 *
 *   > *"The engines have zero UI imports, enforced at build time."*  (spec §20 hard rule: no
 *   > surface holds recommendation logic; roadmap calls engines-before-surfaces the
 *   > architectural invariant.)
 *
 * THE POPULATION IS DERIVED, NEVER HAND-LISTED: the modules come from MVP_ENGINE_MODULES, and
 * everything they reach through LOCAL src imports is walked transitively. A UI module anywhere
 * in that graph fails this gate — an engine that reaches React through three hops is as
 * impure as one that imports it directly. Bare UI specifiers (react, react-native, expo,
 * @expo/*, react-native-*) are refused outright, as is any local file that is itself UI (.tsx).
 *
 * Negative control (the contract's own): import a React component into an engine module and
 * watch this gate fail.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['N6'];
export const SENTINEL = 'ENGINES-PURE OK';

const SRC = 'src';
const MVP_MODULES = 'src/engines/mvpEngines.ts';

/** Bare specifiers that are UI by name. An engine reaching these is a P4 defect committed early. */
const UI_BARE = /^(react|react-dom|react-native|react-test-renderer)$|^react-native-|^@expo(\/|-)|^expo$|^@testing-library\/react/;

/** Import sources we walk into (local project files); anything else must pass the bare check. */
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s(?:[\s\S]*?)?from\s+['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

function listMvpModules(root) {
  const p = join(root, MVP_MODULES);
  if (!existsSync(p)) return { error: MVP_MODULES + ' does not exist' };
  const list = readFileSync(p, 'utf8').match(/MVP_ENGINE_MODULES\s*=\s*\[([^\]]*)\]/)?.[1] ?? '';
  const modules = [...list.matchAll(/'([^']+\.(?:ts|tsx))'/g)].map((m) => m[1]);
  if (modules.length === 0) return { error: MVP_MODULES + ' lists no engine modules' };
  return { modules };
}

function resolveLocal(fromFileAbs, specifier) {
  const base = resolve(dirname(fromFileAbs), specifier);
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  // An exactly-named file (e.g. identity.json imported by src/config/identity.ts) resolves too.
  // It may sit anywhere under the app root; the walk below decides what matters about it.
  return existsSync(base) ? base : null;
}

let root_ = null;

export const run = async ({ root }) => {
  root_ = root;
  const population = listMvpModules(root);
  if (population.error) return fail(population.error);

  // Walk each engine's LOCAL import graph; bare specifiers are checked but not followed.
  const failures = [];
  for (const entry of population.modules) {
    const entryPath = join(root, 'src', 'engines', entry);
    if (!existsSync(entryPath)) return fail('engine module missing on disk: ' + entry);
    const seen = new Set();
    const queue = [{ file: entryPath, via: entry }];
    while (queue.length > 0) {
      const { file, via } = queue.shift();
      if (seen.has(file)) continue;
      seen.add(file);
      // A resolved data file (.json) is not code and imports nothing: it cannot carry surface
      // logic, so the walk stops here rather than pretending it is unreadable.
      if (file.endsWith('.json')) continue;
      if (file.endsWith('.tsx')) {
        failures.push(via + ' reaches UI file ' + file.replace(root, '').replace(/\\/g, '/'));
        continue;
      }
      const src = readFileSync(file, 'utf8');
      for (const match of src.matchAll(IMPORT_RE)) {
        const spec = match[1] ?? match[2];
        if (!spec) continue;
        if (UI_BARE.test(spec)) {
          failures.push(via + ' imports UI "' + spec + '"');
          continue;
        }
        if (spec.startsWith('.')) {
          const resolved = resolveLocal(file, spec);
          if (resolved === null) {
            failures.push(via + ' has an unresolvable local import "' + spec + '"');
            continue;
          }
          queue.push({ file: resolved, via: resolved.replace(root, '').replace(/\\/g, '/') });
        }
      }
    }
  }

  if (failures.length > 0) {
    return fail('UI found in the engine graph:\n    ' + failures.join('\n    ')
      + '\n  Engines are pure: no surface logic may be reachable from them (spec §20).');
  }

  return ok(SENTINEL, [
    'population     ' + population.modules.length + ' MVP module(s) from ' + MVP_MODULES,
    'walked         every LOCAL import transitively; UI bare specifiers and .tsx refused',
    'result         zero UI imports across the engine graph',
  ].join('\n'));
};
