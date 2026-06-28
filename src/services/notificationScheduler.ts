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

function expiryContent(
  card: CardInput,
  expiryDate: string,
): Notifications.NotificationContentInput {
  return {
    title: 'ההנחה על דמי כרטיס עומדת לפוג',
    body: `כרטיס ${card.last4} — ההנחה פגה ב-${expiryDate}. בדוק מול חברת הכרטיסים.`,
    data: { cardId: card.cardId, reminderType: 'discount_expiry' },
  };
}

export async function scheduleDiscountReminders(
  card: CardInput,
): Promise<void> {
  const profileId = activeProfileId();
  const storage = keyVault.getEncryptedStorage();
  const key = notificationKey(profileId, card.cardId);
  const existingIds = parseStoredIds(storage.getString(key));
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
          content: expiryContent(card, discountEndDate),
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
        content: {
          title: 'תזכורת שנתית — דמי כרטיס',
          body: `כרטיס ${card.last4} — האם קיבלת הנחה על דמי הכרטיס השנה?`,
          data: {
            cardId: card.cardId,
            reminderType: 'annual_card_fee',
          },
        },
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
  const existingId = storage.getString(MMKV_KEYS.globalDiscountReminderId);
  if (existingId !== undefined) {
    return;
  }
  if (!(await hasPermission())) {
    return;
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'תזכורת שנתית — דמי כרטיס',
      body: 'בדוק את ההנחות על דמי הכרטיסים שלך',
      data: { reminderType: 'global_card_fee' },
    },
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
