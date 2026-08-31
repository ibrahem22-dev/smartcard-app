import { APP_IDENTITY } from '../config/identity';
import {
  decryptProfileTransferPayload,
  encryptProfileTransferPayload,
  keyVault,
} from '../security/keyVault';
import type { EncryptedStorageHandle } from '../security/keyVault.types';
import { MMKV_KEYS } from '../store/keys';

export const VAULT_BACKUP_SCHEMA = 'smartcard.local-vault-backup';
export const VAULT_BACKUP_VERSION = 1;

interface VaultBackupEntry {
  readonly key: string;
  readonly value: string;
}

interface VaultBackupPayload {
  readonly schema: typeof VAULT_BACKUP_SCHEMA;
  readonly version: typeof VAULT_BACKUP_VERSION;
  readonly createdAt: string;
  readonly appVersion: string;
  readonly entries: readonly VaultBackupEntry[];
}

export type VaultBackupImportResult =
  | { readonly ok: true; readonly importedKeys: number }
  | {
      readonly ok: false;
      readonly reason:
        | 'CRYPTOGRAPHIC_VALIDATION_FAILED'
        | 'MALFORMED_BACKUP'
        | 'UNSUPPORTED_SCHEMA'
        | 'UNSUPPORTED_VERSION'
        | 'APPLY_FAILED_ROLLED_BACK';
    };

const TRANSIENT_KEYS = new Set<string>([
  MMKV_KEYS.globalDiscountReminderId,
  MMKV_KEYS.TRANSFER_DECRYPT_ATTEMPTS,
  MMKV_KEYS.TRANSFER_DECRYPT_LOCKOUT_UNTIL,
]);

function isExportableKey(key: string): boolean {
  return (
    (key.startsWith('app:') || key.startsWith('profile_')) &&
    !TRANSIENT_KEYS.has(key) &&
    !key.includes(':notif_')
  );
}

function readEntries(storage: EncryptedStorageHandle): VaultBackupEntry[] {
  return storage
    .getAllKeys()
    .filter(isExportableKey)
    .map((key): VaultBackupEntry | null => {
      const value = storage.getString(key);
      return value === undefined ? null : { key, value };
    })
    .filter((entry): entry is VaultBackupEntry => entry !== null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePayload(
  plaintext: string,
):
  | { readonly ok: true; readonly payload: VaultBackupPayload }
  | { readonly ok: false; readonly reason: 'MALFORMED_BACKUP' | 'UNSUPPORTED_SCHEMA' | 'UNSUPPORTED_VERSION' } {
  let value: unknown;
  try {
    value = JSON.parse(plaintext);
  } catch {
    return { ok: false, reason: 'MALFORMED_BACKUP' };
  }
  if (!isRecord(value)) {
    return { ok: false, reason: 'MALFORMED_BACKUP' };
  }
  if (value.schema !== VAULT_BACKUP_SCHEMA) {
    return { ok: false, reason: 'UNSUPPORTED_SCHEMA' };
  }
  if (value.version !== VAULT_BACKUP_VERSION) {
    return { ok: false, reason: 'UNSUPPORTED_VERSION' };
  }
  if (
    typeof value.createdAt !== 'string' ||
    typeof value.appVersion !== 'string' ||
    !Array.isArray(value.entries)
  ) {
    return { ok: false, reason: 'MALFORMED_BACKUP' };
  }
  const seen = new Set<string>();
  const entries: VaultBackupEntry[] = [];
  for (const candidate of value.entries) {
    if (
      !isRecord(candidate) ||
      typeof candidate.key !== 'string' ||
      typeof candidate.value !== 'string' ||
      !isExportableKey(candidate.key) ||
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
      schema: VAULT_BACKUP_SCHEMA,
      version: VAULT_BACKUP_VERSION,
      createdAt: value.createdAt,
      appVersion: value.appVersion,
      entries,
    },
  };
}

function replaceEntriesAtomically(
  storage: EncryptedStorageHandle,
  entries: readonly VaultBackupEntry[],
): boolean {
  const before = readEntries(storage);
  try {
    for (const key of storage.getAllKeys().filter(isExportableKey)) {
      storage.delete(key);
    }
    for (const entry of entries) {
      storage.set(entry.key, entry.value);
    }
    const after = readEntries(storage);
    if (
      after.length !== entries.length ||
      entries.some(
        (entry) =>
          !after.some(
            (actual) =>
              actual.key === entry.key && actual.value === entry.value,
          ),
      )
    ) {
      throw new Error('VAULT_BACKUP_APPLY_VERIFICATION_FAILED');
    }
    return true;
  } catch {
    try {
      for (const key of storage.getAllKeys().filter(isExportableKey)) {
        storage.delete(key);
      }
      for (const entry of before) {
        storage.set(entry.key, entry.value);
      }
    } catch {
      // The caller receives a fail-closed result. No secret or entry value is logged.
    }
    return false;
  }
}

export async function createEncryptedVaultBackup(
  transferPin: string,
  createdAt: string = new Date().toISOString(),
): Promise<string> {
  const payload: VaultBackupPayload = {
    schema: VAULT_BACKUP_SCHEMA,
    version: VAULT_BACKUP_VERSION,
    createdAt,
    appVersion: APP_IDENTITY.version,
    entries: readEntries(keyVault.getEncryptedStorage()),
  };
  return encryptProfileTransferPayload(JSON.stringify(payload), transferPin);
}

export async function importEncryptedVaultBackup(
  encryptedPayload: string,
  transferPin: string,
): Promise<VaultBackupImportResult> {
  let plaintext: string;
  try {
    plaintext = await decryptProfileTransferPayload(
      encryptedPayload.trim(),
      transferPin,
    );
  } catch {
    return { ok: false, reason: 'CRYPTOGRAPHIC_VALIDATION_FAILED' };
  }
  const parsed = parsePayload(plaintext);
  if (!parsed.ok) {
    return parsed;
  }
  return replaceEntriesAtomically(
    keyVault.getEncryptedStorage(),
    parsed.payload.entries,
  )
    ? { ok: true, importedKeys: parsed.payload.entries.length }
    : { ok: false, reason: 'APPLY_FAILED_ROLLED_BACK' };
}

