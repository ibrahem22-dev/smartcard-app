import React from 'react';
import { View, type ViewProps } from 'react-native';

export type RtlViewProps = ViewProps;

/**
 * Plain flex container. Direction is NOT set here: layout mirroring is handled
 * explicitly by RtlRow (row-reverse) and text by RtlText/AppText (writingDirection).
 * Setting `direction:'rtl'` on containers cascaded into RtlRow and double-flipped
 * rows — root cause of ISSUE-RTL-01. Kept as a stable wrapper for existing imports.
 */
export function RtlView({
  style,
  children,
  ...props
}: RtlViewProps): React.ReactElement {
  return (
    <View {...props} style={style}>
      {children}
    </View>
  );
}
