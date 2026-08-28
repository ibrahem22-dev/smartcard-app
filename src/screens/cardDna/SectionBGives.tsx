import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useMoney } from '../../hooks/useMoney';
import {
  useTranslation,
  type UseTranslationResult,
} from '../../hooks/useTranslation';
import { resolveMedia } from '../../media/resolveMedia';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import type { BenefitsDB } from '../../types/benefits.types';
import type { EngineCard } from '../../types/card.types';
import { TABULAR_NUMERALS } from '../../utils/money';
import {
  benefitRowsFor,
  type BenefitRow,
  type BenefitSource,
} from './benefitRows';

const PALETTE_CLASS = {
  neutral: SURFACE.card,
  accent: SURFACE.raised,
  raised: SURFACE.raised,
  sunken: SURFACE.sunken,
} as const;

export interface SectionBGivesProps {
  readonly card: EngineCard | undefined;
  readonly db: BenefitsDB;
}

function sourceLabel(
  source: BenefitSource,
  t: UseTranslationResult['t'],
): string {
  switch (source) {
    case 'card':
      return t('כרטיס');
    case 'club':
      return t('מועדון');
  }
}

function kindLabel(
  kind: BenefitRow['kind'],
  t: UseTranslationResult['t'],
): string {
  switch (kind) {
    case 'cashback':
      return t('החזר כספי');
    case 'discount':
      return t('הנחה');
  }
}

export function SectionBGives({
  card,
  db,
}: SectionBGivesProps): React.ReactElement {
  const { t } = useTranslation();
  const { percent } = useMoney();
  const rows = benefitRowsFor(card, db);

  if (rows.length === 0) {
    return (
      <View className="py-4" testID="card-dna-gives-empty">
        <AppText className={`text-sm ${TEXT.muted}`}>
          {t('לא נמצאה עדות להטבה עבור הכרטיס הזה')}
        </AppText>
      </View>
    );
  }

  return (
    <View>
      {rows.map((row) => {
        const testID = `card-dna-benefit-${row.id}`;
        const media = resolveMedia(
          {
            subjectKind: 'benefit',
            subjectId: row.id,
            fallbackClass: 'benefit',
          },
          [],
          { context: { categoryKey: row.category } },
        );
        const categoryArtwork =
          media?.generatedSpec?.treatment === 'category';
        const palette = media?.generatedSpec
          ? PALETTE_CLASS[media.generatedSpec.paletteKey]
          : SURFACE.card;

        return (
          <View
            className={`gap-3 border-b py-4 ${BORDER.subtle}`}
            key={row.id}
            testID={testID}
          >
            <View
              accessibilityLabel={
                categoryArtwork
                  ? t('ייצוג הטבה לפי קטגוריה')
                  : t('ייצוג כללי של הטבה')
              }
              accessibilityRole="image"
              className={`h-20 rounded-lg ${palette}`}
              testID={`${testID}-image`}
            />
            <RtlRow className="items-center justify-between gap-3">
              <AppText
                className={`text-xs font-bold ${TEXT.secondary}`}
                testID={`${testID}-source`}
              >
                {sourceLabel(row.source, t)}
              </AppText>
              <AppText
                className={`text-xs ${TEXT.secondary}`}
                testID={`${testID}-kind`}
              >
                {kindLabel(row.kind, t)}
              </AppText>
              <AppText
                className={`text-base font-extrabold ${TEXT.heading}`}
                style={TABULAR_NUMERALS}
                testID={`${testID}-value`}
              >
                {percent(row.valuePercent)}
              </AppText>
            </RtlRow>
            <AppText
              className={`text-sm ${TEXT.body}`}
              testID={`${testID}-description`}
            >
              {row.description}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
