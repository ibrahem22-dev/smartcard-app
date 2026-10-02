import { useColorScheme } from 'react-native';

import { useAuth } from '../navigation/authContext';
import { useCardsStore } from '../store/useCardsStore';
import { useUserStore } from '../store/useUserStore';
import { BANK_BRAND, BRAND_NEUTRAL, ISSUER_BRAND } from '../theme/tokens';
import { CardIssuer } from '../types/card.types';

/**
 * THE ISSUER AND BANK COLOURS MOVED TO THE TOKEN MODULE (A8), and this file reads them.
 *
 * They are BRAND identity and not semantic: Bank Leumi's blue says nothing about whether using the
 * card is a good idea. A8's second half is unqualified — *no raw colour literal outside the token
 * module* — and makes no exception for a colour that carries no judgement, which is right: the next
 * person to add an issuer would otherwise have added its hex here, and the token module would have
 * been the one place colour lives except for the eight that were not.
 */
const NEUTRAL_COLOR = BRAND_NEUTRAL;

const BANK_COLORS: Readonly<Record<string, string>> = BANK_BRAND;

const ISSUER_COLORS: Readonly<Record<CardIssuer, string>> = {
  [CardIssuer.Max]: ISSUER_BRAND.max,
  [CardIssuer.Isracard]: ISSUER_BRAND.isracard,
  [CardIssuer.Cal]: ISSUER_BRAND.cal,
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
  const { isUnlocked } = useAuth();
  const storedBankName = useUserStore(state => state.profile?.bankName);
  const storedPrimaryCard = useCardsStore(state =>
    state.cards.find(card => card.isActive) ?? state.cards[0],
  );
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bankName = isUnlocked ? storedBankName : undefined;
  const primaryCard = isUnlocked ? storedPrimaryCard : undefined;

  if (!isUnlocked) {
    return {
      bankColor: NEUTRAL_COLOR,
      companyAccent: NEUTRAL_COLOR,
      clubBadge: NEUTRAL_COLOR,
    };
  }

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
