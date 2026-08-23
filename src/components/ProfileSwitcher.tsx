import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from './AppText';
import { RtlRow } from './rtl';
import { useAppDirection } from '../hooks/useAppDirection';
import { useProfileStore } from '../store/useProfileStore';
import { useTranslation } from '../hooks/useTranslation';
import type { AppProfile } from '../types/profile.types';
import { ACCENT, BORDER, ROLE_BORDER, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';

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

/** Localize known i18n keys used as stored display names; leave custom names as-is. */
function localizeProfileName(
  displayName: string,
  t: (source: string) => string,
): string {
  if (displayName === 'פרופיל מקומי' || displayName === 'Local profile') {
    return t('פרופיל מקומי');
  }
  return displayName;
}

export function ProfileSwitcher({
  mode,
  activeBorderColor,
  onAddProfile,
  onRequestDelete,
}: ProfileSwitcherProps): React.ReactElement {
  const { t } = useTranslation();
  const { textAlign, writingDirection, startAlign } = useAppDirection();
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <RtlRow className="gap-3" style={{ alignItems: startAlign }}>
          {allProfiles.map(profile => {
            const isActive = activeProfile?.id === profile.id;
            const visibleName = localizeProfileName(profile.displayName, t);

            return (
              <View className="w-20 items-center" key={profile.id}>
                <Pressable
                  accessibilityLabel={visibleName}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  className={`h-14 w-14 items-center justify-center rounded-full border-2 ${
                    isActive
                      ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                      : `${BORDER.hairline} ${SURFACE.card}`
                  }`}
                  onPress={(): void => switchProfile(profile.id)}
                  style={
                    isActive && activeBorderColor !== undefined
                      ? { borderColor: activeBorderColor }
                      : undefined
                  }
                >
                  <AppText
                    align="center"
                    className={`text-base font-black ${isActive ? `${ACCENT.text}` : `${TEXT.body}`}`}
                  >
                    {getInitials(visibleName)}
                  </AppText>
                </Pressable>
                <AppText
                  align="center"
                  className={`mt-1 w-full text-xs font-bold ${TEXT.body}`}
                  numberOfLines={1}
                >
                  {visibleName}
                </AppText>
              </View>
            );
          })}

          {mode === 'editor' && allProfiles.length < 3 ? (
            <Pressable
              accessibilityRole="button"
              className={`min-h-14 min-w-24 items-center justify-center rounded-lg border border-dashed px-3 ${ACCENT.border} ${ACCENT.surface}`}
              onPress={onAddProfile}
            >
              <AppText
                align="center"
                className={`text-sm font-extrabold ${ACCENT.text}`}
              >
                {t('הוסף פרופיל')}
              </AppText>
            </Pressable>
          ) : null}
        </RtlRow>
      </ScrollView>

      {mode === 'editor' ? (
        <View className="mt-4 gap-3">
          {allProfiles.map(profile => {
            const isActive = activeProfile?.id === profile.id;
            const isEditing = editingProfileId === profile.id;
            const visibleName = localizeProfileName(profile.displayName, t);

            return (
              <View
                className={`rounded-lg border p-3 ${BORDER.subtle} ${SURFACE.card}`}
                key={profile.id}
              >
                {isEditing ? (
                  <View className="gap-2">
                    <TextInput
                      className={`min-h-[44px] rounded-lg border px-3 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`}
                      onChangeText={setDraftName}
                      style={{ textAlign, writingDirection }}
                      value={draftName}
                    />
                    <Pressable
                      accessibilityRole="button"
                      className={`min-h-[42px] items-center justify-center rounded-lg ${ACCENT.solid}`}
                      onPress={(): void => saveRename(profile.id)}
                    >
                      <AppText
                        align="center"
                        className={`text-sm font-extrabold ${TEXT.onAccent}`}
                      >
                        {t('שמור שם')}
                      </AppText>
                    </Pressable>
                  </View>
                ) : (
                  <RtlRow className="items-center gap-2">
                    <AppText className={`flex-1 text-base font-extrabold ${TEXT.heading}`}>
                      {visibleName}
                    </AppText>
                    <Pressable
                      accessibilityRole="button"
                      className={`min-h-[40px] justify-center rounded-lg border px-3 ${BORDER.hairline}`}
                      onPress={(): void => beginRename(profile)}
                    >
                      <AppText className={`text-sm font-bold ${TEXT.body}`}>
                        {t('שינוי שם')}
                      </AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      className={`min-h-[40px] justify-center rounded-lg border px-3 ${
                        isActive
                          ? `${BORDER.subtle} ${SURFACE.sunken}`
                          : `${ROLE_BORDER.danger} ${ROLE_SURFACE_BG.danger}`
                      }`}
                      disabled={isActive}
                      onPress={(): void => onRequestDelete?.(profile)}
                    >
                      <AppText
                        className={`text-sm font-bold ${isActive ? `${TEXT.muted}` : `${ROLE_TEXT.danger}`}`}
                      >
                        {t('מחיקה')}
                      </AppText>
                    </Pressable>
                  </RtlRow>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
