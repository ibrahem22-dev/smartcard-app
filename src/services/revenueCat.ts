import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

import type { SubscriptionTier } from '../types/subscription.types';

const RC_IOS_KEY = 'appl_PLACEHOLDER';
const RC_ANDROID_KEY = 'goog_PLACEHOLDER';

const PRO_ENTITLEMENT = 'smartcard_pro';
const PLUS_ENTITLEMENT = 'smartcard_plus';

export async function initRevenueCat(): Promise<void> {
  Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({
    apiKey: Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY,
  });
}

export async function fetchSubscriptionTier(): Promise<SubscriptionTier> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const activeSubscriptions = customerInfo.activeSubscriptions;

    if (activeSubscriptions.includes(PRO_ENTITLEMENT)) {
      return 'pro';
    }

    if (activeSubscriptions.includes(PLUS_ENTITLEMENT)) {
      return 'plus';
    }

    return 'free';
  } catch {
    return 'free';
  }
}

export async function restorePurchases(): Promise<SubscriptionTier> {
  await Purchases.restorePurchases();
  return fetchSubscriptionTier();
}
