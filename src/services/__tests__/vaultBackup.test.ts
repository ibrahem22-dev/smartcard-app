const storage = new Map<string, string>();
let failNextSetFor: string | null = null;

jest.mock('../../security/keyVault', () => ({
  encryptProfileTransferPayload: jest.fn(
    async (plaintext: string): Promise<string> => `cipher:${plaintext}`,
  ),
  decryptProfileTransferPayload: jest.fn(
    async (ciphertext: string): Promise<string> => {
      if (!ciphertext.startsWith('cipher:')) {
        throw new Error('BAD_TAG');
      }
      return ciphertext.slice('cipher:'.length);
    },
  ),
  keyVault: {
    getEncryptedStorage: () => ({
      getString: (key: string): string | undefined => storage.get(key),
      getAllKeys: (): readonly string[] => [...storage.keys()],
      delete: (key: string): void => {
        storage.delete(key);
      },
      set: (key: string, value: string | number | boolean): void => {
        if (failNextSetFor === key) {
          failNextSetFor = null;
          throw new Error('INJECTED_WRITE_FAILURE');
        }
        storage.set(key, String(value));
      },
    }),
  },
}));

import {
  createEncryptedVaultBackup,
  importEncryptedVaultBackup,
} from '../vaultBackup';

describe('encrypted whole-vault backup', () => {
  beforeEach(() => {
    storage.clear();
    failNextSetFor = null;
  });

  test('encrypts before export and excludes OS notification identifiers', async () => {
    storage.set('profile_1:user', '{"income":12000}');
    storage.set('profile_1:notif_card', 'os-schedule-id');
    storage.set('app:language_preference', 'he');

    const encrypted = await createEncryptedVaultBackup(
      '1234',
      '2026-08-31T00:00:00.000Z',
    );

    expect(encrypted.startsWith('cipher:')).toBe(true);
    expect(encrypted).toContain('profile_1:user');
    expect(encrypted).not.toContain('os-schedule-id');
  });

  test('refuses corrupt ciphertext without changing the vault', async () => {
    storage.set('profile_1:user', 'before');

    const result = await importEncryptedVaultBackup('corrupt', '1234');

    expect(result).toEqual({ ok: false, reason: 'CRYPTOGRAPHIC_VALIDATION_FAILED' });
    expect(storage.get('profile_1:user')).toBe('before');
  });

  test('refuses an unsupported version without changing the vault', async () => {
    storage.set('profile_1:user', 'before');
    const payload = JSON.stringify({
      schema: 'smartcard.local-vault-backup',
      version: 99,
      createdAt: '2026-08-31T00:00:00.000Z',
      appVersion: '1.1.0',
      entries: [],
    });

    const result = await importEncryptedVaultBackup(`cipher:${payload}`, '1234');

    expect(result).toEqual({ ok: false, reason: 'UNSUPPORTED_VERSION' });
    expect(storage.get('profile_1:user')).toBe('before');
  });

  test('rolls back all keys if applying a validated backup fails', async () => {
    storage.set('profile_1:user', 'before');
    storage.set('app:language_preference', 'he');
    const payload = JSON.stringify({
      schema: 'smartcard.local-vault-backup',
      version: 1,
      createdAt: '2026-08-31T00:00:00.000Z',
      appVersion: '1.1.0',
      entries: [
        { key: 'profile_1:user', value: 'after' },
        { key: 'app:language_preference', value: 'en' },
      ],
    });
    failNextSetFor = 'profile_1:user';

    const result = await importEncryptedVaultBackup(`cipher:${payload}`, '1234');

    expect(result).toEqual({ ok: false, reason: 'APPLY_FAILED_ROLLED_BACK' });
    expect(storage.get('profile_1:user')).toBe('before');
    expect(storage.get('app:language_preference')).toBe('he');
  });
});

