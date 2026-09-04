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

/**
 * THE TWO FROZEN BRAND-TOKEN READS — importer → file, ENUMERATED and EXPORTED. OQ-MDC-029 option 1,
 * PD-MDC-065, adjudicated under the Owner's standing delegation on 2026-09-04.
 *
 * `assets/brand/geometry.tokens.json` and `assets/brand/typography.tokens.json` hold the spacing,
 * radius, stroke and type scales the Brand packages freeze (Phase 15, Phase 9). A spacing step of 16
 * is not a fact about anybody's money and has no provenance tier to lose — the same reasoning under
 * which `identity.json` is named below. They are data rather than TypeScript literals because P5's
 * no-magic-numbers gate refuses a campaign allowlisting literals in files it created (T1 tried that
 * and was refused), and they are not TRUSTED as data: tools/mdc/gates/tokens-swap.mjs clause 8
 * compares the typography file byte for byte with the canonical package and the geometry file
 * against the numbers parsed out of the Phase 15 reference, on every run.
 *
 * ONE HOME, COMPARED. tokens-swap imports THIS map and FAILS if the set it checks against the
 * authorities is not identical to the set exempted here, or if the D7 register's disposition does
 * not cover exactly these pairs. So a third file cannot be added to one list and forgotten in the
 * other. It is a map of importer → file, not a directory or a suffix pattern: the same file read
 * from any other module, or any other file under assets/brand/, is still a violation — both are
 * negative controls in tools/p2/boundary-controls.mjs.
 */
export const BRAND_TOKEN_READS = Object.freeze({
  'src/theme/geometry.ts': 'assets/brand/geometry.tokens.json',
  'src/theme/typography.ts': 'assets/brand/typography.tokens.json',
});

const rule3 = (root) => {
  const files = walk(join(root, 'src'));
  /**
   * THE PERMITTED SET IS THE ADAPTER **AND THE PACK STORE**.
   *
   * §9.4 names `data/adapter/**`, written against a layout where one module owned both the driver
   * and the reading of it. Criterion B3 splits that: `src/store/packStore.ts` owns the SQLite
   * driver, `src/store/storeAdapter.ts` reads across it and the vault, and the split is the
   * mechanism that makes B4's guarantee structural — the override is not in the pack store, so a
   * pack update cannot reach it.
   *
   * Naming the pack store here is therefore not a widening of the rule; it is the rule pointing at
   * the module the contract designated. It is named EXPLICITLY rather than by a directory glob, so
   * the next module somebody adds under `src/store/` does not inherit permission to open a database.
   */
  const permitted = /^src\/(data\/adapter\/|store\/packStore\.ts$)/;
  const violations = [];
  for (const f of files) {
    const r = rel(root, f);
    if (permitted.test(r)) continue;
    for (const { spec, line } of importsOf(f)) {
      if (!spec.startsWith('.') && DB_DRIVERS.some((d) => spec === d || spec.startsWith(d + '/'))) {
        violations.push({ rule: 3, file: r, line, detail: 'imports a DB driver directly: ' + spec });
      }
      const local = resolveLocal(f, spec, root);
      // THE IDENTITY SOURCE IS BUILD CONFIGURATION, NOT A DATASET.
      //
      // R3 exists so every REFERENCE READ carries its provenance, tier and lastUpdated — a rate, a
      // fee, a card. `identity.json` holds the display name, the bundle id and a storage
      // namespace. None of it is a fact about anybody's money, none of it has a provenance to
      // lose, and it is read by `app.config.js` in plain Node before TypeScript exists, so it
      // cannot live under `src/config/**` with the other constants.
      //
      // Named explicitly rather than exempting root JSON generally: a blanket exemption would
      // cover the next dataset somebody drops at the root.
      const isIdentitySource = local === 'identity.json';
      // The two enumerated brand-token reads (BRAND_TOKEN_READS above): this importer, this file.
      const isBrandTokenRead = BRAND_TOKEN_READS[r] === local;
      if (local && /\.json$/.test(local) && !/^src\/config\//.test(local) && !isIdentitySource && !isBrandTokenRead) {
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
      ? 'src/data/adapter/** and src/store/packStore.ts (B3) are the permitted set'
      : 'src/data/adapter/** does not exist yet (D1, Phase 7); src/store/packStore.ts is permitted by B3 and is the only module that may open the DB driver',
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
  let declaredProps = 0;

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

    // THE DECLARATION IS POLICED BEFORE ANY CALL SITE EXISTS.
    //
    // A call-site scan can only find what somebody already wrote. The allowlist is where a vault
    // field would be ADMITTED — `props: { pin_hash: 'string' }` is one line in a declaration, and
    // it makes every future call site legal. Checking it means the rule bites on the day the
    // mistake is made rather than on the day it is used.
    if (!/ANALYTICS_EVENTS\s*=/.test(code)) continue;
    const block = code.slice(code.indexOf('ANALYTICS_EVENTS'));
    for (const m of block.matchAll(/^\s{4}(\w+)\s*:/gm)) {
      declaredProps += 1;
      // THE NAME IS SPLIT INTO WORDS BEFORE IT IS JUDGED.
      //
      // `\bpin\b` does not match inside `pin_hash`, because an underscore is a word character — and
      // snake_case is exactly how analytics props are named. A control injecting `pin_hash` walked
      // straight past a word-boundary test, which is how a check that looks right proves nothing.
      // Splitting on case and separator handles `pin_hash`, `dekId` and `PROFILE_PIN` alike.
      const words = m[1]
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((w) => w.toLowerCase());
      const SENSITIVE = ['pin', 'hash', 'secret', 'token', 'dek', 'key', 'password', 'passphrase', 'vault', 'pii'];
      if (VAULT_VOCABULARY.test(m[1]) || words.some((w) => SENSITIVE.includes(w))) {
        violations.push({
          rule: 5,
          file: r,
          line: block.slice(0, m.index).split('\n').length,
          detail: 'an analytics prop named "' + m[1] + '" is declared — the allowlist is where a vault field would be admitted',
        });
      }
    }
  }

  return {
    rule: 5,
    name: 'no vault type may reach the track() boundary',
    population: callSites + declaredProps,
    note: callSites === 0
      ? 'THE BOUNDARY EXISTS (B6, src/analytics/track.ts) AND NO SURFACE IS INSTRUMENTED YET — instrumenting one is not a P2 criterion. So the rule policed ' + declaredProps + ' declared analytics prop(s) instead of call sites: the allowlist is where a vault field would be ADMITTED, and checking it means the rule bites the day the mistake is made rather than the day it is used. The boundary also refuses any non-primitive prop AT RUNTIME, so a vault object cannot pass through even from a call site nobody linted'
      : callSites + ' track() call site(s) and ' + declaredProps + ' declared prop(s) examined',
    violations,
  };
};

export const RULES = [rule1, rule2, rule3, rule4, rule5];

export const runBoundaryRules = (root) => {
  const results = RULES.map((r) => r(root));
  const violations = results.flatMap((r) => r.violations);
  return { results, violations };
};
