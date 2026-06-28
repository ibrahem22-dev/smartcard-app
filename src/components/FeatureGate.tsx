import React, { type ReactNode } from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { useTranslation } from '../hooks/useTranslation';
import { INITIAL_FEATURE_STATUS } from '../types/feature.types';

export type FeatureGateProps = {
  feature: keyof typeof INITIAL_FEATURE_STATUS;
  children: ReactNode;
};

export function FeatureGate({ feature, children }: FeatureGateProps): React.ReactElement | null {
  const status = useFeatureFlag(feature);
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  if (
    status !== 'active' &&
    status !== 'live' &&
    status !== 'soon' &&
    status !== 'pro_only'
  ) {
    return null;
  }

  if (status === 'active' || status === 'live') {
    return <>{children}</>;
  }

  const badgeLabel = status === 'soon' ? t('בקרוב') : t('Pro בלבד');

  // Pin the badge to the trailing corner so it never covers the start of the
  // text: left in RTL (text starts at the right), right in LTR.
  const badgePosition = isRTL ? { left: 8 } : { right: 8 };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.badge, badgePosition]}>
        <AppText style={styles.badgeText}>{badgeLabel}</AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    zIndex: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0F172A',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
