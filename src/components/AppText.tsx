import React from 'react';
// eslint-disable-next-line no-restricted-imports -- AppText is the single sanctioned wrapper over RN Text.
import { I18nManager, Text, type TextProps } from 'react-native';

interface AppTextProps extends TextProps {
  children: React.ReactNode;
}

/**
 * Single source of text direction. Alignment follows I18nManager.isRTL so text
 * and Yoga layout always share the same direction. useLanguageStore.isRTL must
 * NOT be used here — it updates before reload and desyncs text from layout.
 * Do NOT pass a hard-coded textAlign or NativeWind text-right/text-left on
 * AppText; caller style only for color, borders, or intentional center.
 */
export const AppText: React.FC<AppTextProps> = ({
  children,
  style,
  ...props
}) => {
  const isRTL = I18nManager.isRTL;

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
