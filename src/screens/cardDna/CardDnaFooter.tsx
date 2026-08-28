import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { RtlRow } from '../../components/rtl';
import { useTranslation } from '../../hooks/useTranslation';
import {
  BORDER,
  ROLE_BORDER,
  ROLE_SURFACE_BG,
  ROLE_TEXT,
  SURFACE,
  TEXT,
} from '../../theme/tokens';

export interface CardDnaFooterProps {
  readonly onCompareFx: () => void;
  readonly lastUpdated?: string;
}

export function CardDnaFooter({
  onCompareFx,
  lastUpdated,
}: CardDnaFooterProps): React.ReactElement {
  const { t } = useTranslation();
  const [benefitsUnbuiltVisible, setBenefitsUnbuiltVisible] = useState(false);

  return (
    <View
      className={`rounded-lg border p-4 ${SURFACE.card} ${BORDER.hairline}`}
      testID="card-dna-footer"
    >
      <Pressable
        accessibilityRole="button"
        className="min-h-[44px] justify-center"
        onPress={(): void => setBenefitsUnbuiltVisible(true)}
        testID="card-dna-footer-benefits"
      >
        <AppText className={`text-sm font-bold ${TEXT.body}`}>
          {t('צפייה בכל ההטבות לכרטיס הזה')}
        </AppText>
      </Pressable>

      {benefitsUnbuiltVisible ? (
        <View
          className={`mt-2 rounded-lg border p-3 ${ROLE_SURFACE_BG.advisory} ${ROLE_BORDER.advisory}`}
          testID="card-dna-footer-benefits-unbuilt"
        >
          <AppText className={`text-sm font-bold ${ROLE_TEXT.advisory}`}>
            {t('המסך הזה עדיין לא נבנה. אין כאן נתונים חסרים — יש כאן מסך שטרם נכתב.')}
          </AppText>
          <AppText className={`mt-1 text-xs ${ROLE_TEXT.advisory}`}>
            {t('שייך ל־V1.x — מרכז ההטבות')}
          </AppText>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        className="min-h-[44px] justify-center"
        onPress={onCompareFx}
        testID="card-dna-footer-fx"
      >
        <AppText className={`text-sm font-bold ${TEXT.body}`}>
          {t('השוואת עמלות מטח')}
        </AppText>
      </Pressable>

      <RtlRow
        className={`mt-2 border-t pt-3 ${BORDER.subtle}`}
        testID="card-dna-footer-freshness"
      >
        <AppText className={`flex-1 text-xs ${TEXT.muted}`}>
          {t('תמיד יש לאמת מול המנפיק')}
        </AppText>
        {lastUpdated === undefined ? null : (
          <AppText className={`text-xs ${TEXT.muted}`}>
            {t('עודכן {{date}}', { date: lastUpdated })}
          </AppText>
        )}
      </RtlRow>
    </View>
  );
}
