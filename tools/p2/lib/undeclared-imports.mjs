/**
 * EVERY PACKAGE `src/**` IMPORTS THAT `package.json` DOES NOT DECLARE.
 *
 * WHY THIS EXISTS, and it is not a lint nicety. Phase 2 archived four packages out of the manifest
 * and the fenced gate printed `FENCED OK — 0 reachable`. That claim was true and it was not enough:
 * `src/hooks/useProfileShare.ts` still imported `expo-camera`. Nothing imported the hook, so it was
 * unreachable, so the reachability gate was right to say nothing — and `npx tsc --noEmit` on CI's
 * clean `npm ci` failed on it, while the same command passed on the machine where the work was done
 * because a stale `node_modules` still had the package on disk.
 *
 * Two lessons are baked in here:
 *
 *   1. **UNREACHABLE IS NOT ABSENT.** A file outside the runtime graph is still compiled, still
 *      shipped in the repository, and still breaks a clean install. B9 says the packages are
 *      archived out of the manifest; a source file importing one contradicts that no matter which
 *      part of the graph it sits in.
 *   2. **A CHECK THAT READS `node_modules` IS A CHECK ABOUT ONE MACHINE.** This one reads
 *      `package.json` — the declaration — and never asks the filesystem whether the package happens
 *      to be installed. That is the whole point: the answer must not depend on what a developer
 *      installed six weeks ago and never cleaned up.
 *
 * The population is DERIVED — every file under `src/**` — so a new file cannot escape by not being
 * on a list.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { builtinModules } from 'node:module';

const PATTERNS = [
  /\bimport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bexport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(e) && !/\.d\.ts$/.test(e)) acc.push(p);
  }
  return acc;
};

/** `@scope/name/deep/path` → `@scope/name`; `name/deep/path` → `name`. */
export const packageOf = (spec) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

export const scanUndeclaredImports = (root) => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  const builtin = new Set(builtinModules);
  const files = walk(join(root, 'src'));
  const findings = [];

  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = readFileSync(abs, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    for (const re of PATTERNS) {
      for (const m of code.matchAll(re)) {
        const spec = m[1];
        if (spec.startsWith('.') || spec.startsWith('/')) continue;
        const name = packageOf(spec);
        if (declared.has(name) || builtin.has(name) || spec.startsWith('node:')) continue;
        findings.push({ file: rel, package: name, spec, line: code.slice(0, m.index).split('\n').length });
      }
    }
  }

  // THE SECOND HOME OF THE SAME FACT. `app.json`'s `expo.plugins` names packages too, and it is
  // not a source file, so nothing above would ever look at it. When `expo-camera` was archived out
  // of the manifest, its plugin entry stayed behind — complete with a Hebrew permission string
  // about scanning a QR code for a route that no longer exists. `expo prebuild` would have failed
  // on it, and no check in this repository looked. One fact, two homes, no comparison: the shape
  // this campaign keeps finding.
  // THE EXPO CONFIG MOVED, AND THIS CHECK SAID SO RATHER THAN GOING QUIET.
  //
  // A10 replaced the static `app.json` with `app.config.js`, generated from `identity.json`. This
  // check read app.json, found nothing, and failed with "either the config moved or this check is
  // reading the wrong file, and both are worth stopping for" — which is exactly the sentence a
  // check should produce when its subject disappears. The alternative, silently finding zero
  // plugins and passing, is how a check stops being one.
  //
  // app.config.js is JavaScript, so the plugin list is read as source rather than parsed as data.
  const plugins = [];
  const configJs = join(root, 'app.config.js');
  const appJsonPath = join(root, 'app.json');
  let pluginNames = [];
  if (existsSync(configJs)) {
    const src = readFileSync(configJs, 'utf8');
    const block = src.match(/plugins:\s*\[([\s\S]*?)\]/);
    if (block) pluginNames = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  } else if (existsSync(appJsonPath)) {
    const app = JSON.parse(readFileSync(appJsonPath, 'utf8'));
    pluginNames = (app?.expo?.plugins ?? []).map((e) => (Array.isArray(e) ? e[0] : e));
  }
  {
    for (const entry of pluginNames) {
      const name = Array.isArray(entry) ? entry[0] : entry;
      if (typeof name !== 'string' || name.startsWith('.') || name.startsWith('/')) continue;
      plugins.push(name);
      const pkgName = packageOf(name);
      if (declared.has(pkgName) || builtin.has(pkgName)) continue;
      findings.push({ file: 'app.json', package: pkgName, spec: name, line: 0, via: 'expo.plugins' });
    }
  }

  return { scanned: files.length, declared: declared.size, plugins: plugins.length, findings };
};
