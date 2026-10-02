/**
 * THE IMPORT GRAPH — what the application can actually reach from its entry point.
 *
 * WHY THIS EXISTS RATHER THAN A STRING SEARCH.
 *
 * The inherited test for this was `expect(source).not.toContain('BenefitsScreen')`, applied to a
 * hand-written list of seven files. It has two failure modes and both are silent:
 *
 *   - a file NOT on the list may import the thing freely, and nothing looks;
 *   - the string may be absent while the module is still reached through a re-export, an index
 *     barrel, or a differently-named import.
 *
 * Criterion B9 does not say "the name does not appear". It says **`FENCED OK — 0 reachable`**.
 * Reachability is a property of the graph, so the graph is what gets built: start at the real entry
 * point, follow every static import, and see what the set contains.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not resolve dynamic `import()` with a computed
 * specifier, because that cannot be decided statically — and it says so rather than pretending the
 * answer is no. Any dynamic import with a non-literal specifier is REPORTED as an unresolved edge,
 * so a module reached only that way shows up as an unknown rather than as an absence.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json'];

/** Resolve a relative specifier the way Metro/TypeScript would: exact, then extensions, then /index. */
const resolveLocal = (fromFile, spec) => {
  const base = resolve(dirname(fromFile), spec);
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const idx = join(base, 'index' + ext);
    if (existsSync(idx)) return idx;
  }
  return null;
};

/**
 * Every static specifier in a source file: `import … from 'x'`, `export … from 'x'`,
 * `require('x')`, and `import('x')` with a literal.
 */
const specifiersOf = (source) => {
  const out = [];
  const patterns = [
    /\bimport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) out.push(m[1]);
  }
  return [...new Set(out)];
};

/** Dynamic imports whose specifier is not a literal — reported, never assumed away. */
const dynamicUnresolved = (source) => {
  const out = [];
  for (const m of source.matchAll(/\bimport\s*\(\s*([^'")][^)]*)\)/g)) out.push(m[1].trim().slice(0, 60));
  return out;
};

/**
 * Walk from one or more entry files. Returns:
 *   reachable       Set of absolute paths inside the project
 *   external        Set of bare package specifiers reached
 *   unresolved      edges that could not be resolved, with the file that owns them
 *   dynamic         dynamic imports with a computed specifier
 */
export const buildGraph = (root, entries) => {
  const reachable = new Set();
  const external = new Map();
  const unresolved = [];
  const dynamic = [];
  const queue = [];

  for (const e of entries) {
    const p = resolve(root, e);
    if (!existsSync(p)) { unresolved.push({ from: '(entry)', spec: e, reason: 'entry file does not exist' }); continue; }
    queue.push(p);
  }

  while (queue.length) {
    const file = queue.shift();
    if (reachable.has(file)) continue;
    reachable.add(file);
    if (file.endsWith('.json')) continue;

    let source;
    try { source = readFileSync(file, 'utf8'); } catch { unresolved.push({ from: file, spec: '(self)', reason: 'unreadable' }); continue; }

    for (const d of dynamicUnresolved(source)) dynamic.push({ from: relative(root, file).replace(/\\/g, '/'), expression: d });

    for (const spec of specifiersOf(source)) {
      if (spec.startsWith('.') || spec.startsWith('/')) {
        const target = resolveLocal(file, spec);
        if (target) { if (!reachable.has(target)) queue.push(target); }
        else unresolved.push({ from: relative(root, file).replace(/\\/g, '/'), spec, reason: 'could not resolve' });
      } else {
        // A bare specifier is a package. Record who reached it; do not walk into node_modules.
        const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (!external.has(pkg)) external.set(pkg, new Set());
        external.get(pkg).add(relative(root, file).replace(/\\/g, '/'));
      }
    }
  }

  return {
    reachable: new Set([...reachable].map((f) => relative(root, f).replace(/\\/g, '/'))),
    external,
    unresolved,
    dynamic,
  };
};

/** The application's real entry points, in load order. */
export const APP_ENTRIES = ['index.js', 'App.tsx'];
