import React from 'react';
import { View, type ViewProps } from 'react-native';

import { useAppDirection } from '../../hooks/useAppDirection';

export type RtlRowProps = ViewProps;

export function RtlRow({
  style,
  children,
  ...props
}: RtlRowProps): React.ReactElement {
  const dir = useAppDirection();

  return (
    <View
      {...props}
      style={[
        style,
        {
          // Single RTL mechanism: explicit row-reverse only.
          // Do NOT also set `direction` here — combining row-reverse with
          // direction:'rtl' double-flips the row (Yoga locale flip + manual
          // flip cancel out), rendering Hebrew rows LTR. Root cause of ISSUE-RTL-01.
          flexDirection: dir.rowDirection,
        },
      ]}
    >
      {children}
    </View>
  );
}
