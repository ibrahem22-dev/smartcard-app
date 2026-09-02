import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import { Currency, PurchaseCategory } from '../../types/purchase.types';
import { MMKV_KEYS } from '../../store/keys';
import i18n from '../../i18n';

const mockStorage = new Map<string, string>();
const mockRequestPermissions = jest.fn();
const mockSchedule = jest.fn();
const mockCancel = jest.fn();

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'he' }],
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
  })),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: mockRequestPermissions,
  scheduleNotificationAsync: mockSchedule,
  cancelScheduledNotificationAsync: mockCancel,
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    YEARLY: 'yearly',
  },
}));

jest.mock('../../security/keyVault', () => ({
  keyVault: {
    getEncryptedStorage: () => ({
      getString: (key: string): string | undefined => mockStorage.get(key),
      set: (key: string, value: string | number | boolean): void => {
        mockStorage.set(key, String(value));
      },
      delete: (key: string): void => {
        mockStorage.delete(key);
      },
    }),
  },
}));

import {
  cancelBillingReminders,
  cancelDiscountReminders,
  scheduleAnnualGlobalReminder,
  scheduleBillingReminders,
  scheduleDiscountReminders,
} from '../notificationScheduler';

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'card-1',
    displayName: 'Max Gold',
    last4: '1234',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: { creditLimit: 20_000, currentBalance: 1_000 },
    billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
    roleTags: [CardRole.Benefits],
    primaryRole: CardRole.Benefits,
    rewardCategories: [PurchaseCategory.Groceries],
    cashbackRate: 0.02,
    foreignTransactionFee: 0.025,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
    cardFee: {
      originalFee: 20,
      discountPercent: 50,
      effectiveFee: 10,
      discountEndDate: '2031-06-30',
      discountSource: 'manual',
    },
    ...overrides,
  };
}

describe('notificationScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2031, 0, 1, 12));
    jest.clearAllMocks();
    mockStorage.clear();
    mockStorage.set(MMKV_KEYS.activeProfileId, 'profile-1');
    mockRequestPermissions.mockResolvedValue({ granted: true });
    mockCancel.mockResolvedValue(undefined);
    i18n.changeLanguage('he');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('cancels existing IDs and schedules 30-day, 7-day, and expiry reminders', async () => {
    const key = MMKV_KEYS.profileCardNotificationIds(
      'profile-1',
      'card-1',
    );
    mockStorage.set(key, JSON.stringify(['old-1', 'old-2']));
    mockSchedule
      .mockResolvedValueOnce('new-30')
      .mockResolvedValueOnce('new-7')
      .mockResolvedValueOnce('new-expiry');

    await scheduleDiscountReminders(makeCard());

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith('old-1');
    expect(mockCancel).toHaveBeenCalledWith('old-2');
    expect(mockSchedule).toHaveBeenNthCalledWith(1, {
      content: {
        title: 'ההנחה על דמי כרטיס עומדת לפוג',
        body: 'כרטיס 1234 — ההנחה פגה ב-2031-06-30. בדוק מול חברת הכרטיסים.',
        data: { cardId: 'card-1', reminderType: 'discount_expiry' },
      },
      trigger: {
        type: 'date',
        date: new Date(2031, 4, 31, 9),
      },
    });
    expect(mockSchedule).toHaveBeenNthCalledWith(2, {
      content: expect.any(Object),
      trigger: {
        type: 'date',
        date: new Date(2031, 5, 23, 9),
      },
    });
    expect(mockSchedule).toHaveBeenNthCalledWith(3, {
      content: expect.any(Object),
      trigger: {
        type: 'date',
        date: new Date(2031, 5, 30, 9),
      },
    });
    expect(mockStorage.get(key)).toBe(
      JSON.stringify(['new-30', 'new-7', 'new-expiry']),
    );
  });

  test('schedules an annual reminder eleven months after issuance month', async () => {
    mockSchedule.mockResolvedValue('annual-card');
    const card = makeCard({
      cardFee: {
        originalFee: 20,
        discountPercent: 50,
        effectiveFee: 10,
        discountSource: 'manual',
      },
      cardIssuanceDate: '2025-03-15',
    });

    await scheduleDiscountReminders(card);

    expect(mockSchedule).toHaveBeenCalledWith({
      content: {
        title: 'תזכורת שנתית — דמי כרטיס',
        body: 'כרטיס 1234 — האם קיבלת הנחה על דמי הכרטיס השנה?',
        data: { cardId: 'card-1', reminderType: 'annual_card_fee' },
      },
      trigger: {
        type: 'yearly',
        day: 15,
        month: 1,
        hour: 9,
        minute: 0,
      },
    });
  });

  test('schedules one global January 1 reminder and stores its ID', async () => {
    mockSchedule.mockResolvedValue('new-global');

    await scheduleAnnualGlobalReminder();

    expect(mockSchedule).toHaveBeenCalledWith({
      content: {
        title: 'תזכורת שנתית — דמי כרטיס',
        body: 'בדוק את ההנחות על דמי הכרטיסים שלך',
        data: { reminderType: 'global_card_fee' },
      },
      trigger: {
        type: 'yearly',
        day: 1,
        month: 0,
        hour: 9,
        minute: 0,
      },
    });
    expect(mockStorage.get(MMKV_KEYS.globalDiscountReminderId)).toBe(
      'new-global',
    );
  });

  test('does not duplicate an existing global reminder', async () => {
    mockStorage.set(MMKV_KEYS.globalDiscountReminderId, 'existing-global');

    await scheduleAnnualGlobalReminder();

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  test('does not cancel or schedule when notification permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: false });

    await scheduleDiscountReminders(makeCard());

    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  test('cancels and removes stored card reminders when a card is deleted', async () => {
    const key = MMKV_KEYS.profileCardNotificationIds(
      'profile-1',
      'card-1',
    );
    mockStorage.set(key, JSON.stringify(['delete-1', 'delete-2']));

    await cancelDiscountReminders('card-1');

    expect(mockCancel).toHaveBeenCalledWith('delete-1');
    expect(mockCancel).toHaveBeenCalledWith('delete-2');
    expect(mockStorage.has(key)).toBe(false);
  });

  test('billing permission denied schedules nothing and leaves prior IDs untouched', async () => {
    const key = MMKV_KEYS.profileCardBillingNotificationIds('profile-1', 'card-1');
    mockStorage.set(key, JSON.stringify(['old-billing']));
    mockRequestPermissions.mockResolvedValue({ granted: false });

    await scheduleBillingReminders(makeCard());

    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockStorage.get(key)).toBe(JSON.stringify(['old-billing']));
  });

  test('billing day absent cancels prior IDs and schedules nothing', async () => {
    const key = MMKV_KEYS.profileCardBillingNotificationIds('profile-1', 'card-1');
    mockStorage.set(key, JSON.stringify(['old-billing']));
    const card = makeCard({
      billingCycle: { statementClosingDay: 5, billingDayOfMonth: undefined as never },
    });

    await scheduleBillingReminders(card);

    expect(mockCancel).toHaveBeenCalledWith('old-billing');
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockStorage.has(key)).toBe(false);
  });

  test('billing re-schedule replaces prior IDs instead of adding to them', async () => {
    const key = MMKV_KEYS.profileCardBillingNotificationIds('profile-1', 'card-1');
    mockStorage.set(key, JSON.stringify(['old-1', 'old-2']));
    mockSchedule.mockImplementation(async () => `new-${mockSchedule.mock.calls.length}`);

    await scheduleBillingReminders(makeCard());

    expect(mockCancel).toHaveBeenCalledWith('old-1');
    expect(mockCancel).toHaveBeenCalledWith('old-2');
    expect(mockSchedule).toHaveBeenCalledTimes(12);
    expect(mockSchedule).toHaveBeenNthCalledWith(1, {
      content: {
        title: 'יום החיוב של הכרטיס הגיע',
        body: 'כרטיס 1234 — היום הוא יום החיוב',
        data: { cardId: 'card-1', reminderType: 'card_billing' },
      },
      trigger: { type: 'date', date: new Date(2031, 0, 10, 9) },
    });
    expect(JSON.parse(mockStorage.get(key) ?? '[]')).toEqual(
      Array.from({ length: 12 }, (_, index) => `new-${index + 1}`),
    );
  });

  test('billing throw mid-schedule cancels IDs created by that attempt', async () => {
    const key = MMKV_KEYS.profileCardBillingNotificationIds('profile-1', 'card-1');
    mockSchedule
      .mockResolvedValueOnce('new-1')
      .mockRejectedValueOnce(new Error('NATIVE_SCHEDULE_FAILED'));

    await expect(scheduleBillingReminders(makeCard())).rejects.toThrow(
      'NATIVE_SCHEDULE_FAILED',
    );

    expect(mockCancel).toHaveBeenCalledWith('new-1');
    expect(mockStorage.has(key)).toBe(false);
  });

  test('cancels billing IDs from their distinct storage key', async () => {
    const billingKey = MMKV_KEYS.profileCardBillingNotificationIds('profile-1', 'card-1');
    const discountKey = MMKV_KEYS.profileCardNotificationIds('profile-1', 'card-1');
    mockStorage.set(billingKey, JSON.stringify(['billing-1']));
    mockStorage.set(discountKey, JSON.stringify(['discount-1']));

    await cancelBillingReminders('card-1');

    expect(mockCancel).toHaveBeenCalledWith('billing-1');
    expect(mockCancel).not.toHaveBeenCalledWith('discount-1');
    expect(mockStorage.has(billingKey)).toBe(false);
    expect(mockStorage.get(discountKey)).toBe(JSON.stringify(['discount-1']));
  });
});
