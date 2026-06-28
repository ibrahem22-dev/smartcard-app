import React from 'react';
import {
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

export type RtlScrollViewProps = ScrollViewProps;

/**
 * Scroll container. Direction is NOT set here: a container-level `direction:'rtl'`
 * cascaded into RtlRow and double-flipped rows (root cause of ISSUE-RTL-01).
 * Row mirroring = RtlRow (row-reverse); text = RtlText/AppText (writingDirection).
 */
export function RtlScrollView({
  style,
  contentContainerStyle,
  children,
  ...props
}: RtlScrollViewProps): React.ReactElement {
  return (
    <ScrollView
      {...props}
      contentContainerStyle={contentContainerStyle}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </ScrollView>
  );
}
