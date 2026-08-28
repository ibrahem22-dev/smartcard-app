/**
 * GATE: override-write — criterion N3.  →  `OVERRIDE-WRITE OK`
 *
 *   > **N3.** *"The pencil switches the row to 'Your value' and writes to the override layer through
 *   > the adapter and the store; no component holds a local copy and no path writes a raw dataset
 *   > value."*
 *
 * MEASURES: 'render'. Two of the three clauses are about what reaches the screen — the row becoming
 * *"Your value"*, and the user's number replacing the catalog's. The third — *no component holds a
 * local copy* — is a source claim, and it is the one that cannot be tested by rendering: a component
 * that persists correctly AND keeps a `useState` copy renders identically to one that does not,
 * right up until the two disagree.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * N3 IS THREE PROHIBITIONS WEARING ONE SENTENCE
 *
 *   1. **Through the adapter.** The value the row shows comes from the merge P2 built —
 *      `resolveValue` in `src/store/storeAdapter.ts`, where `CHIP_PRECEDENCE` decides. A second
 *      comparison written anywhere else is a second precedence rule, and contract §2.2's warning
 *      about two enums applies to it exactly.
 *   2. **Through the store.** Persistence goes to the profile-scoped encrypted vault under a key
 *      from `MMKV_KEYS`. *"Import from here — never use raw string literals elsewhere."*
 *   3. **No local copy.** The component renders what the resolver returns. A `useState` holding a
 *      cost value is the local copy N3 names, and it is how a screen ends up showing a number that
 *      is no longer in the vault it came from.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CHIP IS NOT A CHOICE THE WRITER GETS TO MAKE
 *
 * §25: *"USER REPORT → Your value"*, and *"'USER REPORT' is a community concept that does not exist
 * in this product."* A value the user typed is theirs. Writing it as `VERIFIED` would dress a
 * user's guess as an issuer's terms; writing it as `ESTIMATE` would tell somebody their own figure
 * is the app's approximation. So the writer stores `USER` and this gate refuses any other chip
 * reaching the write path.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE ONE PLACE N2 AND N3 MEET, AND IT IS EASY TO GET BACKWARDS
 *
 * N2 says a fee of 0 renders *"Add this"*, because `card.types.ts` cannot tell a free card from an
 * unknown one and `₪0` would be a fake number. N3 changes that in exactly one case: **a zero the
 * USER asserted is a known fact**, because somebody stated it. Same digit, opposite meaning, and
 * the difference is entirely in who said it.
 *
 * A gate that only checked "zero renders Add this" would forbid the user from ever recording a free
 * card. A gate that only checked "an override renders" would let the catalog's ambiguous zero back
 * in through the front door. Both cases are required BY NAME, in both suites, so neither clause can
 * be satisfied by quietly dropping the other.
 *
 * NEGATIVE CONTROL: write an override and have the row keep rendering the catalog value.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N3'];
export const SENTINEL = 'OVERRIDE-WRITE OK';
export const MEASURES = 'render';

const OVERRIDES = 'src/store/cardOverrides.ts';
const RESOLUTION = 'src/store/cardCostResolution.ts';
const SECTION = 'src/screens/cardDna/SectionACosts.tsx';
const ADAPTER = 'src/store/storeAdapter.ts';
const KEYS = 'src/store/keys.ts';
const STORE_SUITE = 'src/store/__tests__/cardOverrides.test.ts';
const RENDER_SUITE = 'src/screens/cardDna/__tests__/cardDnaOverride.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const STORE_CASES = [
  'writes an override that reads back through the adapter',
  'stores a user value as USER and never as VERIFIED or ESTIMATE',
  'lets the user assert a zero, which is a known value and not a missing one',
  'derives every key from one scheme, so a read and a write cannot disagree',
  'clears an override and falls back to the catalog value',
];

const RENDER_CASES = [
  'renders Your value on a row the user has overridden',
  'renders the user number instead of the catalog number after an override',
  'opens the editor from the pencil on a known row',
  'opens the same editor from Add this on an unknown row',
  'renders a user-asserted zero as a value and not as Add this',
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const projectConfig = (root, displayName, suite) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const project = projects.find((p) => p && p.displayName === displayName);
  if (!project) return { error: JEST_CONFIG + ' has no "' + displayName + '" project' };
  return { config: { ...project, rootDir: root, testMatch: ['**/' + suite] } };
};

export const run = async ({ root }) => {
  for (const rel of [OVERRIDES, RESOLUTION, SECTION, ADAPTER, KEYS, STORE_SUITE, RENDER_SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — N3 has nothing to be about');
  }

  const overridesSrc = stripComments(readFileSync(join(root, OVERRIDES), 'utf8'));
  const resolutionSrc = stripComments(readFileSync(join(root, RESOLUTION), 'utf8'));
  const sectionSrc = stripComments(readFileSync(join(root, SECTION), 'utf8'));
  const keysSrc = readFileSync(join(root, KEYS), 'utf8');
  const problems = [];

  /* 1. THROUGH THE STORE — a key from MMKV_KEYS, never a literal at the call site. */
  if (!/profileCardOverrides/.test(keysSrc)) {
    problems.push(KEYS + ' declares no card-override key. §keys.ts: "Import from here — never use raw string literals elsewhere"');
  }
  if (!/MMKV_KEYS/.test(overridesSrc)) {
    problems.push(OVERRIDES + ' does not use MMKV_KEYS — a persisted key spelled at the call site is the raw literal keys.ts exists to prevent');
  }
  for (const m of overridesSrc.matchAll(/['"`]profile_\$\{[^}]*\}:[^'"`]*['"`]/g)) {
    problems.push(OVERRIDES + ' builds a storage key inline (' + m[0].slice(0, 40) + ') instead of taking it from MMKV_KEYS');
  }

  /* 2. ONE KEY SCHEME. A read and a write that spell the key apart lose the user's number in a way
        nothing reports: the write succeeds, the read misses, and the row silently shows the catalog. */
  const schemeFn = (overridesSrc.match(/export function (cardCostOverrideKey|[A-Za-z0-9_]*OverrideKey)\s*\(/) ?? [])[1];
  if (!schemeFn) {
    problems.push(OVERRIDES + ' exports no single key-scheme function — the row key is derived in more than one place, or in none');
  }

  /* 3. THE CHIP IS NOT A CHOICE. A user's own figure may not be written as anything but USER. */
  const writeBlock = overridesSrc.match(/export function write[A-Za-z0-9_]*\s*\([\s\S]*?\n}/);
  if (!writeBlock) {
    problems.push(OVERRIDES + ' exports no write function — N3 is the criterion that adds the writer P2 deliberately did not');
  } else {
    for (const m of writeBlock[0].matchAll(/chip:\s*'([A-Z_]+)'/g)) {
      if (m[1] !== 'USER') {
        problems.push(OVERRIDES + " writes an override with chip '" + m[1] + "'. A value the user typed is theirs: VERIFIED would dress their guess as the issuer's terms, ESTIMATE would tell them their own number is ours (§25)");
      }
    }
    if (!/chip:\s*'USER'/.test(writeBlock[0])) {
      problems.push(OVERRIDES + ' write path never sets chip USER — the row cannot become "Your value" if nothing writes that it is');
    }
  }

  /* 4. THROUGH THE ADAPTER. The precedence rule has one home, and it is P2's. */
  const usesAdapter = /storeAdapter/.test(overridesSrc) || /storeAdapter/.test(resolutionSrc);
  if (!usesAdapter) {
    problems.push('neither ' + OVERRIDES + ' nor ' + RESOLUTION + ' reaches ' + ADAPTER + ' — N3 says the value goes through the adapter, and a private merge is the second precedence rule §2.2 warns about');
  }
  /* A comparison of chips written outside the adapter is that second rule, wherever it hides. */
  for (const src of [{ n: RESOLUTION, s: resolutionSrc }, { n: SECTION, s: sectionSrc }]) {
    if (/CHIP_PRECEDENCE\s*\.\s*indexOf|indexOf\s*\(\s*chip/.test(src.s)) {
      problems.push(src.n + ' compares chips by index itself. `outranks` already does that in ' + ADAPTER + ', and two orderings disagree the moment one is edited');
    }
  }

  /* 5. NO LOCAL COPY. The clause a render test cannot see. */
  if (/useState\s*<[^>]*\bCardCostReading\b/.test(sectionSrc) || /useState[^;]*\b(value|amount|fee|cost)\b[^;]*=/.test(sectionSrc)) {
    const held = (sectionSrc.match(/const\s*\[\s*([A-Za-z0-9_]+)[^\]]*\]\s*=\s*useState[^;]*;/g) ?? []).join(' · ');
    problems.push(SECTION + ' holds a cost value in component state — N3: "no component holds a local copy". Draft text in an open editor is fine; the RESOLVED VALUE is not. Found: ' + held.slice(0, 200));
  }

  /* 6. THE SURFACE DOES NOT RESOLVE. Resolution moved out; the component renders what it is given. */
  if (!/readCardCost/.test(sectionSrc)) {
    problems.push(SECTION + ' does not call readCardCost — if the section still resolves its own values, the override layer is something it can forget to consult');
  }
  if (/card\.(annualFee|foreignTransactionFee|cardRates)\b/.test(sectionSrc)) {
    problems.push(SECTION + ' still reads card cost fields directly. Every row reads through ' + RESOLUTION + ', or an override wins on some rows and not others');
  }
  if (/from\s+'[^']*\/engines\//.test(sectionSrc)) {
    problems.push(SECTION + ' imports an engine directly — B1, and the Owner named it for this package');
  }

  if (problems.length) return fail(problems.join(' · '));

  /* 7. THE VALUES, EXERCISED — and the renders, which is where "Your value" actually appears. */
  const store = projectConfig(root, 'unit', STORE_SUITE);
  if (store.error) return fail(store.error);
  const storeRun = requireJestCases(root, STORE_SUITE, STORE_CASES, ['--config', JSON.stringify(store.config)]);
  if (storeRun.problems.length) return fail(storeRun.problems.join(' · '), storeRun.summary ?? undefined);

  const render = projectConfig(root, 'render', RENDER_SUITE);
  if (render.error) return fail(render.error);
  const renderRun = requireJestCases(root, RENDER_SUITE, RENDER_CASES, ['--config', JSON.stringify(render.config)]);
  if (renderRun.problems.length) return fail(renderRun.problems.join(' · '), renderRun.summary ?? undefined);

  for (const r of [storeRun, renderRun]) {
    if (!/Tests:\s+\d+ passed/.test(String(r.summary ?? ''))) {
      return fail('a suite reported no passing tests: ' + String(r.summary));
    }
  }

  return ok(SENTINEL, [
    'The writer P2 deliberately did not build now exists, and it is the only one:',
    '  · ' + OVERRIDES + ' persists under MMKV_KEYS.profileCardOverrides, with one key scheme',
    '    (' + schemeFn + ') that both the read and the write derive from.',
    '  · every override is written with chip USER. A value the user typed is theirs, and §25 gives',
    '    it the label "Your value" rather than dressing it as the issuer\'s terms.',
    '  · precedence stays in ' + ADAPTER + '. Nothing outside it compares two chips.',
    '  · ' + SECTION + ' resolves nothing and holds no copy: it renders what readCardCost returns.',
    'N2 and N3 meet at the zero and this proves both directions: the CATALOG\'s ambiguous zero still',
    '  renders "Add this", and a zero the USER asserted renders as a value — same digit, and the',
    '  difference is entirely who said it.',
    STORE_CASES.length + ' store case(s) required BY NAME · ' + storeRun.summary,
    RENDER_CASES.length + ' render case(s) required BY NAME · ' + renderRun.summary,
  ].join('\n'));
};
