/**
 * GATE: store-split — criterion B3.  →  `STORE-SPLIT OK`
 *
 *   > **B3.** *"Two stores, one adapter over both: encrypted MMKV for the user vault;
 *   > SQLCipher-class SQLite for imported pack tables. **Pack tables are provably not in MMKV;
 *   > vault rows provably not in the pack store.**"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "PROVABLY NOT" IS A CLAIM ABOUT EVERY MODULE, WHICH IS WHY IT IS A GATE
 *
 * A test can show the pack store refuses a vault key when asked. It cannot show that no OTHER
 * module writes pack data into MMKV, because that module is one the test never imports. So:
 *
 *   1. **Exactly one module opens each store.** Two SQLite openers is two schemas; two encrypted
 *      MMKV openers is two key derivations, and the second one will differ.
 *   2. **The vault module never imports SQLite. The pack module never imports MMKV.** Directly
 *      checked, both directions, because "provably not" has two halves and only checking one is how
 *      half a claim ships.
 *   3. **The pack store refuses vault keys at runtime**, not only by convention. A store that would
 *      accept one if asked is a store where one eventually lands.
 *   4. **The vault key prefixes the pack store refuses match the vault's own key namespace.** Two
 *      lists of the same thing is the defect class this campaign keeps meeting; if the vault adds a
 *      prefix and the refusal list does not learn it, the refusal has a hole shaped exactly like the
 *      newest kind of user data.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY TWO STORES AT ALL, since a gate that cannot say this is enforcing a preference
 *
 * They have opposite lifetimes. A pack is replaceable — signed, superseded, and safely dropped
 * whole. The vault is irreplaceable: nobody can reissue the corrections a person made about their
 * own card. One store means one recovery path, and the day somebody clears a corrupt import they
 * clear the overrides with it.
 *
 * That is also what makes B4 provable rather than merely tested: the override is not in the pack
 * store, so a pack update has nothing of the user's to overwrite.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['B3'];
export const SENTINEL = 'STORE-SPLIT OK';

const PACK_STORE = 'src/store/packStore.ts';
const VAULT = 'src/security/keyVault.ts';
const ADAPTER = 'src/store/storeAdapter.ts';
const VAULT_KEYS = 'src/store/keys.ts';

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => {
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, b, c) => b + blank(c));
};

const lineAt = (code, i) => code.slice(0, i).split('\n').length;

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  for (const rel of [PACK_STORE, VAULT, ADAPTER]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — B3 asks for two stores and one adapter');
  }
  const packSrc = stripComments(readFileSync(join(root, PACK_STORE), 'utf8'));
  const vaultSrc = stripComments(readFileSync(join(root, VAULT), 'utf8'));

  // ── 1. exactly one opener each ───────────────────────────────────────────────────
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');

  const sqliteOpeners = [];
  const encryptedMmkvOpeners = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));
    for (const m of code.matchAll(/openDatabaseSync\s*\(|openDatabaseAsync\s*\(/g)) {
      sqliteOpeners.push({ file: rel, line: lineAt(code, m.index) });
    }
    for (const m of code.matchAll(/new MMKV\s*\(\s*\{([^}]*)\}/g)) {
      if (/encryptionKey/.test(m[1])) encryptedMmkvOpeners.push({ file: rel, line: lineAt(code, m.index) });
    }
  }

  const sqliteOutside = sqliteOpeners.filter((o) => o.file !== PACK_STORE);
  const mmkvOutside = encryptedMmkvOpeners.filter((o) => o.file !== VAULT);
  if (sqliteOpeners.length === 0) problems.push('nothing opens a SQLite database — B3 asks for a pack store');
  if (encryptedMmkvOpeners.length === 0) problems.push('nothing opens an encrypted MMKV — B3 asks for a vault store');
  for (const o of sqliteOutside) {
    problems.push(o.file + ':' + o.line + ' opens a SQLite database outside ' + PACK_STORE
      + '. Two openers is two schemas, and the second will differ from the first');
  }
  for (const o of mmkvOutside) {
    problems.push(o.file + ':' + o.line + ' opens an encrypted MMKV outside ' + VAULT
      + '. Two openers is two key derivations, and a second derivation is a second vault');
  }
  lines.push('pack store      ' + PACK_STORE + ' · ' + sqliteOpeners.length + ' SQLite opener(s), '
    + sqliteOutside.length + ' outside it');
  lines.push('vault store     ' + VAULT + ' · ' + encryptedMmkvOpeners.length
    + ' encrypted MMKV opener(s), ' + mmkvOutside.length + ' outside it');

  // ── 2. neither store imports the other's technology ──────────────────────────────
  if (/from 'expo-sqlite'/.test(vaultSrc)) {
    problems.push(VAULT + ' imports expo-sqlite. The vault is not a pack table; the two have '
      + 'different lifetimes and must not share a driver');
  }
  if (/from 'react-native-mmkv'/.test(packSrc)) {
    problems.push(PACK_STORE + ' imports react-native-mmkv. Pack tables are provably not in MMKV — '
      + 'that is the half of B3 this direction proves');
  }
  lines.push('separation      vault ↛ SQLite · pack store ↛ MMKV');

  // ── 3. the pack store refuses vault keys at runtime ──────────────────────────────
  const refuses = /throw new VaultKeyInPackStoreError/.test(packSrc);
  const refusesInPut = /putPackRow[\s\S]{0,200}?VaultKeyInPackStoreError/.test(packSrc);
  const refusesInReplace = /replacePackSet[\s\S]{0,400}?VaultKeyInPackStoreError/.test(packSrc);
  if (!refuses) {
    problems.push(PACK_STORE + ' has no runtime refusal for a vault key. B3 says vault rows are '
      + 'PROVABLY not here, and a store that would accept one if asked is a store where one lands');
  }
  if (!refusesInPut || !refusesInReplace) {
    problems.push(PACK_STORE + ' refuses vault keys on ' + (refusesInPut ? 'put' : 'replace')
      + ' but not the other. Both are write paths, and an import uses the one that is missing');
  }
  lines.push('refusal         runtime, on both write paths (single row and whole set)');

  // ── 4. the refusal list agrees with the vault's key namespace ────────────────────
  const prefixes = packSrc.match(/VAULT_KEY_PREFIXES\s*=\s*\[([^\]]*)\]/);
  const refused = prefixes ? [...prefixes[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  if (refused.length === 0) {
    problems.push(PACK_STORE + ' declares no vault key prefixes — a refusal that refuses nothing');
  }
  if (existsSync(join(root, VAULT_KEYS))) {
    const keysSrc = stripComments(readFileSync(join(root, VAULT_KEYS), 'utf8'));
    // EVERY KEY LITERAL AND EVERY TEMPLATE the vault module produces — not a guessed shape.
    //
    // The first version matched `'word.something'` and found ZERO, because the vault keys
    // everything under `app:` and `profile_`. It reported the zero, which is how the refusal list
    // in the pack store was discovered to describe a namespace that has never existed.
    const declared = [
      ...[...keysSrc.matchAll(/'([A-Za-z][\w]*[:_][^']*)'/g)].map((m) => m[1]),
      ...[...keysSrc.matchAll(/`([A-Za-z][\w]*[:_][^`]*)`/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, '*')),
    ];
    const uncovered = declared.filter((k) => !refused.some((p) => k.startsWith(p)));
    // Reported, not failed: the vault's key module also carries keys that are not user data.
    lines.push('key namespace   ' + refused.length + ' refused prefix(es) · ' + declared.length
      + ' vault key(s) declared · ' + uncovered.length + ' not matched by a prefix');
    if (declared.length === 0) {
      problems.push('parsed ZERO vault keys out of ' + VAULT_KEYS + '. The parity half of this check '
        + 'cannot compare two lists when it can only read one, and a refusal nothing compares is a '
        + 'refusal that can describe a namespace which has never existed — which is exactly what it '
        + 'did describe when this check first reported zero');
    }
    for (const k of uncovered.slice(0, 4)) {
      problems.push('the vault key "' + k + '" matches no prefix the pack store refuses. A pack '
        + 'import carrying it would be accepted, written, and replaced on the next update — which is '
        + 'the user’s data destroyed by a mechanism B3 exists to make impossible');
    }
  }

  // ── the adapter reads both ───────────────────────────────────────────────────────
  const adapterSrc = stripComments(readFileSync(join(root, ADAPTER), 'utf8'));
  if (!/getPackRow/.test(adapterSrc) || !/readOverride/.test(adapterSrc)) {
    problems.push(ADAPTER + ' does not read both stores — B3 asks for ONE adapter over both');
  }
  lines.push('adapter         ' + ADAPTER + ' · reads the vault and the pack store, merges at read');

  lines.push('');
  lines.push('NOT PROVEN HERE that SQLCipher encrypted the database file. That is a native build');
  lines.push('                variant, JavaScript cannot see which binary it opened, and criterion');
  lines.push('                B2 asks for it on a device with a captured artifact. The pack store');
  lines.push('                says so itself rather than returning a boolean that reads as a fact.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
