import * as Notifications from 'expo-notifications';

import { keyVault } from '../security/keyVault';
import { MMKV_KEYS } from '../store/keys';
import type { CardInput } from '../types/card.types';

const REMINDER_HOUR = 9;
const DAY_IN_MS = 24 * 60 * 60 * 1_000;
const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]+$/;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function requireSafeIdentifier(value: string): string {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error('INVALID_NOTIFICATION_IDENTIFIER');
  }
  return value;
}

function activeProfileId(): string {
  const profileId = keyVault
    .getEncryptedStorage()
    .getString(MMKV_KEYS.activeProfileId);
  if (profileId === undefined) {
    throw new Error('ACTIVE_PROFILE_REQUIRED');
  }
  return requireSafeIdentifier(profileId);
}

function notificationKey(profileId: string, cardId: string): string {
  return MMKV_KEYS.profileCardNotificationIds(
    requireSafeIdentifier(profileId),
    requireSafeIdentifier(cardId),
  );
}

export function notificationsEnabled(): boolean {
  return (
    keyVault
      .getEncryptedStorage()
      .getString(MMKV_KEYS.notificationsEnabled) === 'true'
  );
}

export function setNotificationsEnabled(enabled: boolean): void {
  keyVault
    .getEncryptedStorage()
    .set(MMKV_KEYS.notificationsEnabled, String(enabled));
}

function parseStoredIds(raw: string | undefined): string[] {
  if (raw === undefined) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) &&
      value.every((item: unknown): item is string => typeof item === 'string')
      ? value
      : [];
  } catch {
    return [];
  }
}

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, REMINDER_HOUR, 0, 0, 0);
  return date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
    ? date
    : null;
}

async function cancelIds(ids: readonly string[]): Promise<void> {
  await Promise.all(
    ids.map((id: string): Promise<void> =>
      Notifications.cancelScheduledNotificationAsync(id),
    ),
  );
}

async function hasPermission(): Promise<boolean> {
  const permission = await Notifications.requestPermissionsAsync();
  return permission.granted;
}

/** Permission is requested only from an explicit user action on the Data & Privacy surface. */
export async function requestLocalNotificationPermission(): Promise<boolean> {
  return hasPermission();
}

export function buildGenericReminderContent(
  reminderType: 'billing' | 'discount_expiry' | 'annual_card_fee',
): Notifications.NotificationContentInput {
  const copy = {
    billing: {
      title: 'תזכורת תפעולית',
      body: 'מועד חיוב מתקרב. פתח את האפליקציה לפרטים.',
    },
    discount_expiry: {
      title: 'תזכורת תפעולית',
      body: 'הטבת דמי כרטיס מתקרבת לסיומה. פתח את האפליקציה לפרטים.',
    },
    annual_card_fee: {
      title: 'תזכורת תפעולית',
      body: 'מומלץ לבדוק את תנאי דמי הכרטיס. פתח את האפליקציה לפרטים.',
    },
  } as const;
  return {
    ...copy[reminderType],
    data: { reminderType },
  };
}

export async function scheduleDiscountReminders(
  card: CardInput,
): Promise<void> {
  const profileId = activeProfileId();
  const storage = keyVault.getEncryptedStorage();
  const key = notificationKey(profileId, card.cardId);
  const existingIds = parseStoredIds(storage.getString(key));
  if (!notificationsEnabled()) {
    return;
  }
  if (!(await hasPermission())) {
    return;
  }

  await cancelIds(existingIds);
  storage.delete(key);
  if (card.cardFee === undefined) {
    return;
  }

  const scheduledIds: string[] = [];
  try {
    const discountEndDate = card.cardFee.discountEndDate;
    const expiryDate =
      discountEndDate === undefined
        ? null
        : parseLocalDate(discountEndDate);
    if (discountEndDate !== undefined && expiryDate === null) {
      throw new Error('INVALID_DISCOUNT_END_DATE');
    }

    if (expiryDate !== null && discountEndDate !== undefined) {
      const dates = [
        new Date(expiryDate.getTime() - 30 * DAY_IN_MS),
        new Date(expiryDate.getTime() - 7 * DAY_IN_MS),
        expiryDate,
      ].filter((date: Date): boolean => date.getTime() > Date.now());

      for (const triggerDate of dates) {
        const id = await Notifications.scheduleNotificationAsync({
          content: buildGenericReminderContent('discount_expiry'),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });
        scheduledIds.push(id);
      }
    } else if (card.cardIssuanceDate !== undefined) {
      const issuanceDate = parseLocalDate(card.cardIssuanceDate);
      if (issuanceDate === null) {
        throw new Error('INVALID_CARD_ISSUANCE_DATE');
      }
      const annualDate = new Date(issuanceDate);
      annualDate.setMonth(annualDate.getMonth() + 11);
      const id = await Notifications.scheduleNotificationAsync({
        content: buildGenericReminderContent('annual_card_fee'),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.YEARLY,
          day: annualDate.getDate(),
          month: annualDate.getMonth(),
          hour: REMINDER_HOUR,
          minute: 0,
        },
      });
      scheduledIds.push(id);
    }

    if (scheduledIds.length > 0) {
      storage.set(key, JSON.stringify(scheduledIds));
    }
  } catch (error: unknown) {
    await cancelIds(scheduledIds);
    throw error;
  }
}

export async function cancelDiscountReminders(cardId: string): Promise<void> {
  const profileId = activeProfileId();
  const storage = keyVault.getEncryptedStorage();
  const key = notificationKey(profileId, cardId);
  const existingIds = parseStoredIds(storage.getString(key));
  await cancelIds(existingIds);
  storage.delete(key);
}

export async function scheduleAnnualGlobalReminder(): Promise<void> {
  const storage = keyVault.getEncryptedStorage();
  if (!notificationsEnabled()) {
    return;
  }
  const existingId = storage.getString(MMKV_KEYS.globalDiscountReminderId);
  if (existingId !== undefined) {
    return;
  }
  if (!(await hasPermission())) {
    return;
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: buildGenericReminderContent('annual_card_fee'),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.YEARLY,
      day: 1,
      month: 0,
      hour: REMINDER_HOUR,
      minute: 0,
    },
  });
  storage.set(MMKV_KEYS.globalDiscountReminderId, id);
}

export async function scheduleBillingReminder(card: CardInput): Promise<void> {
  if (!notificationsEnabled() || !(await hasPermission())) {
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: buildGenericReminderContent('billing'),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: card.billingCycle.billingDayOfMonth,
      hour: REMINDER_HOUR,
      minute: 0,
    },
  });
}

export async function cancelAllLocalNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
