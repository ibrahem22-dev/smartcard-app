import { join } from 'node:path';

const mockDirectories = new Set<string>();
const mockFiles = new Map<string, string>();

function normalize(uri: string): string {
  return uri.endsWith('/') ? uri : `${uri}/`;
}

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  EncodingType: { UTF8: 'utf8' },
  getInfoAsync: jest.fn(async (uri: string) => ({
    exists: mockDirectories.has(normalize(uri)) || mockFiles.has(uri),
  })),
  makeDirectoryAsync: jest.fn(async (uri: string) => {
    mockDirectories.add(normalize(uri));
  }),
  deleteAsync: jest.fn(async (uri: string) => {
    const prefix = normalize(uri);
    for (const directory of [...mockDirectories]) {
      if (directory.startsWith(prefix)) mockDirectories.delete(directory);
    }
    for (const file of [...mockFiles.keys()]) {
      if (file.startsWith(prefix) || file === uri) mockFiles.delete(file);
    }
  }),
  writeAsStringAsync: jest.fn(async (uri: string, value: string) => {
    mockFiles.set(uri, value);
  }),
  readAsStringAsync: jest.fn(async (uri: string) => {
    const value = mockFiles.get(uri);
    if (value === undefined) throw new Error(`missing ${uri}`);
    return value;
  }),
  readDirectoryAsync: jest.fn(async (uri: string) => {
    const prefix = normalize(uri);
    const children = new Set<string>();
    for (const directory of mockDirectories) {
      if (!directory.startsWith(prefix) || directory === prefix) continue;
      const child = directory.slice(prefix.length).split('/')[0];
      if (child !== undefined && child !== '') children.add(child);
    }
    return [...children];
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const fromPrefix = normalize(from);
    const toPrefix = normalize(to);
    if (!mockDirectories.has(fromPrefix)) throw new Error('missing source');
    const directories = [...mockDirectories].filter((entry) => entry.startsWith(fromPrefix));
    const files = [...mockFiles.entries()].filter(([entry]) => entry.startsWith(fromPrefix));
    for (const directory of directories) mockDirectories.delete(directory);
    for (const [file] of files) mockFiles.delete(file);
    for (const directory of directories) {
      mockDirectories.add(`${toPrefix}${directory.slice(fromPrefix.length)}`);
    }
    for (const [file, value] of files) {
      mockFiles.set(`${toPrefix}${file.slice(fromPrefix.length)}`, value);
    }
  }),
}));

import { fsPackReader } from '../../fsPackReader';
import { artifactClassOf } from '../../packSet';
import { expoPackSetStore, loadInstalledPackCandidates } from '../expoPackSetStore';
import { importPackSets, recoverAtStartup, type PackSetCandidate } from '../packSetImport';

const reader = fsPackReader(join(__dirname, '..', '..', 'packs'));
const decoder = new TextDecoder();
const packIds = reader.sets().filter((set) => artifactClassOf(reader, set) === 'pack');
const candidates: PackSetCandidate[] = packIds.map((packId) => ({
  packId,
  packBytes: reader.read(packId, 'pack.json'),
  manifest: JSON.parse(decoder.decode(reader.read(packId, 'manifest.json'))),
  envelope: JSON.parse(decoder.decode(reader.read(packId, 'manifest.sig.json'))),
}));

describe('persistent app-side signed pack update', () => {
  beforeEach(() => {
    mockDirectories.clear();
    mockFiles.clear();
  });

  test('verifies, stages, promotes, and reloads the complete real pack set', async () => {
    const store = expoPackSetStore();
    const result = await importPackSets(store, candidates, {
      requiredPackSets: packIds,
      requireRelease: false,
    });

    expect(result.ok).toBe(true);
    expect((await store.listInstalled()).map((row) => row.packId).sort()).toEqual([...packIds].sort());
    expect((await loadInstalledPackCandidates()).map((row) => row.packId).sort()).toEqual([...packIds].sort());
    expect(await store.hasBackup()).toBe(false);
  });

  test('startup recovery preserves the last-known-good set after interrupted promotion', async () => {
    const store = expoPackSetStore();
    const first = await importPackSets(store, candidates, {
      requiredPackSets: packIds,
      requireRelease: false,
    });
    expect(first.ok).toBe(true);

    await store.clearStaging();
    for (const candidate of candidates) await store.stage(candidate);
    await store.backupInstalled();

    expect(await recoverAtStartup(store)).toBe('ROLLED_BACK');
    expect((await store.listInstalled()).map((row) => row.packId).sort()).toEqual([...packIds].sort());
  });
});

