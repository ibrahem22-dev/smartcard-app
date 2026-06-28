import React from 'react';
// eslint-disable-next-line no-restricted-imports -- AppText is the single sanctioned wrapper over RN Text.
import { Text, type TextProps } from 'react-native';

import { useAppDirection } from '../hooks/useAppDirection';
import type { RtlTextAlign } from './rtl/RtlText';

export type AppTextProps = TextProps & {
  readonly children: React.ReactNode;
  readonly align?: RtlTextAlign;
};

/**
 * Direction-aware text. User styles/className first; direction applied last
 * so NativeWind cannot override textAlign/writingDirection.
 */
export const AppText: React.FC<AppTextProps> = ({
  children,
  style,
  align = 'auto',
  ...props
}) => {
  const dir = useAppDirection();

  const resolvedAlign = align === 'auto' ? dir.textAlign : align;

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
};
