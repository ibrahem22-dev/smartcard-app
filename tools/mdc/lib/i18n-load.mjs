/**
 * THE TRANSLATION MAPS, LOADED AS OBJECTS RATHER THAN MATCHED AS TEXT.
 *
 * Every earlier reader of these files counted entries with a regular expression over the TypeScript
 * source. That is workable and it is also how a count goes quietly wrong: the shipped maps carry
 * entries whose key and value sit on DIFFERENT LINES — 85 of them in `en.ts` alone, because a long
 * English sentence does not fit beside a long Hebrew one — and a line-anchored pattern cannot see a
 * pair it has to cross a newline to read. An escaped apostrophe inside a value ends the match early.
 * A trailing comment after a value shifts it. None of that fails loudly; the count just comes back
 * smaller than the truth and every figure derived from it is wrong in the same direction.
 *
 * So this transpiles the module with the compiler the repository already depends on and evaluates
 * it in a throwaway context. What comes back is the object the APP sees at runtime: exact keys,
 * exact values, escapes resolved, multi-line entries whole, duplicates collapsed exactly as the
 * language collapses them.
 *
 * IT IS SANDBOXED, AND THE SANDBOX IS NOT DECORATION. `vm.runInNewContext` with an empty context
 * means these modules get no `require`, no `process`, no filesystem and no network. They are data
 * files and they must evaluate as data files; anything that needed more than an object literal to
 * produce its map would throw here rather than run, which is the correct outcome for a translation
 * table. `he.ts` is the one file that also exports a FUNCTION, and that is why the loader returns
 * the whole module namespace rather than a single map.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const req = createRequire(import.meta.url);

/**
 * Evaluates one TypeScript module from `src/i18n` and returns its exports.
 * Throws with the module name attached, so a caller can say WHICH file it could not read.
 */
export const loadI18nModule = (root, name) => {
  const file = join(root, 'src', 'i18n', `${name}.ts`);
  let ts;
  try {
    ts = req('typescript');
  } catch (err) {
    throw new Error(`typescript is not resolvable, so ${name}.ts cannot be read as anything but text: ${err?.message ?? err}`);
  }
  const source = readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: `${name}.ts`,
  }).outputText;

  const exports = {};
  const context = { exports, module: { exports } };
  try {
    /* No require, no process, no fs: a translation table must evaluate as data or not at all. */
    runInNewContext(js, context, { filename: `${name}.ts`, timeout: 10_000 });
  } catch (err) {
    throw new Error(`src/i18n/${name}.ts did not evaluate as a data module: ${err?.message ?? err}`);
  }
  return context.module.exports;
};

/** The three source-keyed maps the runtime `t()` actually consults, plus Hebrew's function. */
export const loadTranslationMaps = (root) => {
  const en = loadI18nModule(root, 'en');
  const ar = loadI18nModule(root, 'ar');
  const he = loadI18nModule(root, 'he');
  return {
    enBySource: en.enBySource,
    arBySource: ar.arBySource,
    enKeyed: en.en,
    heKeyed: he.he,
    translateHebrew: he.translateHebrew,
  };
};
