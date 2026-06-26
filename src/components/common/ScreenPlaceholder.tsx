// /src/components/common/ScreenPlaceholder.tsx
//
// Minimal placeholder for skeleton screens. Uses StyleSheet for now to keep the
// skeleton dependency-light; per .cursorrules these screens will migrate to
// NativeWind once it is configured in the project. RTL-safe (text aligns to
// start and follows the global writing direction).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { rtl } from '../../utils/rtlStyles';

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
      <Text style={[rtl.text, styles.title]}>{title}</Text>
      {subtitle !== undefined ? (
        <Text style={[rtl.text, styles.subtitle]}>{subtitle}</Text>
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
