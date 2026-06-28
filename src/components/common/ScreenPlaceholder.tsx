// /src/components/common/ScreenPlaceholder.tsx
//
// Minimal placeholder for skeleton screens. Uses StyleSheet for now to keep the
// skeleton dependency-light; per .cursorrules these screens will migrate to
// NativeWind once it is configured in the project. RTL-safe (text aligns to
// start and follows the global writing direction).

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../AppText';

interface ScreenPlaceholderProps {
  readonly title: string;
  readonly subtitle?: string;
}

export function ScreenPlaceholder({
  title,
  subtitle,
}: ScreenPlaceholderProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <AppText style={styles.title}>{title}</AppText>
      {subtitle !== undefined ? (
        <AppText style={styles.subtitle}>{subtitle}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#64748B',
  },
});
