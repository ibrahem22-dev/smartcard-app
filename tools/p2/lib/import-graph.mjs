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
import { stripCommentsAndStrings } from '../../mdc/lib/source.mjs';
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
const PATTERNS = [
  /\bimport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/dg,
  /\bimport\s*['"]([^'"]+)['"]/dg,
  /\bexport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/dg,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/dg,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/dg,
];

/**
 * MATCH THE MASK, READ THE RAW — OQ-MDC-010, the same repair as undeclared-imports.mjs.
 *
 * These patterns ran against RAW source, so a commented-out import added an edge to the graph and
 * the English word "import" ending a sentence inside a string literal added another — the closing
 * quote of the sentence served as the opening quote of a phantom specifier. An edge that does not
 * exist becomes an unresolved import, and `fenced-surfaces` turns every unresolved import into a
 * failure. Reachability is supposed to be a property of the graph; it was partly a property of the
 * prose.
 *
 * BLANKING THE STRINGS WOULD DELETE THIS RULE OUTRIGHT — more completely than anywhere else in
 * this sweep. A module specifier IS a string body: blank it and `import './global.css'` becomes
 * `import '           '`, every edge in the project is lost, the graph collapses to the entry
 * files, and `node-apis-absent` would report an empty runtime graph while `fenced-surfaces`
 * printed a vacuous "0 reachable" over a graph it never walked. Green, and meaningless.
 *
 * So the stripped copy is a MASK. It is length-preserving, so offsets align byte for byte: match
 * on the mask, where a prose keyword or a commented-out import has become spaces and can anchor
 * nothing, then read the specifier back out of the RAW text at the same offsets.
 */
const specifiersOf = (source) => {
  const mask = stripCommentsAndStrings(source);
  const out = [];
  for (const re of PATTERNS) {
    for (const m of mask.matchAll(re)) {
      const [from, to] = m.indices[1];
      out.push(source.slice(from, to));
    }
  }
  return [...new Set(out)];
};

/** Dynamic imports whose specifier is not a literal — reported, never assumed away. */
const dynamicUnresolved = (source) => {
  /* Masked for the same reason: a documented `import(someVar)` in a comment is not a dynamic
     import, and reporting it as one sends somebody looking for a call that is not there. */
  const mask = stripCommentsAndStrings(source);
  const out = [];
  for (const m of mask.matchAll(/\bimport\s*\(\s*([^'")][^)]*)\)/dg)) {
    const [from, to] = m.indices[1];
    out.push(source.slice(from, to).trim().slice(0, 60));
  }
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
