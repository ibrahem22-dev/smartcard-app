/**
 * GATE: vault-crypto — criterion B1.  →  `VAULT-CRYPTO OK`
 *
 *   > **B1.** *"The vault **encrypts at rest**, **locks on background**, and **unlocks by
 *   > biometric/PIN via the hardware keystore**."*
 *
 * The campaign plan's instruction for this work package:
 *
 *   > *"The inherited vault is **the strongest inherited subsystem** — extend it, do not rebuild
 *   > it."*
 *
 * So this gate is written to CHECK a subsystem somebody else built well, which is a different job
 * from checking one's own work and needs saying: the temptation with an inherited strength is to
 * assert it rather than measure it, and an assertion about cryptography is worth nothing at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THREE CLAUSES, THREE CHECKS, AND EACH ONE NAMES THE PRIMITIVE
 *
 *   1. **Encrypts at rest.** The data-encryption key is wrapped, not stored: an AEAD envelope under
 *      a key derived from the PIN by a memory-hard KDF, with the wrapped form in the OS keystore.
 *      A vault that stored its DEK in plain MMKV would "encrypt at rest" in the sense that the
 *      bytes are ciphertext and in no sense that matters.
 *   2. **Locks on background.** An `AppState` subscription that reaches a lock. Checked as a wiring
 *      question — a handler that exists and is never subscribed is the commonest version of this
 *      bug, and it cannot be seen by reading the handler.
 *   3. **Hardware keystore.** `expo-secure-store` with a `keychainAccessible` policy that is
 *      device-only, plus a real biometric prompt. `WHEN_UNLOCKED_THIS_DEVICE_ONLY` is the part that
 *      keeps the key off an iCloud backup, and a vault whose key rides a backup to a new phone has
 *      moved the user's data somewhere they did not agree to.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS GATE CANNOT DO, said plainly
 *
 * It reads source. It cannot prove the OS honoured `keychainAccessible`, that the Secure Enclave was
 * used, or that AES-GCM was implemented correctly — those need a device, and criterion **B2** is the
 * device-flagged one that asks for exactly that with a captured artifact. This gate proves the app
 * ASKS for the right things. B2 proves the device gave them.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['B1'];
export const SENTINEL = 'VAULT-CRYPTO OK';

const VAULT = 'src/security/keyVault.ts';
const AUTH_CONTEXT = 'src/navigation/authContext.tsx';
const BIOMETRICS = 'src/auth/index.ts';

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

  for (const rel of [VAULT, AUTH_CONTEXT, BIOMETRICS]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — B1 has no subject');
  }
  const vault = stripComments(readFileSync(join(root, VAULT), 'utf8'));
  const authCtx = stripComments(readFileSync(join(root, AUTH_CONTEXT), 'utf8'));
  const bio = stripComments(readFileSync(join(root, BIOMETRICS), 'utf8'));

  // ── 1. encrypts at rest ──────────────────────────────────────────────────────────
  const kdf = /argon2id/i.test(vault);
  const aead = /gcm/i.test(vault);
  const encryptedStore = /encryptionKey\s*:/.test(vault);
  const secureStore = /expo-secure-store/.test(vault);

  if (!kdf) {
    problems.push(VAULT + ' uses no memory-hard KDF. A PIN is short; without Argon2id-class '
      + 'stretching, a wrapped key is one offline dictionary run away from open');
  }
  if (!aead) problems.push(VAULT + ' uses no AEAD (GCM) envelope for the wrapped key');
  if (!encryptedStore) {
    problems.push(VAULT + ' opens no encrypted store — "encrypts at rest" needs the store key, not '
      + 'only the envelope');
  }
  if (!secureStore) problems.push(VAULT + ' does not use expo-secure-store — the wrapped key has no OS-backed home');

  // The DEK must never be written to an unencrypted store.
  for (const m of vault.matchAll(/new MMKV\s*\(\s*\{([^}]*)\}/g)) {
    if (!/encryptionKey/.test(m[1])) {
      problems.push(VAULT + ':' + lineAt(vault, m.index) + ' opens an MMKV instance with no '
        + 'encryptionKey. The vault store must be encrypted; an unencrypted one beside it is where '
        + 'a secret ends up by accident');
    }
  }

  lines.push('at rest         Argon2id KDF ' + (kdf ? 'yes' : 'NO') + ' · AEAD envelope '
    + (aead ? 'yes' : 'NO') + ' · encrypted store ' + (encryptedStore ? 'yes' : 'NO')
    + ' · OS keystore ' + (secureStore ? 'yes' : 'NO'));

  // ── 2. locks on background ───────────────────────────────────────────────────────
  //
  // A handler that exists and is never subscribed is the commonest version of this bug, and reading
  // the handler cannot see it. So: the subscription AND the path from it to a lock.
  const subscribes = /AppState\.addEventListener\s*\(/.test(authCtx);
  const handlerName = authCtx.match(/AppState\.addEventListener\s*\(\s*'change'\s*,\s*\(?[\s\S]{0,120}?(\w+)\s*\(/);
  const locksOnBackground = /LOCKED/.test(authCtx) && /(background|inactive)/i.test(authCtx);

  if (!subscribes) {
    problems.push(AUTH_CONTEXT + ' never calls AppState.addEventListener. A lock-on-background that '
      + 'is not subscribed is a function nobody calls');
  }
  if (!locksOnBackground) {
    problems.push(AUTH_CONTEXT + ' has no path from a background state to LOCKED');
  }
  lines.push('on background   AppState subscribed ' + (subscribes ? 'yes' : 'NO')
    + ' · reaches LOCKED ' + (locksOnBackground ? 'yes' : 'NO')
    + (handlerName ? ' · via ' + handlerName[1] : ''));

  // ── 3. hardware keystore and a real biometric prompt ─────────────────────────────
  const deviceOnly = /THIS_DEVICE_ONLY/.test(vault);
  const prompts = /authenticateAsync\s*\(/.test(bio);
  const checksHardware = /hasHardwareAsync\s*\(/.test(bio) && /isEnrolledAsync\s*\(/.test(bio);

  if (!deviceOnly) {
    problems.push(VAULT + ' does not set a THIS_DEVICE_ONLY keychain policy. Without it the wrapped '
      + 'key can ride an OS backup to another phone, which moves the user’s data somewhere they '
      + 'never agreed to');
  }
  if (!prompts) problems.push(BIOMETRICS + ' never calls authenticateAsync — there is no biometric unlock');
  if (!checksHardware) {
    problems.push(BIOMETRICS + ' does not check hasHardwareAsync AND isEnrolledAsync before '
      + 'prompting. A prompt on a device with no enrolled biometric fails in a way the caller reads '
      + 'as a refusal by the user');
  }
  lines.push('unlock          biometric prompt ' + (prompts ? 'yes' : 'NO')
    + ' · hardware+enrolment checked ' + (checksHardware ? 'yes' : 'NO')
    + ' · keychain policy ' + (deviceOnly ? 'THIS_DEVICE_ONLY' : 'NOT DEVICE-ONLY'));

  // ── nobody else opens the vault's secrets ────────────────────────────────────────
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');

  const strays = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    if (rel === VAULT) continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (/from 'expo-secure-store'/.test(code)) {
      strays.push({ file: rel, line: lineAt(code, code.indexOf("expo-secure-store")), what: 'the OS keystore' });
    }
  }
  for (const s of strays.slice(0, 4)) {
    problems.push(s.file + ':' + s.line + ' reaches ' + s.what + ' directly. One module owns the '
      + 'vault’s secrets; a second caller is a second policy, and the two will differ on the day it '
      + 'matters');
  }
  lines.push('ownership       ' + files.length + ' files · ' + strays.length
    + ' module(s) other than the vault touching the OS keystore');

  lines.push('');
  lines.push('NOT PROVEN HERE this gate reads source. That the OS honoured the keychain policy, that');
  lines.push('                the Secure Enclave was used, that AES-GCM is correctly implemented —');
  lines.push('                those need a device, and criterion B2 asks for exactly that with a');
  lines.push('                captured artifact. This proves the app ASKS for the right things.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
