import {
  decryptProfileTransferPayload,
  encryptProfileTransferPayload,
  keyVault,
  type EncryptedStorageHandle,
} from '../security/keyVault';
import { MMKV_KEYS } from '../store/keys';
import { isVaultKey } from '../store/packStore';

export const VAULT_EXPORT_SCHEMA = 'smartcard.local-vault-export';
export const VAULT_EXPORT_VERSION = 1;

interface VaultExportEntry {
  readonly key: string;
  readonly value: string;
}

interface VaultExportPayload {
  readonly schema: typeof VAULT_EXPORT_SCHEMA;
  readonly version: typeof VAULT_EXPORT_VERSION;
  readonly entries: readonly VaultExportEntry[];
}

export type VaultImportFailureReason =
  | 'PASSPHRASE_TOO_SHORT'
  | 'INVALID_BASE64'
  | 'TRUNCATED_ENVELOPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_ENVELOPE_VERSION'
  | 'CRYPTOGRAPHIC_VALIDATION_FAILED'
  | 'MALFORMED_BACKUP'
  | 'UNSUPPORTED_SCHEMA'
  | 'UNSUPPORTED_VERSION'
  | 'APPLY_FAILED_NO_MUTATION'
  | 'APPLY_FAILED_ROLLED_BACK'
  | 'APPLY_FAILED_ROLLBACK_FAILED';

export type VaultImportResult =
  | { readonly ok: true; readonly importedKeys: number }
  | { readonly ok: false; readonly reason: VaultImportFailureReason };

const TRANSIENT_VAULT_KEYS = new Set<string>([
  MMKV_KEYS.globalDiscountReminderId,
  MMKV_KEYS.TRANSFER_DECRYPT_ATTEMPTS,
  MMKV_KEYS.TRANSFER_DECRYPT_LOCKOUT_UNTIL,
]);

function shouldIncludeVaultKey(key: string): boolean {
  return (
    isVaultKey(key) &&
    !TRANSIENT_VAULT_KEYS.has(key) &&
    !key.includes(':notif_')
  );
}

function readVaultEntries(
  storage: EncryptedStorageHandle,
): VaultExportEntry[] {
  const entries: VaultExportEntry[] = [];
  for (const key of storage.getAllKeys().filter(shouldIncludeVaultKey)) {
    const value = storage.getString(key);
    if (value === undefined) {
      throw new Error('VAULT_EXPORT_NON_STRING_VALUE');
    }
    entries.push({ key, value });
  }
  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePayload(
  plaintext: string,
):
  | { readonly ok: true; readonly payload: VaultExportPayload }
  | {
      readonly ok: false;
      readonly reason:
        | 'MALFORMED_BACKUP'
        | 'UNSUPPORTED_SCHEMA'
        | 'UNSUPPORTED_VERSION';
    } {
  let value: unknown;
  try {
    value = JSON.parse(plaintext);
  } catch {
    return { ok: false, reason: 'MALFORMED_BACKUP' };
  }

  if (!isRecord(value)) {
    return { ok: false, reason: 'MALFORMED_BACKUP' };
  }
  if (value.schema !== VAULT_EXPORT_SCHEMA) {
    return { ok: false, reason: 'UNSUPPORTED_SCHEMA' };
  }
  if (value.version !== VAULT_EXPORT_VERSION) {
    return { ok: false, reason: 'UNSUPPORTED_VERSION' };
  }
  if (!Array.isArray(value.entries)) {
    return { ok: false, reason: 'MALFORMED_BACKUP' };
  }

  const seen = new Set<string>();
  const entries: VaultExportEntry[] = [];
  for (const candidate of value.entries) {
    if (
      !isRecord(candidate) ||
      typeof candidate.key !== 'string' ||
      typeof candidate.value !== 'string' ||
      !shouldIncludeVaultKey(candidate.key) ||
      seen.has(candidate.key)
    ) {
      return { ok: false, reason: 'MALFORMED_BACKUP' };
    }
    seen.add(candidate.key);
    entries.push({ key: candidate.key, value: candidate.value });
  }

  return {
    ok: true,
    payload: {
      schema: VAULT_EXPORT_SCHEMA,
      version: VAULT_EXPORT_VERSION,
      entries,
    },
  };
}

function entriesMatch(
  actual: readonly VaultExportEntry[],
  expected: readonly VaultExportEntry[],
): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  const expectedByKey = new Map(
    expected.map((entry): readonly [string, string] => [entry.key, entry.value]),
  );
  return actual.every(
    entry => expectedByKey.get(entry.key) === entry.value,
  );
}

function deleteVaultEntries(storage: EncryptedStorageHandle): void {
  for (const key of storage.getAllKeys().filter(shouldIncludeVaultKey)) {
    storage.delete(key);
  }
}

function writeVaultEntries(
  storage: EncryptedStorageHandle,
  entries: readonly VaultExportEntry[],
): void {
  for (const entry of entries) {
    storage.set(entry.key, entry.value);
  }
}

function restoreSnapshot(
  storage: EncryptedStorageHandle,
  snapshot: readonly VaultExportEntry[],
): boolean {
  try {
    deleteVaultEntries(storage);
    writeVaultEntries(storage, snapshot);
    return entriesMatch(readVaultEntries(storage), snapshot);
  } catch {
    return false;
  }
}

function replaceVaultEntries(
  storage: EncryptedStorageHandle,
  entries: readonly VaultExportEntry[],
): VaultImportResult {
  let snapshot: readonly VaultExportEntry[];
  try {
    snapshot = readVaultEntries(storage);
  } catch {
    return { ok: false, reason: 'APPLY_FAILED_NO_MUTATION' };
  }

  try {
    deleteVaultEntries(storage);
    writeVaultEntries(storage, entries);
    if (!entriesMatch(readVaultEntries(storage), entries)) {
      throw new Error('VAULT_IMPORT_APPLY_VERIFICATION_FAILED');
    }
    return { ok: true, importedKeys: entries.length };
  } catch {
    return restoreSnapshot(storage, snapshot)
      ? { ok: false, reason: 'APPLY_FAILED_ROLLED_BACK' }
      : { ok: false, reason: 'APPLY_FAILED_ROLLBACK_FAILED' };
  }
}

function errorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  return isRecord(error) && typeof error.message === 'string'
    ? error.message
    : undefined;
}

function isPayloadTooLarge(error: unknown): boolean {
  return isRecord(error) && error.type === 'PAYLOAD_TOO_LARGE';
}

function classifyDecryptionFailure(
  error: unknown,
  encodedPayload: string,
): VaultImportFailureReason {
  if (isPayloadTooLarge(error)) {
    return 'PAYLOAD_TOO_LARGE';
  }

  const message = errorMessage(error);
  if (message === 'TRANSFER_PASSPHRASE_TOO_SHORT') {
    return 'PASSPHRASE_TOO_SHORT';
  }
  if (message === 'UNSUPPORTED_TRANSFER_ENVELOPE_VERSION_1') {
    return 'UNSUPPORTED_ENVELOPE_VERSION';
  }
  /**
   * THE ENVELOPE'S OWN GEOMETRY IS NOT RE-DERIVED HERE.
   *
   * This mapped keyVault's single INVALID_TRANSFER_PAYLOAD onto three outcomes by re-implementing
   * base64 length arithmetic and comparing against a literal 45 - which is
   * `1 + TRANSFER_SALT_BYTES + TRANSFER_NONCE_BYTES + TRANSFER_TAG_BYTES` written out a second
   * time, in a module that owns none of those four numbers. If any of them ever moved, this file
   * would have gone on classifying against the old shape and said so confidently.
   *
   * keyVault now names each refusal, so this is a mapping rather than a guess.
   */
  if (message === 'TRUNCATED_TRANSFER_ENVELOPE') {
    return 'TRUNCATED_ENVELOPE';
  }
  if (message === 'UNSUPPORTED_TRANSFER_ENVELOPE_VERSION') {
    return 'UNSUPPORTED_ENVELOPE_VERSION';
  }
  if (message === 'INVALID_TRANSFER_PAYLOAD') {
    return 'INVALID_BASE64';
  }
  return 'CRYPTOGRAPHIC_VALIDATION_FAILED';
}

export async function createEncryptedVaultExport(
  transferPassphrase: string,
  storage: EncryptedStorageHandle = keyVault.getEncryptedStorage(),
): Promise<string> {
  const payload: VaultExportPayload = {
    schema: VAULT_EXPORT_SCHEMA,
    version: VAULT_EXPORT_VERSION,
    entries: readVaultEntries(storage),
  };
  return encryptProfileTransferPayload(
    JSON.stringify(payload),
    transferPassphrase,
  );
}

export async function importEncryptedVaultExport(
  encodedPayload: string,
  transferPassphrase: string,
  storage: EncryptedStorageHandle = keyVault.getEncryptedStorage(),
): Promise<VaultImportResult> {
  let plaintext: string;
  try {
    plaintext = await decryptProfileTransferPayload(
      encodedPayload,
      transferPassphrase,
    );
  } catch (error) {
    return {
      ok: false,
      reason: classifyDecryptionFailure(error, encodedPayload),
    };
  }

  const parsed = parsePayload(plaintext);
  if (!parsed.ok) {
    return parsed;
  }
  return replaceVaultEntries(storage, parsed.payload.entries);
}
