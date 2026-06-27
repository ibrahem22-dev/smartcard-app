import { useColorScheme } from 'react-native';

import { useCardsStore } from '../store/useCardsStore';
import { useUserStore } from '../store/useUserStore';
import { CardIssuer } from '../types/card.types';

const NEUTRAL_COLOR = '#6B7280';

const BANK_COLORS: Readonly<Record<string, string>> = {
  לאומי: '#1D4ED8',
  הפועלים: '#DC2626',
  דיסקונט: '#7C3AED',
  מזרחי: '#EA580C',
};

const ISSUER_COLORS: Readonly<Record<CardIssuer, string>> = {
  [CardIssuer.Max]: '#FF6B00',
  [CardIssuer.Isracard]: '#0057B7',
  [CardIssuer.Cal]: '#6B21A8',
};

export interface ThemeColors {
  readonly bankColor: string;
  readonly companyAccent: string;
  readonly clubBadge: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function hexToHsl(hex: string): {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
} {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness: lightness * 100 };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;

  if (maximum === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (maximum === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: saturation * 100,
    lightness: lightness * 100,
  };
}

function toDarkAccent(hex: string): string {
  const hsl = hexToHsl(hex);
  const saturation = Math.min(hsl.saturation, 60);
  const lightness = clamp(hsl.lightness, 55, 65);

  return `hsl(${Math.round(hsl.hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
}

function hashClubName(clubName: string): number {
  let hash = 0;

  for (const character of clubName) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 360;
  }

  return hash;
}

function getClubBadge(clubName: string | undefined, isDark: boolean): string {
  if (clubName === undefined || clubName.trim() === '') {
    return isDark ? 'hsl(220, 9%, 60%)' : NEUTRAL_COLOR;
  }

  return `hsl(${hashClubName(clubName)}, 60%, ${isDark ? 60 : 45}%)`;
}

export function useTheme(): ThemeColors {
  const bankName = useUserStore(state => state.profile?.bankName);
  const primaryCard = useCardsStore(state =>
    state.cards.find(card => card.isActive) ?? state.cards[0],
  );
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bankColor = BANK_COLORS[bankName ?? ''] ?? NEUTRAL_COLOR;
  const companyAccent =
    primaryCard === undefined
      ? NEUTRAL_COLOR
      : ISSUER_COLORS[primaryCard.issuer] ?? NEUTRAL_COLOR;

  return {
    bankColor: isDark ? toDarkAccent(bankColor) : bankColor,
    companyAccent: isDark ? toDarkAccent(companyAccent) : companyAccent,
    clubBadge: getClubBadge(primaryCard?.displayName, isDark),
  };
}
