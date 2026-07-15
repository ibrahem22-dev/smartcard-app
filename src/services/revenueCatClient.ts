import type Purchases from 'react-native-purchases';

import type { SubscriptionTier } from '../types/subscription.types';

const PRO_ENTITLEMENT = 'smartcard_pro';
const PLUS_ENTITLEMENT = 'smartcard_plus';

function getPurchases(): typeof Purchases {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-purchases') as {
    default: typeof Purchases;
  };
  return mod.default;
}

export async function fetchSubscriptionTier(): Promise<SubscriptionTier> {
  try {
    const PurchasesInstance = getPurchases();
    const customerInfo = await PurchasesInstance.getCustomerInfo();
    const activeSubscriptions = customerInfo.activeSubscriptions;
    const activeEntitlements = customerInfo.entitlements.active;

    if (
      activeEntitlements[PRO_ENTITLEMENT] !== undefined ||
      activeSubscriptions.includes(PRO_ENTITLEMENT)
    ) {
      return 'pro';
    }

    if (
      activeEntitlements[PLUS_ENTITLEMENT] !== undefined ||
      activeSubscriptions.includes(PLUS_ENTITLEMENT)
    ) {
      return 'plus';
    }

    return 'free';
  } catch {
    return 'free';
  }
}
