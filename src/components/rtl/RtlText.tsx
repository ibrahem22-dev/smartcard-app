import React from 'react';
// eslint-disable-next-line no-restricted-imports -- RtlText is the direction-aware Text wrapper.
import { Text, type TextProps } from 'react-native';

import { useAppDirection } from '../../hooks/useAppDirection';

export type RtlTextAlign = 'left' | 'right' | 'center' | 'auto';

export type RtlTextProps = TextProps & {
  readonly align?: RtlTextAlign;
};

export function RtlText({
  style,
  align = 'auto',
  children,
  ...props
}: RtlTextProps): React.ReactElement {
  const dir = useAppDirection();

  const resolvedAlign =
    align === 'auto' ? dir.textAlign : align;

  return (
    <Text
      {...props}
      style={[
        style,
        {
          textAlign: resolvedAlign,
          writingDirection: dir.writingDirection,
        },
      ]}
    >
      {children}
    </Text>
  );
}
