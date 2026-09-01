const { readFileSync } = require('node:fs');
const Module = require('node:module');
const { resolve } = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const babel = require('@babel/core');
const presetTypescript = require('@babel/preset-typescript');
const transformModulesCommonjs = require('@babel/plugin-transform-modules-commonjs');

const ROOT = resolve(__dirname, '..', '..', '..');
const originalLoad = Module._load;
let realCipherLoaded = false;
let realKdfLoaded = false;

Module._extensions['.ts'] = (module, filename) => {
  const transformed = babel.transformSync(readFileSync(filename, 'utf8'), {
    babelrc: false,
    configFile: false,
    filename,
    presets: [[presetTypescript, { allowDeclareFields: true }]],
    plugins: [transformModulesCommonjs],
    sourceMaps: false,
  });
  if (transformed?.code === undefined) {
    throw new Error('C5_RUNTIME_TYPESCRIPT_TRANSFORM_FAILED');
  }
  module._compile(transformed.code, filename);
};

class NativeMmkvPlaceholder {
  getString() {
    return undefined;
  }
  set() {}
  delete() {}
  getAllKeys() {
    return [];
  }
}

Module._load = function loadC5Dependency(request, parent, isMain) {
  if (request === '@noble/ciphers/aes.js') realCipherLoaded = true;
  if (request === '@noble/hashes/argon2.js') realKdfLoaded = true;
  if (request === 'expo-crypto') {
    return {
      getRandomBytesAsync: async size => new Uint8Array(randomBytes(size)),
      randomUUID,
    };
  }
  if (request === 'expo-secure-store') {
    return {
      getItemAsync: async () => null,
      setItemAsync: async () => undefined,
      deleteItemAsync: async () => undefined,
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    };
  }
  if (request === 'react-native-mmkv') {
    return { MMKV: NativeMmkvPlaceholder };
  }
  if (request === 'expo-sqlite') {
    return { openDatabaseSync: () => undefined };
  }
  return originalLoad.call(this, request, parent, isMain);
};

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.setFailures = new Map();
  }
  getString(key) {
    return this.values.get(key);
  }
  set(key, value) {
    const failures = this.setFailures.get(key) ?? 0;
    if (failures > 0) {
      this.setFailures.set(key, failures - 1);
      throw new Error('SIMULATED_STORAGE_WRITE_FAILURE');
    }
    this.values.set(key, String(value));
  }
  delete(key) {
    this.values.delete(key);
  }
  getAllKeys() {
    return [...this.values.keys()];
  }
  getUserProfile() {
    return undefined;
  }
  setUserProfile() {}
  failNextSets(key, count) {
    this.setFailures.set(key, count);
  }
  snapshot() {
    return Object.fromEntries(
      [...this.values.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  }
}

const bytesOfEntries = storage =>
  Object.fromEntries(
    Object.entries(storage.snapshot()).map(([key, value]) => [
      key,
      [...new TextEncoder().encode(value)],
    ]),
  );

const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

async function main() {
  const keyVaultModule = require(resolve(ROOT, 'src/security/keyVault.ts'));
  const service = require(resolve(ROOT, 'src/services/vaultExportImport.ts'));
  const { MMKV_KEYS } = require(resolve(ROOT, 'src/store/keys.ts'));
  const correctPassphrase = 'correct horse battery';
  const wrongPassphrase = 'incorrect horse key';

  const encryptedPayloadWithEntries = entries =>
    keyVaultModule.encryptProfileTransferPayload(
      JSON.stringify({
        schema: service.VAULT_EXPORT_SCHEMA,
        version: service.VAULT_EXPORT_VERSION,
        entries,
      }),
      correctPassphrase,
    );

  const source = new MemoryStorage({
    'app:active_profile_id': 'profile-אחד',
    'profile_אחד:cards': 'nul:\u0000 emoji:💳 combining:é',
    'profile_אחד:activity': '{"amount":"001.2300","currency":"₪"}',
    [MMKV_KEYS.TRANSFER_DECRYPT_ATTEMPTS]: '4',
    'profile_אחד:notif_card': 'notification-id',
    'pack:catalog': 'must-not-leave-the-vault-boundary',
  });
  const expected = new MemoryStorage({
    'app:active_profile_id': 'profile-אחד',
    'profile_אחד:cards': 'nul:\u0000 emoji:💳 combining:é',
    'profile_אחד:activity': '{"amount":"001.2300","currency":"₪"}',
  });
  const encrypted = await service.createEncryptedVaultExport(correctPassphrase, source);
  const decrypted = JSON.parse(
    await keyVaultModule.decryptProfileTransferPayload(encrypted, correctPassphrase),
  );
  const emptyTarget = new MemoryStorage();
  const roundTripResult = await service.importEncryptedVaultExport(
    encrypted,
    correctPassphrase,
    emptyTarget,
  );

  const refusalTarget = new MemoryStorage({ 'app:before': 'unchanged' });
  const wrongPassphraseResult = await service.importEncryptedVaultExport(
    encrypted,
    wrongPassphrase,
    refusalTarget,
  );
  const invalidBase64Result = await service.importEncryptedVaultExport(
    'not base64',
    correctPassphrase,
    refusalTarget,
  );
  const truncatedResult = await service.importEncryptedVaultExport(
    'Ag==',
    correctPassphrase,
    refusalTarget,
  );

  let shortExport = 'NO_REFUSAL';
  try {
    await keyVaultModule.encryptProfileTransferPayload('plaintext', 'short');
  } catch (error) {
    shortExport = error instanceof Error ? error.message : 'NON_ERROR_REFUSAL';
  }
  let astralShortExport = 'NO_REFUSAL';
  try {
    await keyVaultModule.encryptProfileTransferPayload('plaintext', '😀😀😀😀😀😀');
  } catch (error) {
    astralShortExport = error instanceof Error ? error.message : 'NON_ERROR_REFUSAL';
  }
  const shortImport = await service.importEncryptedVaultExport(
    encrypted,
    'short',
    new MemoryStorage(),
  );
  const legacyBytes = Buffer.from(encrypted, 'base64');
  legacyBytes[0] = 1;
  const versionOne = await service.importEncryptedVaultExport(
    legacyBytes.toString('base64'),
    correctPassphrase,
    new MemoryStorage(),
  );
  const truncatedVersionOne = await service.importEncryptedVaultExport(
    'AQ==',
    correctPassphrase,
    new MemoryStorage(),
  );
  const oversized = await service.importEncryptedVaultExport(
    'A'.repeat(65_540),
    correctPassphrase,
    new MemoryStorage(),
  );

  const duplicatePayload = await encryptedPayloadWithEntries([
    { key: 'app:duplicate', value: 'first' },
    { key: 'app:duplicate', value: 'second' },
  ]);
  const duplicateTarget = new MemoryStorage({ 'app:before': 'untouched' });
  const duplicateResult = await service.importEncryptedVaultExport(
    duplicatePayload,
    correctPassphrase,
    duplicateTarget,
  );

  const replacement = await encryptedPayloadWithEntries([
    { key: 'app:after', value: 'new-value' },
  ]);
  const restoredTarget = new MemoryStorage({ 'app:before': 'old-value' });
  restoredTarget.failNextSets('app:after', 1);
  const restoredResult = await service.importEncryptedVaultExport(
    replacement,
    correctPassphrase,
    restoredTarget,
  );
  const failedTarget = new MemoryStorage({ 'app:before': 'old-value' });
  failedTarget.failNextSets('app:after', 1);
  failedTarget.failNextSets('app:before', 1);
  const restoreFailedResult = await service.importEncryptedVaultExport(
    replacement,
    correctPassphrase,
    failedTarget,
  );

  process.stdout.write(JSON.stringify({
    realCipherLoaded,
    realKdfLoaded,
    roundTrip: {
      result: roundTripResult,
      byteFaithful: sameJson(bytesOfEntries(emptyTarget), bytesOfEntries(expected)),
      onlyExpectedKeys: sameJson(
        decrypted.entries.map(entry => entry.key).sort(),
        Object.keys(expected.snapshot()).sort(),
      ),
      envelopeOpaque: !encrypted.includes('profile_אחד') && !encrypted.includes('001.2300'),
    },
    refusals: {
      wrongPassphrase: wrongPassphraseResult,
      invalidBase64: invalidBase64Result,
      truncated: truncatedResult,
      shortExport,
      astralShortExport,
      shortImport,
      versionOne,
      truncatedVersionOne,
      oversized,
      targetUnchanged: sameJson(refusalTarget.snapshot(), { 'app:before': 'unchanged' }),
    },
    duplicate: {
      result: duplicateResult,
      targetUnchanged: sameJson(duplicateTarget.snapshot(), { 'app:before': 'untouched' }),
    },
    rollback: {
      restored: restoredResult,
      snapshotVerified: sameJson(restoredTarget.snapshot(), { 'app:before': 'old-value' }),
      restoreFailed: restoreFailedResult,
      failureWasNotMisreported:
        restoreFailedResult.reason === 'APPLY_FAILED_ROLLBACK_FAILED' &&
        !sameJson(failedTarget.snapshot(), { 'app:before': 'old-value' }),
    },
  }));
}

main().catch(error => {
  process.stderr.write(
    error instanceof Error ? error.name + ': ' + error.message : 'C5_RUNTIME_FAILED',
  );
  process.exitCode = 1;
});
