import { create } from 'zustand';

import { keyVault } from '../security/keyVault';
import type {
  AppProfile,
  ProfileLanguagePreference,
} from '../types/profile.types';
import { MMKV_KEYS } from './keys';

const MAX_PROFILES = 3;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ProfileState {
  activeProfile: AppProfile | null;
  allProfiles: AppProfile[];
  hydrate(): void;
  addProfile(profile: AppProfile): void;
  deleteProfile(id: string): void;
  renameProfile(id: string, displayName: string): void;
  switchProfile(id: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLanguagePreference(
  value: unknown,
): value is ProfileLanguagePreference {
  return value === 'he' || value === 'ar' || value === 'en';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isAppProfile(value: unknown): value is AppProfile {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    UUID_PATTERN.test(value.id) &&
    typeof value.displayName === 'string' &&
    typeof value.pinHash === 'string' &&
    typeof value.bankName === 'string' &&
    typeof value.monthlyIncome === 'number' &&
    Number.isFinite(value.monthlyIncome) &&
    isLanguagePreference(value.languagePreference) &&
    isStringArray(value.cardIds)
  );
}

function assertUuid(id: string): void {
  if (!UUID_PATTERN.test(id)) {
    throw new Error('INVALID_PROFILE_ID');
  }
}

function buildProfileKey(id: string): string {
  assertUuid(id);
  return `${MMKV_KEYS.profilePrefix}${id}${MMKV_KEYS.profileDataSuffix}`;
}

function parseProfile(raw: string | undefined): AppProfile | null {
  if (raw === undefined) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isAppProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readProfiles(): AppProfile[] {
  const storage = keyVault.getEncryptedStorage();

  return storage
    .getAllKeys()
    .filter(
      key =>
        key.startsWith(MMKV_KEYS.profilePrefix) &&
        key.endsWith(MMKV_KEYS.profileDataSuffix),
    )
    .map(key => parseProfile(storage.getString(key)))
    .filter((profile): profile is AppProfile => profile !== null);
}

function resolveActiveProfile(
  profiles: readonly AppProfile[],
  activeProfileId: string | undefined,
): AppProfile | null {
  if (activeProfileId === undefined) {
    return null;
  }

  return profiles.find(profile => profile.id === activeProfileId) ?? null;
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  activeProfile: null,
  allProfiles: [],

  hydrate() {
    const storage = keyVault.getEncryptedStorage();
    const allProfiles = readProfiles();
    const activeProfile = resolveActiveProfile(
      allProfiles,
      storage.getString(MMKV_KEYS.activeProfileId),
    );

    set({ allProfiles, activeProfile });
  },

  addProfile(profile: AppProfile) {
    assertUuid(profile.id);
    const persistedProfiles = readProfiles();
    const profiles =
      get().allProfiles.length >= persistedProfiles.length
        ? get().allProfiles
        : persistedProfiles;

    if (profiles.some(existing => existing.id === profile.id)) {
      throw new Error('PROFILE_ALREADY_EXISTS');
    }

    if (profiles.length >= MAX_PROFILES) {
      throw new Error('MAX_PROFILES_REACHED');
    }

    const storage = keyVault.getEncryptedStorage();
    const allProfiles = [...profiles, profile];
    const currentActiveProfile =
      get().activeProfile ??
      resolveActiveProfile(
        profiles,
        storage.getString(MMKV_KEYS.activeProfileId),
      );
    storage.set(buildProfileKey(profile.id), JSON.stringify(profile));

    if (currentActiveProfile === null) {
      storage.set(MMKV_KEYS.activeProfileId, profile.id);
      set({ allProfiles, activeProfile: profile });
      return;
    }

    set({ allProfiles, activeProfile: currentActiveProfile });
  },

  deleteProfile(id: string) {
    assertUuid(id);
    const storage = keyVault.getEncryptedStorage();
    const profiles =
      get().allProfiles.length > 0 ? get().allProfiles : readProfiles();
    const allProfiles = profiles.filter(profile => profile.id !== id);
    const currentActiveId =
      get().activeProfile?.id ??
      storage.getString(MMKV_KEYS.activeProfileId);

    storage.delete(buildProfileKey(id));

    if (currentActiveId === id) {
      const nextActiveProfile = allProfiles[0] ?? null;
      if (nextActiveProfile === null) {
        storage.delete(MMKV_KEYS.activeProfileId);
      } else {
        storage.set(MMKV_KEYS.activeProfileId, nextActiveProfile.id);
      }
      set({ allProfiles, activeProfile: nextActiveProfile });
      return;
    }

    set({
      allProfiles,
      activeProfile: resolveActiveProfile(allProfiles, currentActiveId),
    });
  },

  renameProfile(id: string, displayName: string) {
    assertUuid(id);
    const normalizedName = displayName.trim();
    if (normalizedName === '') {
      throw new Error('INVALID_PROFILE_NAME');
    }

    const profiles =
      get().allProfiles.length > 0 ? get().allProfiles : readProfiles();
    const existingProfile =
      profiles.find(profile => profile.id === id) ?? null;

    if (existingProfile === null) {
      throw new Error('PROFILE_NOT_FOUND');
    }

    const renamedProfile: AppProfile = {
      ...existingProfile,
      displayName: normalizedName,
    };
    const allProfiles = profiles.map(profile =>
      profile.id === id ? renamedProfile : profile,
    );
    const activeProfile =
      get().activeProfile?.id === id
        ? renamedProfile
        : resolveActiveProfile(
            allProfiles,
            get().activeProfile?.id ??
              keyVault
                .getEncryptedStorage()
                .getString(MMKV_KEYS.activeProfileId),
          );

    keyVault
      .getEncryptedStorage()
      .set(buildProfileKey(id), JSON.stringify(renamedProfile));
    set({ allProfiles, activeProfile });
  },

  switchProfile(id: string) {
    assertUuid(id);
    const profiles =
      get().allProfiles.length > 0 ? get().allProfiles : readProfiles();
    const activeProfile =
      profiles.find(profile => profile.id === id) ?? null;

    if (activeProfile === null) {
      throw new Error('PROFILE_NOT_FOUND');
    }

    keyVault
      .getEncryptedStorage()
      .set(MMKV_KEYS.activeProfileId, activeProfile.id);
    set({ allProfiles: profiles, activeProfile });
  },
}));
