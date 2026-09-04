import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import {
  clubInstitutions,
  remainingClubsAfter,
  resolveClub,
  type CatalogClub,
  type ClubResolution,
} from '../../authority/addCardCatalog';
import { useAppDirection } from '../../hooks/useAppDirection';
import { useTranslation } from '../../hooks/useTranslation';
import { ACCENT, BORDER, SURFACE, TEXT } from '../../theme/tokens';

type Step = 1 | 2 | 3;

export function ClubResolver({
  onResolved,
}: {
  readonly onResolved: (resolution: ClubResolution) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { textAlign, writingDirection } = useAppDirection();
  const institutions = clubInstitutions();

  const [step, setStep] = useState<Step>(1);
  const [q1, setQ1] = useState<string | 'unsure' | null>(null);
  const [q2, setQ2] = useState<string | 'unsure'>('unsure');
  const [nameQuery, setNameQuery] = useState('');

  const remaining = useMemo(
    () => remainingClubsAfter(q1 ?? 'unsure', q2),
    [q1, q2],
  );

  const inputClass = `min-h-[50px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`;

  function finish(q3ClubNodeId: string | 'none'): void {
    if (q1 === null) return;
    onResolved(resolveClub({ q1InstitutionOrgId: q1, q2NameQuery: q2, q3ClubNodeId }));
  }

  return (
    <View className="w-full gap-3" testID="club-resolver">
      <AppText className={`text-xl font-black ${TEXT.heading}`}>
        {t('אני לא יודע את המועדון 🔍')}
      </AppText>

      {step === 1 ? (
        <View testID="club-resolver-q1">
          <AppText className={`text-sm font-bold ${TEXT.body}`}>
            {t('באיזה מוסד המועדון קשור?')}
          </AppText>
          <RtlRow className="mt-2 flex-wrap gap-2">
            {institutions.map(orgId => (
              <Pressable
                accessibilityRole="button"
                className={`min-h-[48px] items-center justify-center rounded-lg border px-3 ${BORDER.hairline} ${SURFACE.card}`}
                key={orgId}
                onPress={(): void => {
                  setQ1(orgId);
                  setStep(2);
                }}
                testID={`club-resolver-org-${orgId}`}
              >
                <AppText className={`text-sm font-extrabold ${TEXT.heading}`}>{orgId}</AppText>
              </Pressable>
            ))}
          </RtlRow>
          <Pressable
            accessibilityRole="button"
            className={`mt-3 min-h-[48px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.card}`}
            onPress={(): void => {
              setQ1('unsure');
              setStep(2);
            }}
            testID="club-resolver-q1-unsure"
          >
            <AppText className={`text-sm font-extrabold ${TEXT.heading}`}>{t('לא בטוח')}</AppText>
          </Pressable>
        </View>
      ) : null}

      {step === 2 ? (
        <View testID="club-resolver-q2">
          <AppText className={`text-sm font-bold ${TEXT.body}`}>
            {t('זוכרים מילה משם המועדון?')}
          </AppText>
          <TextInput
            className={`mt-2 ${inputClass}`}
            onChangeText={setNameQuery}
            style={{ textAlign, writingDirection }}
            testID="club-resolver-q2-input"
            value={nameQuery}
          />
          <Pressable
            accessibilityRole="button"
            className={`mt-3 min-h-[48px] items-center justify-center rounded-lg ${ACCENT.solid}`}
            onPress={(): void => {
              setQ2(nameQuery.trim() === '' ? 'unsure' : nameQuery.trim());
              setStep(3);
            }}
            testID="club-resolver-q2-next"
          >
            <AppText className={`text-sm font-extrabold ${TEXT.onAccent}`}>{t('המשך')}</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className={`mt-2 min-h-[48px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.card}`}
            onPress={(): void => {
              setQ2('unsure');
              setStep(3);
            }}
            testID="club-resolver-q2-unsure"
          >
            <AppText className={`text-sm font-extrabold ${TEXT.heading}`}>{t('לא בטוח')}</AppText>
          </Pressable>
        </View>
      ) : null}

      {step === 3 ? (
        <View testID="club-resolver-q3">
          <AppText className={`text-sm font-bold ${TEXT.body}`}>
            {t('זה אחד מהמועדונים האלה?')}
          </AppText>
          <View className="mt-2 gap-2">
            {remaining.map((club: CatalogClub) => (
              <Pressable
                accessibilityRole="button"
                className={`min-h-[48px] justify-center rounded-lg border px-3 ${BORDER.hairline} ${SURFACE.card}`}
                key={club.nodeId}
                onPress={(): void => finish(club.nodeId)}
                testID={`club-resolver-pick-${club.nodeId}`}
              >
                <AppText className={`text-base font-extrabold ${TEXT.heading}`}>
                  {club.displayName}
                </AppText>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            className={`mt-3 min-h-[48px] items-center justify-center rounded-lg border ${BORDER.hairline} ${SURFACE.card}`}
            onPress={(): void => finish('none')}
            testID="club-resolver-none"
          >
            <AppText className={`text-sm font-extrabold ${TEXT.heading}`}>
              {t('אף אחד מאלה')}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Standalone mount for the derived-screen harness; production uses the named export. */
export default function ClubResolverPreview(): React.ReactElement {
  return <ClubResolver onResolved={() => undefined} />;
}
