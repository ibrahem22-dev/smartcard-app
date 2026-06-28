import React from 'react';
import { View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type RtlScreenProps = ViewProps & {
  readonly safe?: boolean;
};

/**
 * Screen container. Direction is NOT set here: a container-level `direction:'rtl'`
 * cascaded into RtlRow and double-flipped rows (root cause of ISSUE-RTL-01).
 * Row mirroring = RtlRow (row-reverse); text = RtlText/AppText (writingDirection).
 */
export function RtlScreen({
  style,
  children,
  safe = false,
  ...props
}: RtlScreenProps): React.ReactElement {
  const Container = safe ? SafeAreaView : View;

  return (
    <Container {...props} style={[{ flex: 1 }, style]}>
      {children}
    </Container>
  );
}
