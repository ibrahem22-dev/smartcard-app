import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useProfileStore } from '../store/useProfileStore';
import { useTranslation } from '../hooks/useTranslation';
import type { AppProfile } from '../types/profile.types';
import { rtl } from '../utils/rtlStyles';

export interface ProfileSwitcherProps {
  readonly mode: 'compact' | 'editor';
  readonly activeBorderColor?: string;
  readonly onAddProfile?: () => void;
  readonly onRequestDelete?: (profile: AppProfile) => void;
}

function getInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map(word => Array.from(word)[0] ?? '')
    .join('');

  return initials === '' ? '?' : initials;
}

export function ProfileSwitcher({
  mode,
  activeBorderColor,
  onAddProfile,
  onRequestDelete,
}: ProfileSwitcherProps): React.ReactElement {
  const { t } = useTranslation();
  const allProfiles = useProfileStore(state => state.allProfiles);
  const activeProfile = useProfileStore(state => state.activeProfile);
  const hydrate = useProfileStore(state => state.hydrate);
  const switchProfile = useProfileStore(state => state.switchProfile);
  const renameProfile = useProfileStore(state => state.renameProfile);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function beginRename(profile: AppProfile): void {
    setEditingProfileId(profile.id);
    setDraftName(profile.displayName);
  }

  function saveRename(profileId: string): void {
    if (draftName.trim() === '') {
      return;
    }

    renameProfile(profileId, draftName);
    setEditingProfileId(null);
    setDraftName('');
  }

  return (
    <View className="w-full">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View className="flex-row-reverse items-start gap-3" style={rtl.row}>
          {allProfiles.map(profile => {
            const isActive = activeProfile?.id === profile.id;

            return (
              <View className="w-20 items-center" key={profile.id}>
                <Pressable
                  accessibilityLabel={profile.displayName}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  className={`h-14 w-14 items-center justify-center rounded-full border-2 ${
                    isActive
                      ? 'border-blue-600 bg-blue-100 dark:border-blue-400 dark:bg-blue-950'
                      : 'border-slate-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
                  }`}
                  onPress={(): void => switchProfile(profile.id)}
                  style={
                    isActive && activeBorderColor !== undefined
                      ? { borderColor: activeBorderColor }
                      : undefined
                  }
                >
                  <Text
                    className={`text-center text-base font-black ${
                      isActive
                        ? 'text-blue-700 dark:text-blue-200'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                    style={rtl.text}
                  >
                    {getInitials(profile.displayName)}
                  </Text>
                </Pressable>
                <Text
                  className="mt-1 w-full text-center text-xs font-bold text-slate-700 dark:text-slate-200"
                  numberOfLines={1}
                  style={rtl.text}
                >
                  {profile.displayName}
                </Text>
              </View>
            );
          })}

          {mode === 'editor' && allProfiles.length < 3 ? (
            <Pressable
              accessibilityRole="button"
              className="min-h-14 min-w-24 items-center justify-center rounded-lg border border-dashed border-blue-400 bg-blue-50 px-3 dark:border-blue-700 dark:bg-blue-950"
              onPress={onAddProfile}
            >
              <Text
                className="text-center text-sm font-extrabold text-blue-700 dark:text-blue-200"
                style={rtl.text}
              >
                {t('הוסף פרופיל')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {mode === 'editor' ? (
        <View className="mt-4 gap-3">
          {allProfiles.map(profile => {
            const isActive = activeProfile?.id === profile.id;
            const isEditing = editingProfileId === profile.id;

            return (
              <View
                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                key={profile.id}
              >
                {isEditing ? (
                  <View className="gap-2">
                    <TextInput
                      className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-right text-base text-slate-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      onChangeText={setDraftName}
                      style={rtl.input}
                      value={draftName}
                    />
                    <Pressable
                      accessibilityRole="button"
                      className="min-h-[42px] items-center justify-center rounded-lg bg-blue-600"
                      onPress={(): void => saveRename(profile.id)}
                    >
                      <Text
                        className="text-center text-sm font-extrabold text-white"
                        style={rtl.text}
                      >
                        {t('שמור שם')}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View
                    className="flex-row-reverse items-center gap-2"
                    style={rtl.row}
                  >
                    <Text
                      className="flex-1 text-right text-base font-extrabold text-slate-800 dark:text-slate-100"
                      style={rtl.text}
                    >
                      {profile.displayName}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      className="min-h-[40px] justify-center rounded-lg border border-slate-300 px-3 dark:border-neutral-700"
                      onPress={(): void => beginRename(profile)}
                    >
                      <Text
                        className="text-sm font-bold text-slate-700 dark:text-slate-200"
                        style={rtl.text}
                      >
                        {t('שינוי שם')}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      className={`min-h-[40px] justify-center rounded-lg border px-3 ${
                        isActive
                          ? 'border-slate-200 bg-slate-100 dark:border-neutral-800 dark:bg-neutral-800'
                          : 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950'
                      }`}
                      disabled={isActive}
                      onPress={(): void => onRequestDelete?.(profile)}
                    >
                      <Text
                        className={`text-sm font-bold ${
                          isActive
                            ? 'text-slate-400 dark:text-neutral-500'
                            : 'text-red-700 dark:text-red-200'
                        }`}
                        style={rtl.text}
                      >
                        {t('מחיקה')}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
