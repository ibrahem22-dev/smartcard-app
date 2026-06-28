import React from 'react';
import { Pressable, type PressableProps } from 'react-native';

import { AppText } from '../AppText';

export type RtlButtonProps = Omit<PressableProps, 'children'> & {
  readonly label: string;
  readonly labelClassName?: string;
};

export function RtlButton({
  label,
  labelClassName,
  ...props
}: RtlButtonProps): React.ReactElement {
  return (
    <Pressable {...props}>
      <AppText {...(labelClassName !== undefined ? { className: labelClassName } : {})}>
        {label}
      </AppText>
    </Pressable>
  );
}
