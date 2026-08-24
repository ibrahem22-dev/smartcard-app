/**
 * GATE: identity-config — criterion A10.  →  `IDENTITY-CONFIG OK — 1 source`
 *
 *   > **A10.** *"App identifier, bundle id, display name and asset references are configurable in
 *   > **one** place (OD-2 rider)."*
 *
 *   > **OD-2.** *"Final public branding · DEFERRED… Requirement so the deferral stays free: keep
 *   > app identifier, bundle id, display name and asset references configurable in one place from
 *   > P2 onward. The existing app uses `com.smartcard.app` — acceptable as a working value; **do
 *   > not scatter the string through source**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CHECK IS "HOW MANY PLACES", DERIVED
 *
 * Not "does a config file exist" — one existing beside four hardcoded copies is worse than none,
 * because it looks like the problem is solved. So the gate takes each identity VALUE out of
 * `identity.json` and counts where else it appears in the tree.
 *
 * That is why it can fail: it does not look for a pattern somebody might write, it looks for the
 * actual strings. `com.smartcard.app` in a second file is found whatever the file is called and
 * whatever the variable around it is named.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS ALLOWED TO CONTAIN THE NAME, and why each is not a scattering
 *
 *   · `identity.json`      — the source.
 *   · `app.config.js`      — reads it. Expo's loader runs in plain Node before TypeScript exists,
 *                            so this is the only way one file can serve both worlds.
 *   · `src/config/identity.ts` — the app's view, importing the same JSON.
 *   · `package.json`       — npm's own `name` field, which is not the product's display name and
 *                            cannot be, since npm names are lowercase and slug-shaped.
 *   · `src/i18n/*.ts`      — sentences containing `{{app}}`, never the name itself. The gate checks
 *                            that: a translation with the literal name embedded is a scattering
 *                            wearing a translation's clothes.
 *
 * A STATIC `app.json` IS ITSELF A SCATTERING, which is why the gate fails if one exists. It used to
 * hold the display name, slug, scheme, bundle identifier and Android package as literals.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['A10'];
export const SENTINEL = 'IDENTITY-CONFIG OK — 1 source';

const SOURCE = 'identity.json';
const EXPO_CONFIG = 'app.config.js';
const VIEW = 'src/config/identity.ts';

/** Files permitted to contain an identity value, and why. */
const PERMITTED = new Map([
  [SOURCE, 'the source'],
  [EXPO_CONFIG, "reads the source; Expo's loader runs before TypeScript exists"],
  [VIEW, "the app's view of the same file"],
  ['package.json', "npm's own name field — lowercase and slug-shaped, not the display name"],
  ['src/data/adapter/datasetId.ts',
    "the ESTATE's id, owned by the pipeline and stamped into every signed manifest. C5 requires it "
    + 'compiled in. Renaming the product would not rename it, and chasing it during a rename would '
    + 'break every signature at once'],
]);

/**
 * The app's version has two homes and they must agree.
 *
 * `identity.json` is the one `app.config.js` builds the Expo config from — the number that reaches
 * a store listing and a device. `package.json` carries npm's own field. They disagreed: 1.0.0 and
 * 0.1.0, and the lower one was below every shipped pack's `minAppVersion`, so the app would have
 * refused every pack it carries. Nothing compared them until this check.
 */
const VERSIONED = ['identity.json', 'package.json'];

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== 'node_modules') walk(p, acc); }
    else if (/\.(ts|tsx|js|jsx|json)$/.test(e)) acc.push(p);
  }
  return acc;
};

/**
 * A COMMENT IS NOT A SCATTERING — the third time this campaign has met this exact shape.
 *
 * D3's symbol check fired on the comments explaining its own removal. The RTL scan reported the
 * sentence saying why a component avoids a hardcoded row direction. And this gate reported
 *
 *     // Supports deep link: smartcard://purchase?amount=500&category=grocery
 *
 * as the product slug scattered into source. Documentation that names the thing it documents is
 * the most ordinary sentence there is, and a check that punishes it pushes a codebase toward
 * deleting its own explanations.
 */
/**
 * LENGTH-PRESERVING, so the line numbers stay true.
 *
 * The ordinary version replaces a comment with a single space, which shifts every offset after it —
 * and this gate reported `src/security/keyVault.ts:258` for a string that is nowhere near line 258.
 * A finding that points at the wrong line is worse than no finding: somebody opens the file, sees
 * unrelated code, and concludes the gate is noise.
 *
 * Newlines are kept and everything else becomes a space, so offsets and line counts are unchanged.
 */
const blank = (text) => text.replace(/[^\n]/g, ' ');
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, before, comment) => before + blank(comment));

/**
 * A PACKAGE NAME IS NOT THE PRODUCT SLUG — the fourth time this campaign has met a string that is
 * spelled like the fact and is a different fact.
 *
 * `src/data/adapter/index.ts` imports `@smartcard/data-authority-adapter`, and this gate read the
 * npm scope as the slug scattered into source. It is not. The scope is part of a package name owned
 * by the PIPELINE repository's `package.json`; renaming this product changes nothing about it, and
 * "read it from src/config/identity.ts" is advice that would break the import if anybody took it.
 *
 * OD-2's subject is the strings a RENAME MUST CHASE. A dependency's name is not one of them.
 *
 * The exemption is deliberately narrow: only a BARE specifier — a package name — is blanked. A
 * relative path is still scanned, because `./smartcard-config` really would have to be renamed, and
 * so is every other string in the file including one on the same line as an import. The negative
 * controls prove all three.
 */
const blankBareSpecifiers = (src) => src.replace(
  /(\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\2/g,
  (whole, keyword, quote, spec) =>
    (spec.startsWith('.') || spec.startsWith('/') ? whole : keyword + quote + blank(spec) + quote),
);

/**
 * OD-2's SUBJECT IS A STRING — *"do not scatter the string through source"*.
 *
 * After the specifier fix the gate still reported `src/data/adapter/index.ts:55`, which reads
 *
 *     adapterVersion: adapterPackage.smartcard.adapterVersion,
 *
 * — a PROPERTY NAME in the adapter package's own metadata block. Renaming this product does not
 * rename a key defined by another repository's `package.json`, and `identity.json` says outright
 * that the storage namespace *"must never follow a rename"*, so a key spelled like the slug is
 * exactly the thing not to chase.
 *
 * So a match counts only where the value appears INSIDE A STRING LITERAL. That is where a rename
 * has to reach: a display name in a biometric prompt, a bundle id, a scheme in a deep link. An
 * identifier is code, and code is renamed by a compiler that will not stay silent.
 *
 * Everything outside a string body becomes a space, newlines kept, so the reported line stays true.
 */
const keepOnlyStringLiterals = (src) => {
  const out = new Array(src.length);
  let quote = null;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '\n') { out[i] = ch; if (quote !== '`') quote = null; continue; }
    if (quote) {
      if (ch === String.fromCharCode(92)) { out[i] = ' '; out[i + 1] = ' '; i += 1; continue; }
      if (ch === quote) { quote = null; out[i] = ' '; continue; }
      out[i] = ch;
      continue;
    }
    out[i] = ' ';
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
  }
  return out.join('');
};

const lineAt = (code, i) => code.slice(0, i).split('\n').length;

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, SOURCE))) {
    return fail(SOURCE + ' does not exist. A10 asks for ONE place, and a gate that passed without '
      + 'one would be counting to one from zero');
  }
  if (existsSync(join(root, 'app.json'))) {
    problems.push('app.json still exists. A static Expo config holds the display name, slug, scheme '
      + 'and bundle identifier as literals — it is one of the places OD-2 says not to scatter them '
      + 'to. ' + EXPO_CONFIG + ' builds the same config from ' + SOURCE);
  }
  for (const rel of [EXPO_CONFIG, VIEW]) {
    if (!existsSync(join(root, rel))) problems.push(rel + ' is missing — ' + PERMITTED.get(rel));
  }

  const identity = JSON.parse(readFileSync(join(root, SOURCE), 'utf8'));

  /**
   * A SEMVER IS NOT A DISTINCTIVE STRING, and searching for one finds coincidences.
   *
   * `identity.version` is `1.1.0`, and so is the adapter build this app pins — two unrelated facts
   * that happen to spell the same five characters. Reporting `PINNED_ADAPTER.adapterVersion` as the
   * product version scattered into source would be advice that, followed, would break the pin.
   *
   * The version is not left unchecked: it has two homes, `identity.json` and `package.json`, and
   * the check above compares them. That is the defect that actually existed — they disagreed, and
   * the lower one was below every shipped pack's `minAppVersion`.
   */
  const NOT_DISTINCTIVE = new Set(['version']);

  // The values A10 names, derived from the source rather than listed here.
  const values = Object.entries(identity)
    .filter(([k, v]) => !k.startsWith('$') && typeof v === 'string' && v.length >= 4 && !NOT_DISTINCTIVE.has(k))
    .map(([k, v]) => ({ field: k, value: v }));
  if (values.length === 0) {
    return fail(SOURCE + ' declares no identity values — an empty source is not one place, it is none');
  }

  // A10 names four things. Each must actually be in the source.
  for (const required of ['displayName', 'bundleIdentifier', 'androidPackage']) {
    if (!identity[required]) problems.push(SOURCE + ' has no "' + required + '" — A10 names it');
  }
  if (!identity.assets || Object.keys(identity.assets).filter((k) => !k.startsWith('$')).length === 0) {
    problems.push(SOURCE + ' declares no asset references — A10 names them alongside the identifiers');
  }

  // ── where else does each value appear? ───────────────────────────────────────────
  const files = walk(root + '/src').concat(
    ['app.config.js', 'package.json', 'identity.json', 'tailwind.config.js', 'jest.config.cjs']
      .map((f) => join(root, f)).filter((p) => existsSync(p)),
  );
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');

  /**
   * THE SHIPPED PACKS ARE SIGNED ARTIFACTS, AND A RENAME MUST NOT REACH THEM.
   *
   * Every manifest under `src/data/adapter/packs/**` carries `datasetId: smartcard-canonical-v2`,
   * and the detached envelope beside it signs that manifest's sha. Editing one to chase OD-2 would
   * break its signature and the app would refuse the pack — the gate would have been telling
   * somebody to do the one thing guaranteed to stop the app reading its own data.
   *
   * They are also not source. They are bytes the pipeline built, copied byte for byte and compared
   * in both directions by `p2-pack-shas.mjs --check`, which is the check that owns them.
   */
  const SIGNED_ARTIFACTS = /^src\/data\/adapter\/packs\//;

  const scatter = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    if (PERMITTED.has(rel) || SIGNED_ARTIFACTS.test(rel)) continue;
    // JSON carries no comments, so stripping is only meaningful for source files.
    const raw = readFileSync(abs, 'utf8');
    const src = rel.endsWith('.json') ? raw : keepOnlyStringLiterals(blankBareSpecifiers(stripComments(raw)));
    for (const { field, value } of values) {
      let i = src.indexOf(value);
      while (i !== -1) {
        scatter.push({ file: rel, line: lineAt(src, i), field, value });
        break;
      }
    }
  }

  for (const s of scatter.slice(0, 6)) {
    problems.push(s.file + ':' + s.line + ' contains the ' + s.field + ' "' + s.value + '" — OD-2: '
      + 'do not scatter the string through source. Read it from ' + VIEW);
  }
  if (scatter.length > 6) problems.push('… and ' + (scatter.length - 6) + ' more site(s)');

  // ── the version, in both of its homes ────────────────────────────────────────────
  const versions = VERSIONED.map((f) => ({
    file: f,
    version: existsSync(join(root, f)) ? JSON.parse(readFileSync(join(root, f), 'utf8')).version : null,
  }));
  const distinct = new Set(versions.map((v) => v.version).filter(Boolean));
  if (distinct.size > 1) {
    problems.push('the app version has two homes and they disagree: '
      + versions.map((v) => v.file + ' says ' + v.version).join(' · ')
      + '. One of them reaches a device and a store listing, and the other is read by anybody '
      + 'debugging a build. A pack manifest carries a minAppVersion the adapter enforces at load, '
      + 'so the lower number is not cosmetic — it decides whether the app can open what it ships');
  }
  if (distinct.size === 0) problems.push('neither ' + VERSIONED.join(' nor ') + ' declares a version');

  lines.push('version         ' + [...distinct].join(' / ') + ' · agreed across ' + versions.length + ' file(s)');
  lines.push('source          ' + SOURCE + ' · ' + values.length + ' identity value(s)');
  for (const { field, value } of values) lines.push('  ' + field.padEnd(20) + value);
  lines.push('');
  lines.push('consumers       ' + [...PERMITTED.keys()].filter((f) => existsSync(join(root, f))).join(', '));
  lines.push('population      ' + files.length + ' file(s) searched for the values themselves · found '
    + scatter.length + ' outside the permitted set');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
