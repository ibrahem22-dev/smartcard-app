/**
 * GATE: accessibility-labels — criterion R4.  →  `ACCESSIBILITY-LABELS OK`
 *
 *   > **R4.** *"Tiles, chips, dots and markers carry screen-reader labels in all three languages,
 *   > and every rendered image takes its alt text from the media resolver's `altTextKey` rather than
 *   > a literal."*
 *
 * MEASURES: 'source'. `dependsOn` is `app:src` and `app:src/i18n`, and the second half is the point:
 * this criterion is only half about the screens. A label is not "in three languages" because a
 * screen sets one — it is in three languages when the key it names resolves in all three catalogues.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "IN ALL THREE LANGUAGES" IS THE CLAUSE THAT DOES THE WORK
 *
 * The shallow reading of R4 is "every tile has an accessibilityLabel", and a gate written to that
 * reading passes today. It would also pass on a label that speaks Hebrew to an Arabic reader, which
 * is the failure R4 names and the one A7 already found shipping in an engine reason.
 *
 * This app keys its catalogues by Hebrew source string — `t('סיכון')` — and `t()` returns that
 * source when a translation is missing. That is correct at runtime and invisible to a test: the
 * label is present, non-empty, and wrong. So every key a label names is resolved against `ar.ts`
 * and `en.ts` here, using P2's own catalogue reader.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND A TRANSLATED LABEL CAN STILL CARRY AN UNTRANSLATED WORD
 *
 * The subtler half. A label built as
 *
 *     accessibilityLabel={`${t('סיכון')}: ${level}`}
 *
 * passes every check about keys, because `t('סיכון')` resolves in all three. But `level` is an
 * enum — `safe`, `caution`, `high`, `critical`, `unknown` — interpolated raw, so an Arabic reader
 * hears an Arabic word, a colon, and an English one. The screen-reader label is the ONLY way that
 * reader gets the risk level at all, which makes this worse than a visible string: there is no
 * second channel to fall back on.
 *
 * So every interpolation inside a label must itself be translated, a formatted parameter, or a
 * proper noun that has no translation. A bare identifier is none of those.
 *
 * NEGATIVE CONTROL: interpolate an untranslated enum into a label, or drop a key from `ar.ts`, and
 * watch this fail. Both are exercised below in the sense that matters — the gate found the first
 * one live, in two files, before this criterion was recorded.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readTranslationKeys } from '../../p2/lib/i18n-audit.mjs';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['R4'];
export const SENTINEL = 'ACCESSIBILITY-LABELS OK';
export const MEASURES = 'source';

/** The surfaces P5 built, plus the shared components P5 renders its tiles and chips through. */
const SURFACE_DIRS = [
  'src/screens/cardDna',
  'src/screens/wallet',
  'src/screens/plan',
  'src/screens/calendar',
  'src/screens/home',
];
const SHARED = ['src/components/CardTile.tsx', 'src/components/ProvenanceChip.tsx'];

/**
 * THE FOUR KINDS R4 NAMES, AND WHERE EACH ONE LIVES.
 *
 * Declared rather than discovered by substring, because R3 already paid for the alternative: its
 * needle for the calendar risk marker was `marker-risk`, the testID is built as
 * `...-marker-${marker.kind}`, and the literal never appears — so the carrier sat outside the sweep
 * while the gate printed OK. A testID grep looks like derivation and is not.
 *
 * Each kind must be LOCATED. A declaration that matches nothing is stale, and a gate covering three
 * of the four kinds R4 names is measuring less than it claims while still saying OK.
 */
const KINDS = [
  { kind: 'tile', where: 'src/components/CardTile.tsx' },
  { kind: 'chip', where: 'src/components/ProvenanceChip.tsx' },
  { kind: 'dot', where: 'src/screens/home/HomeRiskStrip.tsx' },
  { kind: 'marker', where: 'src/screens/calendar/DayMarkers.tsx' },
];

/**
 * AN INTERPOLATION THAT IS ALREADY TRANSLATED, AND ONE THAT ONLY LOOKS IT.
 *
 * The first version allowed a `t(` call and a short list of name-like identifiers, and flagged
 * ProvenanceChip for interpolating `label` and `stale`:
 *
 *     const label = t(CHIP_LABEL[view.chip]);
 *     const stale = t(CHIP_STALE_LABEL);
 *     accessibilityLabel={view.stale ? \`\${label} · \${stale}\` : label}
 *
 * Both are translated; the translation just happened on an earlier line. Reading only the label
 * expression cannot tell that apart from `\${level}`, so the file is read for the names it binds to a
 * `t()` call and those names are treated as translated — which is what they are.
 *
 * `level` survives this, correctly: it is bound to `marker.level ?? 'unknown'`, an enum, and no
 * amount of surrounding context makes an enum a sentence anybody can hear in their own language.
 */
const NAMES_WITHOUT_TRANSLATION = /^(visibleName|name|displayName)$/;

/** Every identifier in a file that is bound to a t() call. */
const translatedIdents = (src) => {
  const out = new Set();
  for (const m of src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*[^;\n]*\bt\(/g)) {
    out.add(m[1]);
  }
  return out;
};

const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const walk = (abs, acc = []) => {
  if (!existsSync(abs)) return acc;
  for (const entry of readdirSync(abs)) {
    const p = join(abs, entry);
    if (statSync(p).isDirectory()) { if (entry !== '__tests__') walk(p, acc); }
    else if (/\.tsx$/.test(entry)) acc.push(p);
  }
  return acc;
};

/** Read `accessibilityLabel={ ... }` with balanced braces, so a template literal survives intact. */
const labelExpressions = (src) => {
  const out = [];
  const NEEDLE = 'accessibilityLabel={';
  let i = src.indexOf(NEEDLE);
  while (i >= 0) {
    let depth = 1;
    let j = i + NEEDLE.length;
    while (j < src.length && depth > 0) {
      const ch = src[j];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      j += 1;
    }
    out.push({ expr: src.slice(i + NEEDLE.length, j - 1), line: src.slice(0, i).split('\n').length });
    i = src.indexOf(NEEDLE, j);
  }
  return out;
};

/**
 * EVERY KEY A LABEL NAMES — INCLUDING THE ONES IT DOES NOT SPELL OUT.
 *
 * The first version read only `t('literal')`. That was enough until R4's own fix changed a label to
 *
 *     accessibilityLabel={\`\${t('סיכון')}: \${t(presentation.labelKey)}\`}
 *
 * and the level keys left the gate's sight entirely. Deleting 'סיכון גבוה' from ar.ts then left R4
 * GREEN — the three-language clause, the whole reason this criterion is not "every tile has a
 * label", had become vacuous, and it was the fix for the OTHER clause that did it.
 *
 * So an indirect key is followed: `t(x.labelKey)` resolves to every literal this codebase assigns to
 * a `labelKey` property, and all of them are checked. Over-approximating is the safe direction —
 * it checks keys that might not reach this label, never the reverse.
 *
 * And a key that CANNOT be resolved fails rather than being skipped. A gate that quietly drops what
 * it cannot read is how the vacuous pass gets in; it must say so instead.
 */
const HEBREW = /[\u0590-\u05FF]/;

/*
 * WHERE AN INDIRECT KEY'S VALUES LIVE — DECLARED, BECAUSE GUESSING GOT IT WRONG.
 *
 * The first attempt collected literals from every property named `*Key`. That found labelKey and
 * missed altTextKey entirely, because the alt-text vocabulary is an ALT object whose properties are
 * called cardGeneric and benefitGeneric — the *Key name is on the field that READS them, not on the
 * fields that hold them.
 *
 * So each indirect key names the module its vocabulary lives in, and every Hebrew literal in that
 * module is a candidate value. Over-approximating is the safe direction: it can check a key that
 * never reaches this label, never the reverse. A source that yields nothing FAILS — an empty
 * vocabulary would make the clause vacuous exactly where it is meant to bite.
 */
const INDIRECT_KEY_SOURCES = [
  { property: 'labelKey', from: 'src/theme/riskPresentation.ts' },
  { property: 'altTextKey', from: 'src/media/resolveMedia.ts' },
];

const KEY_PROPERTY_VALUES = (root, problems) => {
  const byProp = new Map();
  for (const { property, from } of INDIRECT_KEY_SOURCES) {
    const abs = join(root, from);
    if (!existsSync(abs)) {
      problems.push(from + ' does not exist, and it is where the values of ' + property + ' live — so a label '
        + 'naming that key could not be checked in any language');
      continue;
    }
    const values = new Set();
    for (const m of readFileSync(abs, 'utf8').matchAll(/'((?:\\'|[^'\n])*)'/g)) {
      const text = m[1].replace(/\\'/g, "'");
      if (HEBREW.test(text)) values.add(text);
    }
    if (values.size === 0) {
      problems.push(from + ' defines no Hebrew key literal, so ' + property + ' would resolve to an empty '
        + 'vocabulary and every label naming it would pass without being checked');
      continue;
    }
    byProp.set(property, values);
  }
  return byProp;
};

/** Every t() argument in one expression, as {key} when literal or {via, keys} when followed. */
const keysIn = (expr, keyProps) => {
  const out = [];
  for (const m of expr.matchAll(/\bt\(\s*([^,)]+)/g)) {
    const arg = m[1].trim();
    const literal = arg.match(/^'((?:\\'|[^'])*)'$/);
    if (literal) { out.push({ key: literal[1].replace(/\\'/g, "'"), via: null }); continue; }
    const prop = arg.match(/\.([A-Za-z_$][\w$]*)$/);
    const values = prop ? keyProps.get(prop[1]) : null;
    if (values && values.size) {
      for (const key of values) out.push({ key, via: arg });
    } else {
      out.push({ key: null, via: arg });
    }
  }
  return out;
};

/** Every `${...}` interpolation inside a template literal, at brace depth 1. */
const interpolationsIn = (expr) => {
  const out = [];
  let i = expr.indexOf('${');
  while (i >= 0) {
    let depth = 1;
    let j = i + 2;
    while (j < expr.length && depth > 0) {
      if (expr[j] === '{') depth += 1;
      else if (expr[j] === '}') depth -= 1;
      j += 1;
    }
    out.push(expr.slice(i + 2, j - 1).trim());
    i = expr.indexOf('${', j);
  }
  return out;
};

export const run = async ({ root }) => {
  const problems = [];

  /* ── the catalogues, read rather than assumed ─────────────────────────────────────────── */
  let ar, en;
  try {
    ar = readTranslationKeys(root, 'ar');
    en = readTranslationKeys(root, 'en');
  } catch (e) {
    return fail('could not read the ar/en catalogues out of src/i18n — R4 is half about src/i18n, and '
      + 'a gate that cannot open them would be checking that labels exist rather than that they speak: ' + String(e.message ?? e));
  }
  if (ar.size === 0 || en.size === 0) {
    return fail('an i18n catalogue parsed to zero entries (ar ' + ar.size + ', en ' + en.size + ') — every key '
      + 'would then resolve as missing or as present by accident, and this gate would be reporting on its own parser');
  }

  const files = [
    ...SURFACE_DIRS.flatMap((d) => walk(join(root, d))),
    ...SHARED.map((f) => join(root, f)).filter((f) => existsSync(f)),
  ];
  if (files.length === 0) {
    return fail('no P5 surface files found — a label sweep over zero files is the vacuous pass §2 rule 5 refuses');
  }

  /* Literal values of every *Key property this codebase defines, so an indirect key can be followed. */
  const keyProps = KEY_PROPERTY_VALUES(root, problems);

  /* ── 1. each kind R4 names must be located ────────────────────────────────────────────── */
  for (const k of KINDS) {
    const abs = join(root, k.where);
    if (!existsSync(abs)) {
      problems.push('R4 names ' + k.kind + 's, and ' + k.where + ' — where P5 renders them — does not exist');
      continue;
    }
    if (labelExpressions(stripComments(readFileSync(abs, 'utf8'))).length === 0) {
      problems.push(k.where + ' renders the ' + k.kind + ' R4 names and sets no accessibilityLabel at all');
    }
  }

  /* ── 2 & 3. every key resolves in three languages; every interpolation is translated ──── */
  let labelsChecked = 0;
  let keysChecked = 0;
  const missing = [];

  for (const abs of files) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    const translated = translatedIdents(src);

    for (const { expr, line } of labelExpressions(src)) {
      labelsChecked += 1;

      for (const { key, via } of keysIn(expr, keyProps)) {
        if (key === null) {
          problems.push(
            rel + ':' + line + ' names its key as `' + via + '`, which this gate cannot resolve to any '
              + 'literal, so it cannot tell whether it resolves in three languages. A key it cannot read is '
              + 'a key it must not silently skip — that is how a clause stops being able to fail',
          );
          continue;
        }
        keysChecked += 1;
        const gaps = [];
        if (!ar.has(key)) gaps.push('ar');
        if (!en.has(key)) gaps.push('en');
        if (gaps.length) missing.push({ rel, line, key, gaps, via });
      }

      /* An interpolation that is not itself translated is a word heard in the wrong language. */
      for (const piece of interpolationsIn(expr)) {
        if (/\bt\(/.test(piece)) continue;
        if (NAMES_WITHOUT_TRANSLATION.test(piece)) continue;
        if (translated.has(piece)) continue;
        /* A ternary or member access whose parts are all translated is translated. */
        const idents = [...piece.matchAll(/[A-Za-z_$][\w$]*/g)].map((m) => m[0]);
        if (idents.length > 0 && idents.every((id) => translated.has(id) || NAMES_WITHOUT_TRANSLATION.test(id))) continue;
        problems.push(
          rel + ':' + line + ' interpolates `' + piece + '` into a screen-reader label without translating it. '
            + 'The label around it resolves in all three languages and this does not, so a reader in Arabic or '
            + 'English hears their own language and then an untranslated token. For a dot or a marker the label '
            + 'is the ONLY channel carrying the state, so there is nothing to fall back on',
        );
      }
    }
  }

  for (const m of missing.slice(0, 8)) {
    problems.push(
      m.rel + ':' + m.line + ' labels with a key missing from ' + m.gaps.join(' and ') + ': "' + m.key + '"'
        + (m.via ? ' (reached through ' + m.via + ')' : '') + '. '
        + 't() returns the Hebrew source when a translation is missing, so this label is present, non-empty '
        + 'and in the wrong language — which no test can see',
    );
  }
  if (missing.length > 8) problems.push('…and ' + (missing.length - 8) + ' more untranslated label key(s)');

  /* ── 4. an image's alt text comes from the resolver, never a literal ───────────────────── */
  let altSites = 0;
  for (const abs of files) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));
    if (!/altTextKey/.test(src)) continue;
    for (const { expr, line } of labelExpressions(src)) {
      if (!/altTextKey/.test(expr)) continue;
      altSites += 1;
      if (!/\bt\(\s*[A-Za-z_$][\w$.]*altTextKey/.test(expr)) {
        problems.push(
          rel + ':' + line + " reaches for altTextKey but does not pass it through t(). MEDIA_ARCHITECTURE.md "
            + 'says altTextKey is an i18n key and never a literal, so rendering it directly would speak a Hebrew '
            + 'source string to every reader',
        );
      }
    }
  }
  if (altSites === 0) {
    problems.push('no rendered image takes its alt text from altTextKey anywhere in P5\'s surfaces — R4\'s '
      + 'second half would then be asserting nothing, and CardTile demonstrably does this, so zero means '
      + 'the sweep is not reaching it');
  }

  if (labelsChecked === 0) {
    return fail('no accessibilityLabel found on any P5 surface — R4 would be asserting nothing about the '
      + 'clause it exists for (§2 rule 5)');
  }
  if (keysChecked === 0) {
    return fail('no label names a t() key across ' + labelsChecked + ' label(s) — the three-language clause '
      + 'would then be measuring nothing while still able to print OK');
  }
  if (problems.length) return fail(problems.join(' · '));

  return ok(SENTINEL, [
    'CRITERION R4 — screen-reader labels, over ' + files.length + ' file(s) carrying P5\'s surfaces.',
    labelsChecked + ' accessibilityLabel(s) read, naming ' + keysChecked + ' translation key(s), every one of them',
    '  resolved against ar.ts and en.ts (' + ar.size + ' ar / ' + en.size + ' en keys) with the KEY reader added',
    '  to tools/p2/lib for this: the pair reader beside it needs a quoted key AND a quoted value, and this',
    '  app writes 160 of en.ts\'s entries as references and some keys unquoted, since Hebrew letters are',
    '  legal identifier characters. Read with the wrong one, R4 called five correctly translated labels',
    '  untranslated.',
    '  This app keys its catalogues by HEBREW SOURCE STRING and t() returns that source when a',
    '  translation is missing, so an untranslated label is present, non-empty and wrong — which is',
    '  exactly what no render test can see, and why R4 depends on src/i18n and not only on the screens.',
    'Indirect keys are followed, not skipped: a label naming t(x.labelKey) is checked against every',
    '  literal this codebase assigns to a *Key property, and a key that cannot be resolved FAILS rather',
    '  than passing quietly. That clause was vacuous once already — the fix for the interpolation rule',
    '  below moved the risk-level keys out of sight, and deleting one from ar.ts left this gate green.',
    'Every interpolation inside a label is itself translated. A label reading `${t(\'סיכון\')}: ${level}`',
    '  passes every check about keys and still speaks an English enum to an Arabic reader; for a dot or',
    '  a marker that label is the ONLY channel carrying the state, so there is no second one to fall',
    '  back on. This gate found that live, in two files, before R4 was recorded.',
    altSites + ' image alt text(s) taken from the media resolver\'s altTextKey through t(), never a literal.',
    'All four kinds R4 names — tile, chip, dot, marker — were LOCATED, not assumed: R3 already paid for',
    '  a testID substring that never matched, and a sweep covering three of four still prints OK.',
  ].join('\n'));
};
