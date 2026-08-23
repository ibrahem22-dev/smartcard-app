/**
 * THE FIVE ARCHITECTURAL-BOUNDARY RULES — Execution Model §9.4, criteria B7, D2 and D5.
 *
 * §9.4 is not advice. It opens with a sentence the campaign plan repeats as its one hard ordering
 * constraint:
 *
 *   > **This must exist before any parallel UI work.** Not after the first violation.
 *
 * The reason is cheap to state: a boundary rule added after the UI exists is a rule that gets
 * waived. So these land before Phase 4 opens, and Gate 3 is what lets phases 4–10 begin.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * MAPPING §9.4's VOCABULARY ONTO THIS APP, STATED RATHER THAN ASSUMED
 *
 * §9.4 was written against a layout with `ui/**` and `data/adapter/**`. This app has `src/screens`,
 * `src/components` and — until D1 lands in Phase 7 — no adapter directory at all. Each rule below
 * therefore records the mapping it applies. Where a rule's subject does not exist yet, it says so
 * and is still PROVEN BY ITS NEGATIVE CONTROL, because Gate 3 requires every rule to have been
 * watched to fire, and a rule nobody has seen fail is not a rule.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT COUNTS AS A VIOLATION IS DECIDED ON THE IMPORT GRAPH, not on a filename or a grep. A module
 * that reaches a forbidden thing through a barrel re-export has violated the rule exactly as much
 * as one that names it directly, and only the graph sees that.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { scanRuleFour } from './financial-literals.mjs';

const EXT = ['.ts', '.tsx', '.js', '.jsx', '.json'];

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === '__tests__') continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(e) && !/\.d\.ts$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/**
 * Every specifier a file imports, with the line the STATEMENT starts on.
 *
 * MATCHED AGAINST THE WHOLE SOURCE, NEVER LINE BY LINE — and this is not a style preference. A
 * line-based scanner cannot see the most ordinary import in this codebase:
 *
 *     import {
 *       calculateCardLoan,
 *       calculateInstallmentInterest,
 *     } from '../engines/interestCalculator';
 *
 * because no single line contains both `import` and the specifier. The first version of this
 * function was line-based, and rule 2 printed `0 violations` across 30 surfaces while
 * `InterestCalculatorScreen.tsx` was importing two calculating functions from an engine. Prettier
 * wraps any import with more than one named specifier, so the scanner was blind to exactly the
 * imports most likely to matter. **A check that cannot fail is not a check** — it was found by
 * running the rule against the tree and disbelieving a zero, which is the only reason it is not
 * still there.
 *
 * The line number is derived from the match index so a violation still points at real code.
 */
const importsOf = (abs) => {
  const code = stripComments(readFileSync(abs, 'utf8'));
  const lineAt = (index) => code.slice(0, index).split('\n').length;
  const out = [];
  for (const re of [
    /\bimport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]) {
    for (const m of code.matchAll(re)) out.push({ spec: m[1], line: lineAt(m.index), text: m[0] });
  }
  return out;
};

/** Resolve a relative specifier to a project path, or null for a bare package. */
const resolveLocal = (fromAbs, spec, root) => {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromAbs), spec);
  for (const cand of [base, ...EXT.map((e) => base + e), ...EXT.map((e) => join(base, 'index' + e))]) {
    if (existsSync(cand) && statSync(cand).isFile()) return relative(root, cand).replace(/\\/g, '/');
  }
  return null;
};

const rel = (root, abs) => relative(root, abs).replace(/\\/g, '/');

// ═════════════════════════════════════════════════════════════════════════════ RULE 1
/**
 * "engines/** may not import from ui/**, screens/**, components/**, or any network module."
 *
 * The engines are the one brain. A brain that imports a screen has a surface baked into it, and the
 * next surface gets a second brain. A brain that opens a socket cannot be tested from a fixture.
 */
const NETWORK_PACKAGES = ['axios', 'node-fetch', 'superagent', 'got', 'ky', '@supabase/supabase-js', 'socket.io-client'];
const NETWORK_GLOBALS = /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/g;

const rule1 = (root) => {
  const files = walk(join(root, 'src', 'engines'));
  const violations = [];
  for (const f of files) {
    const r = rel(root, f);
    for (const { spec, line } of importsOf(f)) {
      const local = resolveLocal(f, spec, root);
      if (local && /^src\/(screens|components|ui)\//.test(local)) {
        violations.push({ rule: 1, file: r, line, detail: 'imports a surface: ' + local });
      }
      if (!spec.startsWith('.') && NETWORK_PACKAGES.some((p) => spec === p || spec.startsWith(p + '/'))) {
        violations.push({ rule: 1, file: r, line, detail: 'imports a network package: ' + spec });
      }
    }
    // Whole-source, like importsOf and for the same reason: a call split across lines is still a
    // call. The line is derived from the match index so the violation points at real code.
    const code = stripComments(readFileSync(f, 'utf8'));
    for (const m of code.matchAll(NETWORK_GLOBALS)) {
      violations.push({
        rule: 1, file: r, line: code.slice(0, m.index).split('\n').length,
        detail: 'calls a network global: ' + m[0].replace(/\s+/g, ' '),
      });
    }
  }
  return { rule: 1, name: 'engines may not import a surface or a network module', population: files.length, violations };
};

// ═════════════════════════════════════════════════════════════════════════════ RULE 2
/**
 * "ui/**, screens/**, components/** may not import any math/calculation utility, and may not import
 * from engines/**\/internal/** — only the engines' public result types."
 *
 * MAPPING. This app has no `engines/**\/internal/**`; its engines expose their calculators directly
 * from `src/engines/*.ts`. The rule's intent is that a surface renders an engine's RESULT and never
 * performs the derivation itself — which is also contract §1's line between P2 and P3. So a surface
 * importing an engine's calculating module is a violation; a type-only import is not.
 *
 * THE BARREL IS NOT A LAUNDRY. `src/engines/index.ts` re-exports `calculateCardLoan` and
 * `calculateInstallmentInterest` as VALUES. An earlier version of this rule exempted `index.ts`
 * outright, which meant a surface could import the very same calculating function through the
 * barrel and pass — the rule would have policed the spelling of an import, not the boundary. This
 * file's own header says a module that reaches a forbidden thing through a re-export has violated
 * the rule exactly as much as one that names it directly, so the exemption is now narrow: importing
 * the barrel is fine, importing a BINDING the barrel re-exports as a value from a calculating
 * module is not. Type re-exports pass, because a type carries no arithmetic.
 */
const CALCULATING_MODULES = /^src\/engines\/(?!index\.ts$)[^/]+\.ts$/;
const ENGINE_BARREL = /^src\/engines\/index\.ts$/;

/**
 * The value bindings a barrel re-exports from calculating modules, so importing one through the
 * barrel is judged the same as importing it directly. Reads `export { a, type B } from './mod'`.
 */
const barrelValueBindings = (root, barrelAbs) => {
  const out = new Map();
  if (!existsSync(barrelAbs)) return out;
  const code = stripComments(readFileSync(barrelAbs, 'utf8'));
  for (const m of code.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const target = resolveLocal(barrelAbs, m[2], root);
    if (!target || !CALCULATING_MODULES.test(target)) continue;
    for (const piece of m[1].split(',')) {
      const t = piece.trim();
      if (!t || /^type\s/.test(t)) continue;            // a type carries no arithmetic
      const name = t.split(/\s+as\s+/)[0].trim();
      if (name) out.set(name, target);
    }
  }
  return out;
};

/** The binding names an import statement brings into scope, from its matched text. */
const bindingsOf = (statementText) => {
  const braces = statementText.match(/\{([^}]*)\}/);
  if (!braces) return [];
  return braces[1].split(',').map((p) => {
    const t = p.trim();
    if (!t || /^type\s/.test(t)) return null;
    const parts = t.split(/\s+as\s+/);
    return parts[0].trim();
  }).filter(Boolean);
};

const rule2 = (root) => {
  const files = [...walk(join(root, 'src', 'screens')), ...walk(join(root, 'src', 'components')), ...walk(join(root, 'src', 'ui'))];
  const violations = [];
  for (const f of files) {
    const r = rel(root, f);
    for (const { spec, line, text } of importsOf(f)) {
      const local = resolveLocal(f, spec, root);
      if (!local) continue;
      if (/^src\/engines\/.*\/internal\//.test(local)) {
        violations.push({ rule: 2, file: r, line, detail: 'imports engine internals: ' + local });
        continue;
      }
      if (ENGINE_BARREL.test(local)) {
        // Through the barrel: judge the BINDINGS, not the path.
        if (/\bimport\s+type\b/.test(text)) continue;
        const laundered = barrelValueBindings(root, join(root, 'src', 'engines', 'index.ts'));
        for (const name of bindingsOf(text)) {
          if (laundered.has(name)) {
            violations.push({
              rule: 2, file: r, line,
              detail: 'imports a calculating function through the engines barrel: ' + name
                + ' (re-exported from ' + laundered.get(name) + ')',
            });
          }
        }
        continue;
      }
      if (CALCULATING_MODULES.test(local)) {
        // A TYPE-ONLY import carries no calculation into the surface. Tested against the whole
        // matched STATEMENT, not against one line of it: `import type {\n  X,\n} from '...'` has
        // its `type` keyword on the first line and its specifier on the last.
        if (/\bimport\s+type\b/.test(text)) continue;
        violations.push({ rule: 2, file: r, line, detail: 'imports a calculating module rather than its result type: ' + local });
      }
    }
  }
  return { rule: 2, name: 'surfaces may not import a calculating module or engine internals', population: files.length, violations };
};

// ═════════════════════════════════════════════════════════════════════════════ RULE 3
/**
 * "Nothing outside data/adapter/** may import a pack file, a raw JSON dataset, or the local DB
 * driver directly."
 *
 * MAPPING. `src/data/adapter/**` does not exist yet — the adapter is criterion D1, Phase 7. Until it
 * does, the permitted set is EMPTY, which makes the rule strictly stronger rather than inapplicable:
 * *nothing at all* may import a dataset or a DB driver. D3 already removed the three that existed.
 */
const DB_DRIVERS = ['react-native-sqlite-storage', 'expo-sqlite', 'op-sqlite', 'react-native-quick-sqlite', 'better-sqlite3', 'sqlite3'];

const rule3 = (root) => {
  const files = walk(join(root, 'src'));
  const permitted = /^src\/data\/adapter\//;
  const violations = [];
  for (const f of files) {
    const r = rel(root, f);
    if (permitted.test(r)) continue;
    for (const { spec, line } of importsOf(f)) {
      if (!spec.startsWith('.') && DB_DRIVERS.some((d) => spec === d || spec.startsWith(d + '/'))) {
        violations.push({ rule: 3, file: r, line, detail: 'imports a DB driver directly: ' + spec });
      }
      const local = resolveLocal(f, spec, root);
      if (local && /\.json$/.test(local) && !/^src\/config\//.test(local)) {
        violations.push({ rule: 3, file: r, line, detail: 'imports a raw JSON dataset: ' + local });
      }
      if (/\.pack(\.json)?$/.test(spec)) {
        violations.push({ rule: 3, file: r, line, detail: 'imports a pack file: ' + spec });
      }
    }
  }
  return {
    rule: 3,
    name: 'only data/adapter/** may touch a pack, a dataset or the DB driver',
    population: files.length,
    note: existsSync(join(root, 'src', 'data', 'adapter'))
      ? 'src/data/adapter/** exists and is the permitted set'
      : 'src/data/adapter/** does not exist yet (D1, Phase 7), so the permitted set is EMPTY and the rule is strictly stronger',
    violations,
  };
};

// ═════════════════════════════════════════════════════════════════════════════ RULE 4
/** Delegated to the dedicated scanner, which carries its own explicit allowlist. */
const rule4 = (root) => {
  const r = scanRuleFour(root);
  const violations = r.violations.map((v) => ({
    rule: 4, file: v.file, line: v.line,
    detail: 'financial literal outside config/**: ' + v.literal + (v.identifier ? ' (' + v.identifier + ')' : ''),
  }));
  for (const s of r.stale) {
    violations.push({ rule: 4, file: s.file, line: 0, detail: 'STALE allowlist entry for ' + s.literal + ' — the literal is gone, and the entry would cover the next one' });
  }
  return {
    rule: 4,
    name: 'no rate/fee/threshold literal outside config/** and the packs',
    population: r.scanned,
    note: r.allowed.length + ' explicitly allowlisted, each with a reason',
    violations,
  };
};

// ═════════════════════════════════════════════════════════════════════════════ RULE 5
/**
 * "Analytics: no vault type may reach the track() boundary (OD-5, §2.2)."
 *
 * MAPPING. The `track()` boundary is criterion B6 and lands in Phase 10. Until it does there is no
 * call site to police — so the rule's SUBJECT is absent, and that is reported rather than counted
 * as a pass. Its negative control still proves it fires, which is what Gate 3 requires: a rule
 * nobody has seen fail is not a rule, whether or not it has anything to police today.
 *
 * WHAT IT LOOKS FOR when the boundary exists: a call to `track(...)` whose arguments mention a vault
 * type or a vault accessor. OD-5 and Exec §9.4 rule 5 forbid the value; a lint cannot prove the
 * absence of every path, so it forbids the SHAPE — the vocabulary of the vault appearing inside the
 * analytics call — which is what a reviewer would look for and what a careless change looks like.
 */
const VAULT_VOCABULARY = /\b(keyVault|getEncryptedStorage|EncryptedStorageHandle|vaultRow|dek|profilePin|pinHash|secureStore|SecureStore)\b/;

const rule5 = (root) => {
  const files = walk(join(root, 'src'));
  const violations = [];
  let callSites = 0;
  for (const f of files) {
    const r = rel(root, f);
    const code = stripComments(readFileSync(f, 'utf8'));
    code.split('\n').forEach((line, i) => {
      const m = line.match(/\btrack\s*\(([^)]*)\)/);
      if (!m) return;
      callSites += 1;
      if (VAULT_VOCABULARY.test(m[1])) {
        violations.push({ rule: 5, file: r, line: i + 1, detail: 'a vault value reaches track(): ' + line.trim().slice(0, 70) });
      }
    });
  }
  return {
    rule: 5,
    name: 'no vault type may reach the track() boundary',
    population: callSites,
    note: callSites === 0
      ? 'NO track() CALL SITES EXIST YET — the analytics boundary is criterion B6, Phase 10. The rule is in force and proven by its negative control; it has nothing to police today, and that is stated rather than counted as a pass'
      : callSites + ' track() call site(s) examined',
    violations,
  };
};

export const RULES = [rule1, rule2, rule3, rule4, rule5];

export const runBoundaryRules = (root) => {
  const results = RULES.map((r) => r(root));
  const violations = results.flatMap((r) => r.violations);
  return { results, violations };
};
