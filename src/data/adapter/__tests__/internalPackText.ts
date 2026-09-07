/**
 * THE ADVERSARY'S WORD LIST — every internal-only string the SHIPPED packs actually contain.
 *
 * Not a suite (jest matches `*.test.ts`), and not shipped: it lives under `__tests__`, so nothing
 * on the App import graph reaches it and Metro never bundles it. It lives under `data/adapter/`
 * because D2 allows only that directory to open a pack file.
 *
 * It exists so the boundary tests are adversarial with REAL MATERIAL rather than with a fixture
 * somebody wrote to pass. `packTextRegister.json` says which paths are internal; this walks the
 * shipped packs and returns the values at those paths. When the estate ships a new benefit whose
 * `description` reads like consumer copy, the test's word list grows on its own.
 */
import register from '../packTextRegister.json';
import benefitsPack from '../packs/benefits/pack.json';
import catalogPack from '../packs/catalog/pack.json';
import contentPack from '../packs/content/pack.json';
import taxonomyPack from '../packs/taxonomy/pack.json';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const PACKS: Readonly<Record<string, unknown>> = {
  catalog: catalogPack,
  benefits: benefitsPack,
  content: contentPack,
  taxonomy: taxonomyPack,
};

const MIN_PROSE_CHARS: number = register.minProseChars;
const INTERNAL_PATHS: readonly string[] = Object.keys(register.internal);
const CONSUMER_PATHS: readonly string[] = Object.keys(register.consumer);

function isProse(value: unknown): value is string {
  return typeof value === 'string' && value.length >= MIN_PROSE_CHARS && /\s/.test(value);
}

function collect(base: string, value: Json, wanted: ReadonlySet<string>, out: Set<string>): void {
  if (typeof value === 'string') {
    if (wanted.has(base) && isProse(value)) out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(`${base}[]`, item, wanted, out);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collect(`${base}.${key}`, item, wanted, out);
  }
}

/**
 * Every internal-only prose value in the shipped packs.
 *
 * @param prefix restrict to one pack or one unit, e.g. `benefits.benefits` — a render test for one
 *   surface searches for the material that surface could plausibly reach, so a failure names a
 *   field the reader could actually have seen.
 */
export function internalPackText(prefix = ''): readonly string[] {
  const wanted = new Set(INTERNAL_PATHS.filter((p) => p.startsWith(prefix)));
  const out = new Set<string>();
  for (const [packName, pack] of Object.entries(PACKS)) {
    const units = (pack as { units?: Record<string, Json[]> }).units ?? {};
    for (const [unit, rows] of Object.entries(units)) {
      for (const row of rows) {
        for (const [key, value] of Object.entries(row as Record<string, Json>)) {
          collect(`${packName}.${unit}.${key}`, value, wanted, out);
        }
      }
    }
  }
  return [...out];
}

/** Every consumer-safe prose value in the shipped packs. */
export function consumerPackText(): readonly string[] {
  const wanted = new Set(CONSUMER_PATHS);
  const out = new Set<string>();
  for (const [packName, pack] of Object.entries(PACKS)) {
    const units = (pack as { units?: Record<string, Json[]> }).units ?? {};
    for (const [unit, rows] of Object.entries(units)) {
      for (const row of rows) {
        for (const [key, value] of Object.entries(row as Record<string, Json>)) {
          collect(`${packName}.${unit}.${key}`, value, wanted, out);
        }
      }
    }
  }
  return [...out];
}

/**
 * The internal values a substring search can actually trust. Two filters, both stated:
 *
 * 1. LENGTH. A 25-character internal fragment can collide with legitimate output by accident, so
 *    the search uses values of at least `UNAMBIGUOUS_MIN_CHARS`, where a match is a leak and not a
 *    coincidence. The floor is declared here rather than tuned until a suite passed.
 *
 * 2. DUPLICATION BY THE ESTATE. Some internal values are VERBATIM SUBSTRINGS of consumer-safe ones,
 *    because the estate wrote the same sentence twice. `content.glossary.definitionSource.quote`
 *    holds *"העמלה תחושב לפי השער היציג של סכום ההמרה במטבע המקורי שלפיו בוצעה העסקה"*, and the
 *    definition the Learn screen is MEANT to render quotes it in full inside `definitionHe`.
 *    Finding that on the screen is evidence about the pack, not about the boundary — the reader is
 *    seeing the definition, which is consumer text by classification and by design. Searching for
 *    it would fail the suite over a duplicate, so it is removed, and the removal is a rule rather
 *    than an exception list somebody has to maintain.
 */
export const UNAMBIGUOUS_MIN_CHARS = 45;

/**
 * Internal values the estate did not also publish as consumer text (filter 2 above, on its own).
 *
 * Used where the comparison is EXACT — the projection suite walks a projected object to its leaves
 * and asks whether a leaf IS an internal value — so no length floor is needed or wanted: a short
 * internal string that survives projection is a leak whatever its length.
 *
 * The duplicates this removes are real and specific. `benefit:cal:ben-ccp-gov-above10k-y1` carries
 * `valueCorroboratedBy.excerpt: "0.6% government above 10k, year 1"` and `titleEn` with the same
 * 32 characters, because the corroboration IS the title — `valueCorroboratedBy.field` says
 * `"titleEn"`. Reading that off a projected row proves it kept its title.
 */
export function distinctiveInternalPackText(prefix = ''): readonly string[] {
  const consumerValues = consumerPackText();
  return internalPackText(prefix).filter(
    (value) => !consumerValues.some((safe) => safe.includes(value)),
  );
}

export function unambiguousInternalPackText(prefix = ''): readonly string[] {
  return distinctiveInternalPackText(prefix).filter(
    (value) => value.length >= UNAMBIGUOUS_MIN_CHARS,
  );
}
