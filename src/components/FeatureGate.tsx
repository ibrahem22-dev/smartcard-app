import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { useTranslation } from '../hooks/useTranslation';
import { INITIAL_FEATURE_STATUS } from '../types/feature.types';
import { rtl } from '../utils/rtlStyles';

export type FeatureGateProps = {
  feature: keyof typeof INITIAL_FEATURE_STATUS;
  children: ReactNode;
};

export function FeatureGate({ feature, children }: FeatureGateProps): React.ReactElement | null {
  const status = useFeatureFlag(feature);
  const { t } = useTranslation();

  if (status !== 'active' && status !== 'soon' && status !== 'pro_only') {
    return null;
  }

  if (status === 'active') {
    return <>{children}</>;
  }

  const badgeLabel = status === 'soon' ? t('בקרוב') : t('Pro בלבד');

  return (
    <View style={styles.wrapper}>
      <View style={styles.badge}>
        <Text style={[rtl.text, styles.badgeText]}>{badgeLabel}</Text>
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
    right: 8,
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
