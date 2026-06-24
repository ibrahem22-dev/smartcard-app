import React, { type ReactNode } from 'react';
import { I18nManager, StyleSheet, Text, View } from 'react-native';

import { INITIAL_FEATURE_STATUS } from '../types/feature.types';
import { useFeatureFlag, type FeatureStatus } from '../hooks/useFeatureFlag';

export type FeatureGateProps = {
  feature: keyof typeof INITIAL_FEATURE_STATUS;
  children: ReactNode;
};

export function FeatureGate({ feature, children }: FeatureGateProps): React.ReactElement | null {
  const status = useFeatureFlag(feature);

  if (status !== 'active' && status !== 'soon' && status !== 'pro_only') {
    return null;
  }

  if (status === 'active') {
    return <>{children}</>;
  }

  const badgeLabel = status === 'soon' ? 'בקרוב' : 'Pro בלבד';

  return (
    <View style={styles.wrapper}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badgeLabel}</Text>
      </View>
      {children}
    </View>
  );
}

const writingDirection = I18nManager.isRTL ? 'rtl' : 'ltr';

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
    textAlign: 'center',
    writingDirection,
  },
});
