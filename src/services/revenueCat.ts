import { Platform } from 'react-native';
import type PurchasesDefault from 'react-native-purchases';
import type { LOG_LEVEL as LOG_LEVEL_TYPE } from 'react-native-purchases';

import { useSubscriptionStore } from '../store/useSubscriptionStore';
import type { SubscriptionTier } from '../types/subscription.types';
import { fetchSubscriptionTier } from './revenueCatClient';

export { fetchSubscriptionTier } from './revenueCatClient';

const RC_IOS_KEY = 'appl_PLACEHOLDER';
const RC_ANDROID_KEY = 'goog_PLACEHOLDER';

const PLUS_ENTITLEMENT = 'smartcard_plus';

export type PromoResult = {
  readonly success: boolean;
  readonly tierGranted?: 'plus' | 'pro';
  readonly monthsGranted?: number;
  readonly error?: string;
};

type PromoDefinition = {
  readonly tierGranted: 'plus' | 'pro';
  readonly monthsGranted: number;
  readonly androidOfferId: string;
};

const PROMO_DEFINITIONS: Readonly<Record<string, PromoDefinition>> = {
  'SMARTCARD-TEAM': {
    tierGranted: 'plus',
    monthsGranted: 6,
    androidOfferId: 'smartcard_team',
  },
  'SMARTCARD-IL': {
    tierGranted: 'plus',
    monthsGranted: 1,
    androidOfferId: 'smartcard_il',
  },
};

const redeemedCodes = new Set<string>();

function getPurchasesModule(): {
  default: typeof PurchasesDefault;
  LOG_LEVEL: typeof LOG_LEVEL_TYPE;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-purchases') as {
    default: typeof PurchasesDefault;
    LOG_LEVEL: typeof LOG_LEVEL_TYPE;
  };
}

export async function initRevenueCat(): Promise<void> {
  try {
    const { default: Purchases, LOG_LEVEL } = getPurchasesModule();
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({
      apiKey: Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY,
    });
  } catch (e) {
    console.warn('[RC] init failed', e);
  }
}

export async function restorePurchases(): Promise<SubscriptionTier> {
  const { default: Purchases } = getPurchasesModule();
  await Purchases.restorePurchases();
  return fetchSubscriptionTier();
}

async function presentAndroidPromoOffer(
  code: string,
  definition: PromoDefinition,
): Promise<boolean> {
  const { default: Purchases } = getPurchasesModule();
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const plusPackage = packages.find(
    candidate =>
      candidate.identifier.includes('plus') ||
      candidate.product.identifier.includes(PLUS_ENTITLEMENT),
  );
  const options = plusPackage?.product.subscriptionOptions ?? [];
  const matchingOption = options.find(
    option =>
      option.id.includes(definition.androidOfferId) ||
      option.tags.includes(code) ||
      option.tags.includes(definition.androidOfferId),
  );

  if (matchingOption === undefined) {
    return false;
  }

  await Purchases.purchaseSubscriptionOption(matchingOption);
  return true;
}

export async function redeemPromoCode(code: string): Promise<PromoResult> {
  const normalizedCode = code.trim().toUpperCase();
  const definition = PROMO_DEFINITIONS[normalizedCode];

  if (definition === undefined) {
    return { success: false, error: 'קוד לא תקין או פג תוקף' };
  }

  if (redeemedCodes.has(normalizedCode)) {
    return { success: false, error: 'קוד זה כבר נוצל' };
  }

  try {
    if (Platform.OS === 'ios') {
      const { default: Purchases } = getPurchasesModule();
      await Purchases.presentCodeRedemptionSheet();
    } else {
      const offerPresented = await presentAndroidPromoOffer(
        normalizedCode,
        definition,
      );
      if (!offerPresented) {
        return { success: false, error: 'קוד לא תקין או פג תוקף' };
      }
    }

    const confirmedTier = await fetchSubscriptionTier();
    if (confirmedTier !== definition.tierGranted && confirmedTier !== 'pro') {
      return { success: false, error: 'לא ניתן לאמת את מימוש הקוד' };
    }

    useSubscriptionStore.getState().setTier(confirmedTier);
    redeemedCodes.add(normalizedCode);

    return {
      success: true,
      tierGranted: definition.tierGranted,
      monthsGranted: definition.monthsGranted,
    };
  } catch {
    return { success: false, error: 'לא ניתן לממש את הקוד כעת' };
  }
}
