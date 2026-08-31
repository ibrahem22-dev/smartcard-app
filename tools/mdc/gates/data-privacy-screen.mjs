/**
 * C7 — DATA & PRIVACY.
 *
 * Runtime cases prove the rendered figures. Source inspection proves that the screen has one seam,
 * that the seam verifies both artifact classes and reads all three stores, and that a figure was
 * not planted in JSX while still agreeing with today's manifests.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';
import { stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'DATA-PRIVACY OK';
export const FAILURE_SENTINEL = 'DATA-PRIVACY FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCREEN = join(ROOT, 'src', 'screens', 'DataPrivacyScreen.tsx');
const SEAM = join(ROOT, 'src', 'data', 'adapter', 'dataPrivacy.ts');
const PACKS = join(ROOT, 'src', 'data', 'adapter', 'packs');
const EN = join(ROOT, 'src', 'i18n', 'en.ts');
const AR = join(ROOT, 'src', 'i18n', 'ar.ts');
const ROUTE_TYPES = join(ROOT, 'src', 'navigation', 'types.ts');
const MORE_STACK = join(ROOT, 'src', 'navigation', 'stacks', 'MoreStack.tsx');
const SETTINGS = join(ROOT, 'src', 'screens', 'SettingsScreen.tsx');
const SUITE = 'src/screens/__tests__/dataPrivacy.render.test.tsx';
const REQUIRED_CASES = [
  'renders every verified artifact version and manifest figure from the runtime seam',
  'refuses a version that diverges between manifest and body',
  'renders declared freshness and the FX date range without a staleness verdict',
  'renders the complete pack-side provenance mix in its distinct vocabulary',
  'reports bundled JSON separately from the empty SQLite import store',
  'reports all three stores and renders a failed store read as unavailable rather than zero',
];

const rel = path => relative(ROOT, path).split('\\').join('/');

const sourceFile = (path, source) => ts.createSourceFile(
  path,
  source,
  ts.ScriptTarget.Latest,
  true,
  path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
);

const moduleSpecifiers = (path, source) => {
  const specifiers = [];
  sourceFile(path, source).forEachChild(node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
  });
  return specifiers;
};

const resolveSourceImport = (fromPath, specifier) => {
  if (!specifier.startsWith('.')) return undefined;
  const base = join(dirname(fromPath), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find(candidate => existsSync(candidate) && /\.tsx?$/.test(candidate));
};

/** The population is whatever the screen imports transitively; adapter internals remain a boundary. */
const screenSourcePopulation = () => {
  const queue = [SCREEN];
  const seen = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined || seen.has(path)) continue;
    seen.add(path);
    if (rel(path).startsWith('src/data/adapter/')) continue;
    const source = readFileSync(path, 'utf8');
    for (const specifier of moduleSpecifiers(path, source)) {
      const dependency = resolveSourceImport(path, specifier);
      if (dependency !== undefined && rel(dependency).startsWith('src/')) queue.push(dependency);
    }
  }
  return [...seen].sort();
};

const walk = (node, visit) => {
  visit(node);
  node.forEachChild(child => walk(child, visit));
};

const literalValue = node => {
  if (ts.isNumericLiteral(node)) return node.text;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
};

/** Figures rendered inside AppText must come through an identifier/property read, not a literal. */
const renderedLiteralFigures = (path, source) => {
  const ast = sourceFile(path, source);
  const literalBindings = new Map();
  walk(ast, node => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || node.initializer === undefined) return;
    const value = literalValue(node.initializer);
    if (value !== undefined && /\d/.test(value)) literalBindings.set(node.name.text, value);
  });

  const findings = [];
  walk(ast, node => {
    if (!ts.isJsxElement(node) || node.openingElement.tagName.getText(ast) !== 'AppText') return;
    for (const child of node.children) {
      if (ts.isJsxText(child) && /\d/.test(child.text)) {
        findings.push(`JSX text ${JSON.stringify(child.text.trim())}`);
      }
      if (!ts.isJsxExpression(child) || child.expression === undefined) continue;
      walk(child.expression, expression => {
        const value = literalValue(expression);
        if (value !== undefined && /\d/.test(value)) {
          findings.push(`literal ${JSON.stringify(value)} inside AppText`);
        }
        if (ts.isIdentifier(expression) && literalBindings.has(expression.text)) {
          findings.push(`literal-bound ${expression.text}=${JSON.stringify(literalBindings.get(expression.text))} inside AppText`);
        }
      });
    }
  });
  return [...new Set(findings)];
};

const declaredLiteralFigures = (path, source) => {
  const ast = sourceFile(path, source);
  const figureName = /^(?:version|datasetVersion|formatVersion|generatedAt|bytes|rowCount|minAppVersion|staleAfterDays|snapshotDate|earliestRateDate|latestRateDate|accessedAt|bundledRows|count)$/i;
  const findings = [];
  walk(ast, node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
      const value = literalValue(node.initializer);
      if (figureName.test(node.name.text) && value !== undefined && /\d/.test(value)) {
        findings.push(`${node.name.text}=${JSON.stringify(value)}`);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : '';
      const value = literalValue(node.initializer);
      if (figureName.test(name) && value !== undefined && /\d/.test(value)) {
        findings.push(`${name}: ${JSON.stringify(value)}`);
      }
    }
  });
  return [...new Set(findings)];
};

const objectKeys = (path) => {
  const keys = new Set();
  const ast = sourceFile(path, readFileSync(path, 'utf8'));
  walk(ast, node => {
    if (!ts.isPropertyAssignment(node)) return;
    const name = node.name;
    if (ts.isStringLiteral(name) || ts.isIdentifier(name)) keys.add(name.text);
  });
  return keys;
};

const hebrewStrings = (path, source) => {
  const values = new Set();
  walk(sourceFile(path, source), node => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /[\u0590-\u05ff]/.test(node.text)) {
      values.add(node.text);
    }
  });
  return values;
};

const hasDataPrivacyTypeRoute = source => {
  let found = false;
  walk(sourceFile(ROUTE_TYPES, source), node => {
    if (ts.isPropertySignature(node)
      && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
      && node.name.text === 'DataPrivacy'
      && node.type?.kind === ts.SyntaxKind.UndefinedKeyword) found = true;
  });
  return found;
};

const hasDataPrivacyStackRoute = source => {
  let found = false;
  walk(sourceFile(MORE_STACK, source), node => {
    if (!ts.isJsxSelfClosingElement(node) || node.tagName.getText() !== 'Stack.Screen') return;
    const attributes = new Map(node.attributes.properties.flatMap(attribute => {
      if (!ts.isJsxAttribute(attribute) || attribute.initializer === undefined) return [];
      const value = ts.isStringLiteral(attribute.initializer)
        ? attribute.initializer.text
        : ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression !== undefined
          ? attribute.initializer.expression.getText()
          : undefined;
      return value === undefined ? [] : [[attribute.name.getText(), value]];
    }));
    if (attributes.get('name') === 'DataPrivacy' && attributes.get('component') === 'DataPrivacyScreen') {
      found = true;
    }
  });
  return found;
};

const hasDataPrivacySettingsEntry = source => {
  let found = false;
  walk(sourceFile(SETTINGS, source), node => {
    if (!ts.isCallExpression(node)
      || !ts.isPropertyAccessExpression(node.expression)
      || node.expression.name.text !== 'navigate') return;
    const destination = node.arguments[0];
    if (destination !== undefined && ts.isStringLiteral(destination) && destination.text === 'DataPrivacy') {
      found = true;
    }
  });
  return found;
};

const artifactPopulation = () => readdirSync(PACKS, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => {
    const directory = join(PACKS, entry.name);
    const manifestPath = join(directory, 'manifest.json');
    const bodyPath = ['pack.json', 'snapshot.json']
      .map(name => join(directory, name))
      .find(existsSync);
    return { set: entry.name, manifestPath, bodyPath };
  })
  .filter(item => existsSync(item.manifestPath) && item.bodyPath !== undefined);

const countProvenance = (value, counts) => {
  if (Array.isArray(value)) {
    for (const child of value) countProvenance(child, counts);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [field, child] of Object.entries(value)) {
    if (field === 'chip' || field === 'provenanceChip') {
      counts.set(String(child), (counts.get(String(child)) ?? 0) + 1);
    }
    countProvenance(child, counts);
  }
};

export const run = async () => {
  const required = [SCREEN, SEAM, PACKS, EN, AR, ROUTE_TYPES, MORE_STACK, SETTINGS];
  const missing = required.filter(path => !existsSync(path));
  if (missing.length > 0) return fail(`missing required file(s): ${missing.map(rel).join(', ')}`);
  if (!statSync(PACKS).isDirectory()) return fail(`${rel(PACKS)} is not a directory`);

  const problems = [];
  const clauses = [];
  const artifacts = artifactPopulation();
  if (artifacts.length === 0) problems.push('derived bundled artifact population is empty');
  const provenance = new Map();
  let bundledRows = 0;
  for (const artifact of artifacts) {
    const manifest = JSON.parse(readFileSync(artifact.manifestPath, 'utf8'));
    const body = JSON.parse(readFileSync(artifact.bodyPath, 'utf8'));
    const versionField = typeof manifest.packVersion === 'string' ? 'packVersion' : 'snapshotVersion';
    if (typeof manifest[versionField] !== 'string') {
      problems.push(`${artifact.set}: manifest declares neither packVersion nor snapshotVersion`);
    } else if (body[versionField] !== manifest[versionField]) {
      problems.push(`${artifact.set}: ${versionField} differs between manifest and body`);
    }
    const rows = typeof manifest.rowCounts?.totalRows === 'number'
      ? manifest.rowCounts.totalRows
      : manifest.currencyCount;
    if (typeof rows !== 'number' || rows <= 0) problems.push(`${artifact.set}: no positive runtime row population`);
    else bundledRows += rows;
    if (typeof manifest.generatedAt !== 'string') problems.push(`${artifact.set}: generatedAt is absent`);
    if (typeof manifest.provenanceContract?.staleAfterDays !== 'number') {
      problems.push(`${artifact.set}: provenanceContract.staleAfterDays is absent`);
    }
    countProvenance(body, provenance);
  }
  const packVocabulary = new Set(['VERIFIED', 'ESTIMATE', 'UNKNOWN', 'CONFLICT']);
  if (provenance.size === 0) problems.push('derived pack-side provenance population is empty');
  for (const state of provenance.keys()) {
    if (!packVocabulary.has(state)) problems.push(`pack-side provenance contains out-of-domain state ${state}`);
  }
  clauses.push(`${artifacts.length} artifact(s), ${bundledRows} bundled row(s), and ${[...provenance.values()].reduce((sum, count) => sum + count, 0)} provenance field(s) derived from disk`);

  const sourcePopulation = screenSourcePopulation();
  const sources = new Map(sourcePopulation.map(path => {
    const raw = readFileSync(path, 'utf8');
    return [path, { raw, stripped: stripCommentsAndStrings(raw) }];
  }));
  const screenRaw = sources.get(SCREEN)?.raw ?? '';
  const screenStripped = sources.get(SCREEN)?.stripped ?? '';
  const seamRaw = sources.get(SEAM)?.raw ?? readFileSync(SEAM, 'utf8');
  const seamStripped = stripCommentsAndStrings(seamRaw);
  const screenImportsSeam = moduleSpecifiers(SCREEN, screenRaw)
    .some(specifier => resolveSourceImport(SCREEN, specifier) === SEAM);
  if (!screenImportsSeam) problems.push('DataPrivacyScreen does not import its figures from the dataPrivacy seam');
  if (!/readDataPrivacy\s*\(\s*\)/.test(screenStripped)) problems.push('screen does not call readDataPrivacy() at runtime');
  for (const pattern of [
    /reading\.artifacts\.map\s*\(/,
    /reading\.provenanceMix\.map\s*\(/,
    /reading\.local\.bundledRows/,
    /reading\.local\.encryptedVaultKeys/,
    /reading\.local\.preferenceKeys/,
    /reading\.local\.importedPackRows/,
  ]) {
    if (!pattern.test(screenStripped)) problems.push(`screen is missing runtime rendering pattern ${pattern}`);
  }

  for (const pattern of [
    /openAllPackSets\s*\(/,
    /openFxSnapshot\s*\(/,
    /versionFromBothHomes\s*\(/,
    /assertArtifactVersionsAgree\s*\(/,
    /manifestVersion\s*!==\s*bodyVersion/,
    /keyVault\.getEncryptedStorage\s*\(/,
    /preferences\.getAllKeys\s*\(/,
    /openPackStore\s*\(\s*\)\.getFirstSync/,
  ]) {
    if (!pattern.test(seamStripped)) problems.push(`adapter seam is missing runtime derivation pattern ${pattern}`);
  }
  if (!/status:\s*[^\n]*UNAVAILABLE/.test(seamRaw) || !/status:\s*[^\n]*AVAILABLE/.test(seamRaw)) {
    problems.push('adapter seam does not distinguish available store counts from unavailable reads');
  }

  for (const path of sourcePopulation) {
    const imports = moduleSpecifiers(path, sources.get(path)?.raw ?? '');
    if (path === SEAM) {
      for (const finding of declaredLiteralFigures(path, sources.get(path)?.raw ?? seamRaw)) {
        problems.push(`${rel(path)} declares a typed figure: ${finding}`);
      }
      continue;
    }
    const reachesArtifact = imports.some(specifier => /packs\/.*\.json$/.test(specifier));
    const c7ImplementationFile = path === SCREEN || rel(path).startsWith('src/screens/dataPrivacy/');
    const reachesC7Store = c7ImplementationFile && imports.some(specifier => (
      /(?:store\/packStore|security\/keyVault|react-native-mmkv|expo-sqlite)$/.test(specifier)
    ));
    if (reachesArtifact || reachesC7Store) {
      problems.push(`${rel(path)} reaches a manifest, pack, or store outside the C7 seam`);
    }
    for (const finding of renderedLiteralFigures(path, sources.get(path)?.raw ?? '')) {
      problems.push(`${rel(path)} renders a typed figure: ${finding}`);
    }
    if (c7ImplementationFile) {
      for (const finding of declaredLiteralFigures(path, sources.get(path)?.raw ?? '')) {
        problems.push(`${rel(path)} declares a typed figure: ${finding}`);
      }
    }
  }
  clauses.push(`screen import closure contains ${sourcePopulation.length} source file(s); only the seam names artifacts and stores; no AppText figure is literal`);

  const enKeys = objectKeys(EN);
  const arKeys = objectKeys(AR);
  const screenHebrew = hebrewStrings(SCREEN, screenRaw);
  for (const key of screenHebrew) {
    if (!enKeys.has(key)) problems.push(`English translation is absent for ${JSON.stringify(key)}`);
    if (!arKeys.has(key)) problems.push(`Arabic translation is absent for ${JSON.stringify(key)}`);
  }
  clauses.push(`${screenHebrew.size} Hebrew screen string(s) have English and Arabic entries`);

  const routeTypesSource = readFileSync(ROUTE_TYPES, 'utf8');
  const moreStackSource = readFileSync(MORE_STACK, 'utf8');
  const settingsSource = readFileSync(SETTINGS, 'utf8');
  if (!hasDataPrivacyTypeRoute(routeTypesSource)) problems.push('MoreStackParamList has no DataPrivacy route');
  if (!moduleSpecifiers(MORE_STACK, moreStackSource)
    .some(specifier => resolveSourceImport(MORE_STACK, specifier) === SCREEN)) {
    problems.push('MoreStack does not import DataPrivacyScreen');
  }
  if (!hasDataPrivacyStackRoute(moreStackSource)) problems.push('MoreStack does not register DataPrivacyScreen as DataPrivacy');
  if (!hasDataPrivacySettingsEntry(settingsSource)) problems.push('SettingsScreen has no additive navigation entry for DataPrivacy');
  clauses.push('DataPrivacy is a typed, registered route with a Settings entry');

  const jest = requireJestCases(ROOT, SUITE, REQUIRED_CASES, ['--runInBand']);
  if (jest.problems.length > 0) problems.push(...jest.problems.map(problem => `runtime: ${problem}`));
  clauses.push(`${REQUIRED_CASES.length} named runtime cases — ${jest.summary}`);

  if (problems.length > 0) {
    return fail(problems.join('\n           '), {
      population: artifacts.length + sourcePopulation.length + jest.ran,
    });
  }
  return okOverPopulation({
    population: artifacts.length + bundledRows + [...provenance.values()].reduce((sum, count) => sum + count, 0) + jest.ran,
    unit: 'artifact/row/provenance/case measurement(s)',
    detail: clauses.join(' · '),
  });
};
