import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

interface RuntimeProof {
  readonly realCipherLoaded: boolean;
  readonly realKdfLoaded: boolean;
  readonly roundTrip: {
    readonly result: unknown;
    readonly byteFaithful: boolean;
    readonly onlyExpectedKeys: boolean;
    readonly envelopeOpaque: boolean;
  };
  readonly refusals: {
    readonly wrongPassphrase: unknown;
    readonly invalidBase64: unknown;
    readonly truncated: unknown;
    readonly shortExport: string;
    readonly astralShortExport: string;
    readonly shortImport: unknown;
    readonly versionOne: unknown;
    readonly truncatedVersionOne: unknown;
    readonly oversized: unknown;
    readonly targetUnchanged: boolean;
  };
  readonly duplicate: {
    readonly result: unknown;
    readonly targetUnchanged: boolean;
  };
  readonly rollback: {
    readonly restored: unknown;
    readonly snapshotVerified: boolean;
    readonly restoreFailed: unknown;
    readonly failureWasNotMisreported: boolean;
  };
}

jest.setTimeout(60_000);

const runner = join(
  __dirname,
  '..',
  '..',
  '..',
  'tools',
  'mdc',
  'gates',
  'export-import-runtime.cjs',
);

let proof: RuntimeProof;

beforeAll(() => {
  proof = JSON.parse(
    execFileSync(process.execPath, [runner], {
      cwd: join(__dirname, '..', '..', '..'),
      encoding: 'utf8',
      timeout: 55_000,
    }),
  ) as RuntimeProof;
});

describe('vault export and import', () => {
  it('round-trips the real encrypted envelope into an empty vault byte-faithfully', () => {
    expect(proof.realCipherLoaded).toBe(true);
    expect(proof.realKdfLoaded).toBe(true);
    expect(proof.roundTrip).toEqual({
      result: { ok: true, importedKeys: 3 },
      byteFaithful: true,
      onlyExpectedKeys: true,
      envelopeOpaque: true,
    });
  });

  it('refuses a wrong passphrase separately from malformed and truncated exports', () => {
    expect(proof.refusals).toMatchObject({
      wrongPassphrase: {
        ok: false,
        reason: 'CRYPTOGRAPHIC_VALIDATION_FAILED',
      },
      invalidBase64: { ok: false, reason: 'INVALID_BASE64' },
      truncated: { ok: false, reason: 'TRUNCATED_ENVELOPE' },
      targetUnchanged: true,
    });
  });

  it('refuses a below-floor passphrase, a version-1 envelope, and an oversized payload', () => {
    expect(proof.refusals).toMatchObject({
      shortExport: 'TRANSFER_PASSPHRASE_TOO_SHORT',
      astralShortExport: 'TRANSFER_PASSPHRASE_TOO_SHORT',
      shortImport: { ok: false, reason: 'PASSPHRASE_TOO_SHORT' },
      versionOne: {
        ok: false,
        reason: 'UNSUPPORTED_ENVELOPE_VERSION',
      },
      /**
       * ONE BYTE IS NOT AN OLD ENVELOPE, IT IS A DAMAGED FILE.
       *
       * This case is the string 'AQ==' - base64 for the single byte 0x01. It was pinned as
       * UNSUPPORTED_ENVELOPE_VERSION because byte 0 reads as 1, and the supervisor changed the
       * refusal order in keyVault so that length is judged before version. A buffer too short to
       * be an envelope has no version field to read: treating byte 0 as authoritative there is
       * reading a field out of something that is not the structure it claims to be.
       *
       * It also matters for what the user is told. The Owner ruling records that
       * encryptProfileTransferPayload has no callers, so no version-1 envelope exists anywhere -
       * which means a short buffer starting 0x01 is corruption, and 'this is an old format'
       * would send someone hunting for a migration that was never needed. The well-formed
       * `versionOne` case below still meets the ruling's clause-4 refusal, which is the one the
       * Owner actually required.
       */
      truncatedVersionOne: {
        ok: false,
        reason: 'TRUNCATED_ENVELOPE',
      },
      oversized: { ok: false, reason: 'PAYLOAD_TOO_LARGE' },
    });
  });

  it('rejects duplicate vault keys before the first storage mutation', () => {
    expect(proof.duplicate).toEqual({
      result: { ok: false, reason: 'MALFORMED_BACKUP' },
      targetUnchanged: true,
    });
  });

  it('verifies apply, verifies rollback, and reports rollback failure truthfully', () => {
    expect(proof.rollback).toEqual({
      restored: { ok: false, reason: 'APPLY_FAILED_ROLLED_BACK' },
      snapshotVerified: true,
      restoreFailed: {
        ok: false,
        reason: 'APPLY_FAILED_ROLLBACK_FAILED',
      },
      failureWasNotMisreported: true,
    });
  });
});
