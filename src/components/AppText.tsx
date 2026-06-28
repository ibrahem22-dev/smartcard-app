import React from 'react';
// eslint-disable-next-line no-restricted-imports -- AppText is the single sanctioned wrapper over RN Text.
import { Text, type TextProps } from 'react-native';

import { useLanguageStore } from '../store/useLanguageStore';

interface AppTextProps extends TextProps {
  children: React.ReactNode;
}

/**
 * Single source of text direction. Alignment follows the *reactive* resolved
 * language (useLanguageStore.isRTL) — NOT I18nManager, which only updates after a
 * native reload and therefore lags behind in-app language switches.
 * Do NOT pass a hard-coded textAlign or NativeWind text-right/text-left on
 * AppText; caller style only for color, borders, or intentional center.
 */
export const AppText: React.FC<AppTextProps> = ({
  children,
  style,
  ...props
}) => {
  const isRTL = useLanguageStore(state => state.isRTL);

  return (
    <Text
      style={[
        {
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};
