import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';

import { STORAGE_NAMESPACE } from '../../../config/identity';
import type {
  InstalledPackSet,
  PackSetCandidate,
  PackSetStore,
} from './packSetImport';

const SAFE_PACK_ID = /^[a-z0-9][a-z0-9-]*$/;

function rootDirectory(): string {
  if (FileSystem.documentDirectory === null) {
    throw new Error('PACK_UPDATE_DOCUMENT_DIRECTORY_UNAVAILABLE');
  }
  return `${FileSystem.documentDirectory}${STORAGE_NAMESPACE}-pack-updates/`;
}

function pathFor(name: 'installed' | 'staging' | 'backup'): string {
  return `${rootDirectory()}${name}/`;
}

async function exists(uri: string): Promise<boolean> {
  return (await FileSystem.getInfoAsync(uri)).exists;
}

async function remove(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

async function ensureRoot(): Promise<void> {
  await FileSystem.makeDirectoryAsync(rootDirectory(), { intermediates: true });
}

function safePackId(packId: string): string {
  if (!SAFE_PACK_ID.test(packId)) {
    throw new Error('INVALID_PACK_ID');
  }
  return packId;
}

async function writeCandidate(
  directory: string,
  candidate: PackSetCandidate,
): Promise<void> {
  const packId = safePackId(candidate.packId);
  const packDirectory = `${directory}${packId}/`;
  await FileSystem.makeDirectoryAsync(packDirectory, { intermediates: true });
  await FileSystem.writeAsStringAsync(
    `${packDirectory}manifest.json`,
    JSON.stringify(candidate.manifest),
    { encoding: FileSystem.EncodingType.UTF8 },
  );
  await FileSystem.writeAsStringAsync(
    `${packDirectory}manifest.sig.json`,
    JSON.stringify(candidate.envelope),
    { encoding: FileSystem.EncodingType.UTF8 },
  );
  await FileSystem.writeAsStringAsync(
    `${packDirectory}pack.json`,
    Buffer.from(candidate.packBytes).toString('base64'),
    { encoding: FileSystem.EncodingType.UTF8 },
  );
}

async function readCandidates(
  directory: string,
): Promise<readonly PackSetCandidate[]> {
  if (!(await exists(directory))) return [];
  const packIds = await FileSystem.readDirectoryAsync(directory);
  const candidates: PackSetCandidate[] = [];
  for (const rawPackId of packIds) {
    const packId = safePackId(rawPackId);
    const packDirectory = `${directory}${packId}/`;
    const [manifest, envelope, body] = await Promise.all([
      FileSystem.readAsStringAsync(`${packDirectory}manifest.json`),
      FileSystem.readAsStringAsync(`${packDirectory}manifest.sig.json`),
      FileSystem.readAsStringAsync(`${packDirectory}pack.json`),
    ]);
    candidates.push({
      packId,
      manifest: JSON.parse(manifest) as PackSetCandidate['manifest'],
      envelope: JSON.parse(envelope) as PackSetCandidate['envelope'],
      packBytes: new Uint8Array(Buffer.from(body, 'base64')),
    });
  }
  return candidates;
}

/**
 * Persistent application-side pack-update store. Verification remains in
 * `importPackSets`; this class only stages and atomically renames verified sets.
 */
export function expoPackSetStore(): PackSetStore {
  return {
    async listInstalled(): Promise<readonly InstalledPackSet[]> {
      return (await readCandidates(pathFor('installed'))).map((candidate) => ({
        packId: candidate.packId,
        packVersion: candidate.manifest.packVersion,
        packFormatVersion: candidate.manifest.packFormatVersion,
        datasetVersion: candidate.manifest.datasetVersion,
      }));
    },
    async clearStaging(): Promise<void> {
      await ensureRoot();
      await remove(pathFor('staging'));
      await FileSystem.makeDirectoryAsync(pathFor('staging'), { intermediates: true });
    },
    async stage(candidate: PackSetCandidate): Promise<void> {
      await writeCandidate(pathFor('staging'), candidate);
    },
    async backupInstalled(): Promise<void> {
      await ensureRoot();
      await remove(pathFor('backup'));
      if (await exists(pathFor('installed'))) {
        await FileSystem.moveAsync({
          from: pathFor('installed'),
          to: pathFor('backup'),
        });
      } else {
        await FileSystem.makeDirectoryAsync(pathFor('backup'), { intermediates: true });
      }
    },
    async promoteStaged(): Promise<void> {
      if (!(await exists(pathFor('staging')))) {
        throw new Error('PACK_UPDATE_STAGING_MISSING');
      }
      await remove(pathFor('installed'));
      await FileSystem.moveAsync({
        from: pathFor('staging'),
        to: pathFor('installed'),
      });
    },
    async discardBackup(): Promise<void> {
      await remove(pathFor('backup'));
    },
    async restoreBackup(): Promise<void> {
      if (!(await exists(pathFor('backup')))) {
        throw new Error('PACK_UPDATE_BACKUP_MISSING');
      }
      await remove(pathFor('installed'));
      await FileSystem.moveAsync({
        from: pathFor('backup'),
        to: pathFor('installed'),
      });
    },
    async hasBackup(): Promise<boolean> {
      return exists(pathFor('backup'));
    },
  };
}

export async function loadInstalledPackCandidates(): Promise<
  readonly PackSetCandidate[]
> {
  return readCandidates(pathFor('installed'));
}

