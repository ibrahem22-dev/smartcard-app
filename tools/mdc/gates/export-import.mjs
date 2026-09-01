/**
 * C5 — encrypted vault export/import.
 *
 * Runtime cases exercise the real Noble AES-GCM and Argon2id implementation. Source inspection
 * closes the complementary question: the rendered surface reaches that service/envelope path and
 * no plaintext export path sits beside it. The inspected population is derived from the screen's
 * relative-import closure; comments and string bodies are removed before code-pattern matching.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';
import { stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'EXPORT-IMPORT OK';
export const FAILURE_SENTINEL = 'EXPORT-IMPORT FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SCREEN = join(ROOT, 'src', 'screens', 'VaultExportImportScreen.tsx');
const SERVICE = join(ROOT, 'src', 'services', 'vaultExportImport.ts');
const KEY_VAULT = join(ROOT, 'src', 'security', 'keyVault.ts');
const PACK_STORE = join(ROOT, 'src', 'store', 'packStore.ts');
const SETTINGS = join(ROOT, 'src', 'screens', 'SettingsScreen.tsx');
const ROUTE_TYPES = join(ROOT, 'src', 'navigation', 'types.ts');
const MORE_STACK = join(ROOT, 'src', 'navigation', 'stacks', 'MoreStack.tsx');
const EN = join(ROOT, 'src', 'i18n', 'en.ts');
const AR = join(ROOT, 'src', 'i18n', 'ar.ts');
const RUNTIME_RUNNER = join(HERE, 'export-import-runtime.cjs');
const SERVICE_SUITE = 'src/services/__tests__/vaultExportImport.test.ts';
const SCREEN_SUITE = 'src/screens/__tests__/vaultExportImport.render.test.tsx';

const SERVICE_CASES = [
  'round-trips the real encrypted envelope into an empty vault byte-faithfully',
  'refuses a wrong passphrase separately from malformed and truncated exports',
  'refuses a below-floor passphrase, a version-1 envelope, and an oversized payload',
  'rejects duplicate vault keys before the first storage mutation',
  'verifies apply, verifies rollback, and reports rollback failure truthfully',
];
const SCREEN_CASES = [
  'renders the exact passphrase-protection and non-recovery warning',
];

const rel = path => relative(ROOT, path).split('\\').join('/');

const sourceFile = (path, source) => ts.createSourceFile(
  path,
  source,
  ts.ScriptTarget.Latest,
  true,
  path.endsWith('.tsx') ? ts.ScriptKind.TSX : path.endsWith('.cjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
);

const walk = (node, visit) => {
  visit(node);
  node.forEachChild(child => walk(child, visit));
};

const moduleSpecifiers = (path, source) => {
  const values = [];
  sourceFile(path, source).forEachChild(node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteral(node.moduleSpecifier)) values.push(node.moduleSpecifier.text);
  });
  return values;
};

const resolveSourceImport = (fromPath, specifier) => {
  if (!specifier.startsWith('.')) return undefined;
  const base = join(dirname(fromPath), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find(candidate => existsSync(candidate) && /\.tsx?$/.test(candidate));
};

const importClosure = root => {
  const queue = [root];
  const seen = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined || seen.has(path)) continue;
    seen.add(path);
    const source = readFileSync(path, 'utf8');
    for (const specifier of moduleSpecifiers(path, source)) {
      const dependency = resolveSourceImport(path, specifier);
      if (dependency !== undefined && rel(dependency).startsWith('src/')) queue.push(dependency);
    }
  }
  return [...seen].sort();
};

const stringLiterals = (path, source) => {
  const values = new Set();
  walk(sourceFile(path, source), node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) values.add(node.text);
  });
  return values;
};

const objectKeys = path => {
  const keys = new Set();
  walk(sourceFile(path, readFileSync(path, 'utf8')), node => {
    if (!ts.isPropertyAssignment(node)) return;
    if (ts.isStringLiteral(node.name) || ts.isIdentifier(node.name)) keys.add(node.name.text);
  });
  return keys;
};

const hebrewStrings = (path, source) => {
  const values = new Set();
  walk(sourceFile(path, source), node => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      && /[\u0590-\u05ff]/.test(node.text)) values.add(node.text);
  });
  return values;
};

const mockedModules = (path, source) => {
  const values = [];
  walk(sourceFile(path, source), node => {
    if (!ts.isCallExpression(node) || node.arguments.length === 0) return;
    const expression = node.expression;
    const isJestMock = ts.isPropertyAccessExpression(expression)
      && ts.isIdentifier(expression.expression)
      && expression.expression.text === 'jest'
      && expression.name.text === 'mock';
    if (isJestMock && ts.isStringLiteral(node.arguments[0])) values.push(node.arguments[0].text);
  });
  return values;
};

const hasTypedRoute = source => {
  let found = false;
  walk(sourceFile(ROUTE_TYPES, source), node => {
    if (ts.isPropertySignature(node)
      && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
      && node.name.text === 'VaultExportImport'
      && node.type?.kind === ts.SyntaxKind.UndefinedKeyword) found = true;
  });
  return found;
};

const hasStackRegistration = source => {
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
    if (attributes.get('name') === 'VaultExportImport'
      && attributes.get('component') === 'VaultExportImportScreen') found = true;
  });
  return found;
};

const hasSettingsEntry = source => {
  let found = false;
  walk(sourceFile(SETTINGS, source), node => {
    if (!ts.isCallExpression(node)
      || !ts.isPropertyAccessExpression(node.expression)
      || node.expression.name.text !== 'navigate') return;
    const destination = node.arguments[0];
    if (destination !== undefined
      && ts.isStringLiteral(destination)
      && destination.text === 'VaultExportImport') found = true;
  });
  return found;
};

export const run = async () => {
  const required = [
    SCREEN,
    SERVICE,
    KEY_VAULT,
    PACK_STORE,
    SETTINGS,
    ROUTE_TYPES,
    MORE_STACK,
    EN,
    AR,
    RUNTIME_RUNNER,
  ];
  const missing = required.filter(path => !existsSync(path));
  if (missing.length > 0) return fail(`missing required file(s): ${missing.map(rel).join(', ')}`);

  const problems = [];
  const clauses = [];
  const population = importClosure(SCREEN);
  const sources = new Map(population.map(path => {
    const raw = readFileSync(path, 'utf8');
    return [path, { raw, stripped: stripCommentsAndStrings(raw) }];
  }));
  for (const path of [SCREEN, SERVICE, KEY_VAULT, PACK_STORE]) {
    if (!population.includes(path)) problems.push(`${rel(path)} is outside the screen import closure`);
  }
  clauses.push(`screen import closure contains ${population.length} source file(s)`);

  const keyVaultRaw = sources.get(KEY_VAULT)?.raw ?? '';
  const keyVaultSource = sources.get(KEY_VAULT)?.stripped ?? '';
  const keyVaultStrings = stringLiterals(KEY_VAULT, keyVaultRaw);
  for (const pattern of [
    /TRANSFER_ENVELOPE_VERSION\s*=\s*2\s*;/,
    /TRANSFER_SALT_BYTES\s*=\s*16\s*;/,
    /TRANSFER_NONCE_BYTES\s*=\s*12\s*;/,
    /TRANSFER_KEY_BYTES\s*=\s*32\s*;/,
    /TRANSFER_TAG_BYTES\s*=\s*16\s*;/,
    /MAX_TRANSFER_PAYLOAD_BYTES\s*=\s*65_536\s*;/,
    /Array\.from\s*\(\s*transferPassphrase\s*\)\.length\s*<\s*12/,
    /argon2idAsync\s*\(\s*transferPassphrase\s*,\s*salt/,
    /t:\s*2\s*,\s*m:\s*19\s*\*\s*1024\s*,\s*p:\s*1/,
    /envelope\[0\]\s*===\s*1/,
    /key\.fill\s*\(\s*0\s*\)/,
  ]) {
    if (!pattern.test(keyVaultSource)) problems.push(`keyVault transfer boundary is missing ${pattern}`);
  }
  if (/\\d\{4\}/.test(keyVaultSource)) problems.push('keyVault still contains the four-digit transfer constraint');
  for (const refusal of [
    'TRANSFER_PASSPHRASE_TOO_SHORT',
    'UNSUPPORTED_TRANSFER_ENVELOPE_VERSION_1',
  ]) {
    if (!keyVaultStrings.has(refusal)) problems.push(`keyVault does not carry named refusal ${refusal}`);
  }
  clauses.push('v2 envelope, 12-character floor, fixed KDF/layout, v1 refusal, and zeroisation are present');

  const serviceRaw = sources.get(SERVICE)?.raw ?? '';
  const serviceSource = sources.get(SERVICE)?.stripped ?? '';
  const serviceStrings = stringLiterals(SERVICE, serviceRaw);
  for (const pattern of [
    /isVaultKey\s*\(\s*key\s*\)/,
    /encryptProfileTransferPayload\s*\(/,
    /decryptProfileTransferPayload\s*\(/,
    /JSON\.parse\s*\(\s*plaintext\s*\)/,
    /seen\.has\s*\(\s*candidate\.key\s*\)/,
    /snapshot\s*=\s*readVaultEntries\s*\(\s*storage\s*\)/,
    /writeVaultEntries\s*\(\s*storage\s*,\s*entries\s*\)/,
    /entriesMatch\s*\(\s*readVaultEntries\s*\(\s*storage\s*\)\s*,\s*entries\s*\)/,
    /restoreSnapshot\s*\(\s*storage\s*,\s*snapshot\s*\)/,
  ]) {
    if (!pattern.test(serviceSource)) problems.push(`service boundary is missing ${pattern}`);
  }
  const decryptAt = serviceSource.indexOf('decryptProfileTransferPayload');
  const parseAt = serviceSource.lastIndexOf('parsePayload');
  const replaceAt = serviceSource.lastIndexOf('replaceVaultEntries');
  if (!(decryptAt >= 0 && parseAt > decryptAt && replaceAt > parseAt)) {
    problems.push('import ordering is not decrypt → validate → apply');
  }
  for (const reason of [
    'PASSPHRASE_TOO_SHORT',
    'INVALID_BASE64',
    'TRUNCATED_ENVELOPE',
    'PAYLOAD_TOO_LARGE',
    'UNSUPPORTED_ENVELOPE_VERSION',
    'CRYPTOGRAPHIC_VALIDATION_FAILED',
    'MALFORMED_BACKUP',
    'UNSUPPORTED_SCHEMA',
    'UNSUPPORTED_VERSION',
    'APPLY_FAILED_NO_MUTATION',
    'APPLY_FAILED_ROLLED_BACK',
    'APPLY_FAILED_ROLLBACK_FAILED',
  ]) {
    if (!serviceStrings.has(reason)) problems.push(`service refusal taxonomy is missing ${reason}`);
  }
  if (/\bconsole\s*\.|\bShare\s*\.|\bClipboard\s*\.|writeAsStringAsync\s*\(/.test(serviceSource)) {
    problems.push('service has a logging or plaintext-capable external sink');
  }
  clauses.push('service decrypts, validates duplicates/scope, then snapshot-writes-verifies with a verified rollback result');

  const screenSource = sources.get(SCREEN)?.stripped ?? '';
  for (const pattern of [
    /createEncryptedVaultExport\s*\(\s*passphrase\s*\)/,
    /setEncryptedExport\s*\(\s*envelope\s*\)/,
    /importEncryptedVaultExport\s*\(\s*importEnvelope\s*,\s*passphrase/,
    /value\s*=\s*\{\s*encryptedExport\s*\}/,
    /secureTextEntry/,
  ]) {
    if (!pattern.test(screenSource)) problems.push(`screen is missing encrypted-only surface pattern ${pattern}`);
  }
  if (/keyVault\s*\.\s*getEncryptedStorage|JSON\s*\.\s*stringify/.test(screenSource)) {
    problems.push('screen reaches plaintext vault/payload construction instead of the service envelope');
  }

  const enKeys = objectKeys(EN);
  const arKeys = objectKeys(AR);
  const screenHebrew = hebrewStrings(SCREEN, sources.get(SCREEN)?.raw ?? '');
  for (const key of screenHebrew) {
    if (!enKeys.has(key)) problems.push(`English translation is absent for ${JSON.stringify(key)}`);
    if (!arKeys.has(key)) problems.push(`Arabic translation is absent for ${JSON.stringify(key)}`);
  }
  if (!hasTypedRoute(readFileSync(ROUTE_TYPES, 'utf8'))) problems.push('MoreStackParamList has no VaultExportImport route');
  if (!hasStackRegistration(readFileSync(MORE_STACK, 'utf8'))) problems.push('MoreStack does not register VaultExportImportScreen');
  if (!hasSettingsEntry(readFileSync(SETTINGS, 'utf8'))) problems.push('Settings has no additive VaultExportImport entry');
  clauses.push(`${screenHebrew.size} Hebrew surface string(s) have English and Arabic entries; route is typed, registered, and additive`);

  const forbiddenMocks = ['../../security/keyVault', '@noble/ciphers/aes.js', '@noble/hashes/argon2.js'];
  const suiteRaw = readFileSync(join(ROOT, SERVICE_SUITE), 'utf8');
  for (const mocked of mockedModules(join(ROOT, SERVICE_SUITE), suiteRaw)) {
    if (forbiddenMocks.includes(mocked)) problems.push(`runtime suite mocks forbidden crypto boundary ${mocked}`);
  }
  const runnerRaw = readFileSync(RUNTIME_RUNNER, 'utf8');
  const runnerSource = stripCommentsAndStrings(runnerRaw);
  if (!/return\s+originalLoad\.call\s*\(\s*this\s*,\s*request\s*,\s*parent\s*,\s*isMain\s*\)/.test(runnerSource)) {
    problems.push('runtime loader does not delegate crypto modules to Node unchanged');
  }
  clauses.push('runtime harness substitutes device-only modules, while Noble cipher and KDF load unchanged');

  const securityDiff = spawnSync('git', ['diff', '--name-only', '0161e3b', '--', 'src/security'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (securityDiff.status !== 0) problems.push('could not inspect the security scope fence');
  else {
    const changed = securityDiff.stdout.trim().split(/\r?\n/).filter(Boolean);
    if (changed.some(path => path !== 'src/security/keyVault.ts')) {
      problems.push(`security scope fence moved: ${changed.join(', ')}`);
    }
  }

  const serviceJest = requireJestCases(ROOT, SERVICE_SUITE, SERVICE_CASES, ['--runInBand']);
  const screenJest = requireJestCases(ROOT, SCREEN_SUITE, SCREEN_CASES, ['--runInBand']);
  for (const problem of serviceJest.problems) problems.push(`service runtime: ${problem}`);
  for (const problem of screenJest.problems) problems.push(`screen runtime: ${problem}`);
  clauses.push(`${SERVICE_CASES.length + SCREEN_CASES.length} named runtime cases — ${serviceJest.summary}; ${screenJest.summary}`);

  if (problems.length > 0) {
    return fail(problems.join('\n           '), {
      population: population.length + serviceJest.ran + screenJest.ran,
    });
  }
  return okOverPopulation({
    population: population.length + serviceJest.ran + screenJest.ran,
    unit: 'source/case measurement(s)',
    detail: clauses.join(' · '),
  });
};
