/**
 * GATE: identity-rename — criterion T6.  →  `IDENTITY-RENAME OK`
 *
 *   > **T6.** *"IDENTITY RENAME: the MDC-RENAME values are applied only through identity.json; no
 *   > scattered product-name literal exists; the storage namespace does not follow the rename"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THREE CLAIMS, AND THE THIRD IS THE ONE WITH TEETH
 *
 * A rename is easy to do and easy to do badly. The failure this criterion exists to prevent is not
 * a typo in a display name — it is a rename that reaches a field it was never meant to touch.
 *
 * `identity.json` says it in its own words: the storage namespace is *"the one field a rename does
 * not touch"*, because *"if OD-2 renames the product and this followed, every existing install
 * would open a NEW, EMPTY store and silently lose the user's language, their theme and their
 * onboarding state — with no error, because a fresh store is a valid store."* Clause 3 is that
 * sentence made executable: the namespace must still be the pre-rename value, and it must not have
 * drifted onto the slug, scheme or display name.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT "ONLY THROUGH identity.json" MEANS HERE
 *
 * Two consumers read it and they run in different worlds: `app.config.js` in plain Node before any
 * TypeScript exists, and `src/config/identity.ts` through the bundler. Clause 2 asserts both still
 * READ the file rather than restating its values, so there is one home and not three.
 *
 * The native projects are not a third home. `android/` and `ios/` are generated from
 * `app.config.js` and are not tracked by git — `.gitignore` excludes `android/`. A hand-edited
 * `applicationId` in generated output would be a scattering that survives until the next prebuild
 * wipes it, which is the worst kind: correct today, gone tomorrow, and invisible to review.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SCATTER SCAN READS STRIPPED SOURCE, AND THAT IS NOT LENIENCY
 *
 * A comment naming the thing it documents is the most ordinary sentence there is. P2's
 * identity-config gate met this three times — its own explanation, an RTL rationale, and a
 * deep-link comment — and recorded that *"a check that punishes it pushes a codebase toward
 * deleting its own explanations."* Structure is read from stripped source; prose is not structure.
 *
 * Two allowances are inherited for the same reason they were granted there: the npm scope
 * `@smartcard/...` belongs to the pipeline's package.json and no rename of this product touches it,
 * and the signed pack manifests carry `datasetId: smartcard-canonical-v2`, which is pack identity
 * and not product identity — renaming it would be a DATASET_ID_REFUSED event, not a rename.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE DECLARED CONTROL
 *
 * T6 declares `scattered-literal`: *"add the product name as a literal in one source file"*,
 * expecting *"the identity gate names it"*. Clause 4 is the clause that control fires at, and it
 * names the file and line rather than reporting a count.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fail, okOverPopulation } from '../lib/report.mjs';

export const SENTINEL = 'IDENTITY-RENAME OK';
export const FAILURE_SENTINEL = 'IDENTITY-RENAME FAILED';
export const MEASURES = 'source';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const CAMPAIGN_DIR = join(ROOT, '..', 'smartcard-data-pipeline', 'campaign-master');
const IDENTITY = join(ROOT, 'identity.json');
const APP_CONFIG = join(ROOT, 'app.config.js');
const VIEW = join(ROOT, 'src', 'config', 'identity.ts');
const RULINGS_LIB = join(CAMPAIGN_DIR, 'bin', 'lib', 'rulings.mjs');

/** The value the storage namespace has always had, and the whole point is that it has not moved. */
const PINNED_STORAGE_NAMESPACE = 'smartcard';

/* Inherited from P2's identity-config for the reasons its header records. */
const ALLOWED_FILES = new Set(['src/data/adapter/datasetId.ts']);
const SIGNED_ARTIFACTS = /^src\/data\/adapter\/packs\//;
const NPM_SCOPE = /@smartcard\//;

const rel = (p) => relative(ROOT, p).split('\\').join('/');
const read = (p) => readFileSync(p, 'utf8');

const sourceFiles = () => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p); }
      else if (/\.(ts|tsx|js|jsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  return out;
};

export const run = async () => {
  const problems = [];
  const clauses = [];

  for (const [label, p] of [['identity.json', IDENTITY], ['app.config.js', APP_CONFIG], ['src/config/identity.ts', VIEW]]) {
    if (!existsSync(p)) return fail(`${label} is missing — the identity cannot have one home if that home is absent`);
  }
  const identity = JSON.parse(read(IDENTITY));

  /* 1. THE RENAME HAS OWNER AUTHORITY. Reusing the campaign resolver rather than reimplementing it,
        so this gate and mc.mjs agree by construction. */
  let isRuled = null;
  try { ({ isRuled } = await import(pathToFileURL(RULINGS_LIB).href)); } catch { /* campaign not reachable */ }
  if (isRuled) {
    const verdict = isRuled('MDC-RENAME');
    if (!verdict.ruled) {
      problems.push(`MDC-RENAME does not resolve (${verdict.why}) — identity values may not be applied without it`);
    } else if (String(verdict.ruling).trim() !== '1') {
      problems.push(
        `MDC-RENAME was ruled '${String(verdict.ruling).trim()}', not 1. Option 1 is the one that APPLIES values; `
        + 'this gate checks an applied rename and must not pass over a ruling that authorised something else.',
      );
    } else {
      clauses.push(`MDC-RENAME ruled 1 (${verdict.source || 'rulings'})`);
    }
  } else {
    problems.push('the campaign rulings resolver could not be loaded — a rename cannot be verified against its authority');
  }

  /* 2. ONE HOME. Both consumers must READ identity.json rather than restate its values. */
  const cfg = read(APP_CONFIG);
  if (!/require\(['"]\.\/identity\.json['"]\)/.test(cfg)) {
    problems.push('app.config.js does not require ./identity.json — the Expo config must be built from the one source, not restated');
  }
  if (!/from\s+['"]\.\.\/\.\.\/identity\.json['"]/.test(read(VIEW))) {
    problems.push("src/config/identity.ts does not import ../../identity.json — the app's view must read the same file");
  }
  for (const field of ['displayName', 'slug', 'scheme', 'bundleIdentifier', 'androidPackage', 'storageNamespace']) {
    if (typeof identity[field] !== 'string' || identity[field].length === 0) {
      problems.push(`identity.json has no usable "${field}"`);
    }
  }
  clauses.push('both consumers read identity.json');

  /* 3. THE STORAGE NAMESPACE DID NOT FOLLOW THE RENAME. */
  if (identity.storageNamespace !== PINNED_STORAGE_NAMESPACE) {
    problems.push(
      `storageNamespace is "${identity.storageNamespace}" and must still be "${PINNED_STORAGE_NAMESPACE}". `
      + 'It is the id of the MMKV stores, the Keychain service, the vault export schema and the pack '
      + 'database. If it follows a rename every existing install opens a new, EMPTY store and loses '
      + "the user's language, theme and onboarding state — with no error, because a fresh store is a valid store.",
    );
  }
  for (const field of ['slug', 'scheme', 'displayName']) {
    if (String(identity[field]).toLowerCase() === String(identity.storageNamespace).toLowerCase()) {
      problems.push(`storageNamespace has drifted onto ${field} ("${identity[field]}") — a rename must not reach it`);
    }
  }
  /* The namespace must reach its consumers as a constant, never as a literal.
   *
   * COMMENTS ARE STRIPPED AND STRINGS ARE NOT, and the asymmetry is the point. The first draft of
   * this clause read raw source and fired on vaultExportImport.ts:14 — a comment recording that the
   * value USED to be a literal and is now derived. That is prose, and punishing it is the mistake
   * P2's identity-config met three times. But the full strip is wrong here too: a hardcoded
   * `'smartcard.preferences'` IS a string, and stripping strings would hide the very thing this
   * clause exists to catch. So comments go and strings stay. */
  const stripComments = (text) => {
    const blank = (m) => m.replace(/[^\n]/g, ' ');   // length-preserving, so line numbers stay true
    return text
      .replace(/\/\*[\s\S]*?\*\//g, blank)
      .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, before, comment) => before + blank(comment));
  };
  const namespaceHits = [];
  for (const f of sourceFiles()) {
    if (rel(f) === 'src/config/identity.ts') continue;
    const lines = stripComments(read(f)).split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (new RegExp(`['"\`]${PINNED_STORAGE_NAMESPACE}\\.`).test(lines[i])) namespaceHits.push(`${rel(f)}:${i + 1}`);
    }
  }
  if (namespaceHits.length > 0) {
    problems.push(`the storage namespace appears as a literal at ${namespaceHits.join(', ')} — it must come from STORAGE_NAMESPACE, or a rename silently orphans real user data`);
  }
  clauses.push(`storageNamespace pinned at "${identity.storageNamespace}" and reached only through the constant`);

  /* 4. NO SCATTERED PRODUCT-NAME LITERAL. This is where the declared control fires. */
  const values = Object.entries(identity)
    .filter(([k, v]) => !k.startsWith('$')
      && typeof v === 'string'
      && v.length >= 4
      && !['version', 'iosBuildNumber', 'storageNamespace'].includes(k))
    .map(([field, value]) => ({ field, value }));
  if (values.length === 0) return fail('identity.json declares no distinctive values — an empty source is not one place, it is none');

  const files = sourceFiles();
  if (files.length === 0) return fail('scanned 0 source files — an empty population proves nothing');

  let scattered = 0;
  for (const f of files) {
    const r = rel(f);
    if (ALLOWED_FILES.has(r) || SIGNED_ARTIFACTS.test(r) || r === 'src/config/identity.ts') continue;
    /* COMMENTS ONLY, NEVER STRINGS. A scattered product name IS a string literal, so stripping
       strings blanks the very thing being hunted. T6's declared `scattered-literal` control proved
       it: the first draft used the full strip, the control added `const LEAK = "TREVIK";` to a
       screen, and this gate still reported OK. A clause that cannot fail is worse than no clause. */
    const raw = read(f);
    const stripped = stripComments(raw);
    for (const { field, value } of values) {
      if (!raw.includes(value)) continue;
      /* The npm scope is a package name owned by the pipeline's package.json; renaming this
         product changes nothing about it. */
      const lines = raw.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        if (!lines[i].includes(value)) continue;
        if (NPM_SCOPE.test(lines[i])) continue;
        /* Prose is not structure — only report a value the stripped source still carries. */
        const strippedLine = stripped.split(/\r?\n/)[i] || '';
        if (!strippedLine.includes(value)) continue;
        problems.push(`${r}:${i + 1} carries the ${field} "${value}" as a literal — identity belongs in identity.json alone`);
        scattered += 1;
      }
    }
  }
  clauses.push(`${files.length} source files scanned for ${values.length} identity values, ${scattered} scattered`);

  if (problems.length > 0) return fail(problems.join('; '), { population: files.length });
  return okOverPopulation({
    population: files.length,
    unit: 'source file(s) scanned for scattered identity',
    detail: clauses.join(' · '),
  });
};
