const callOrder: string[] = [];
const mockClearProfile = jest.fn(() => callOrder.push('clearProfile'));
const mockClearCards = jest.fn(() => callOrder.push('clearCards'));
const mockClearLoans = jest.fn(() => callOrder.push('clearLoans'));
const mockClearActivity = jest.fn(() => callOrder.push('clearActivity'));
const mockClearProfiles = jest.fn(() => callOrder.push('clearProfiles'));
const mockHydrate = jest.fn(() => callOrder.push('hydrate'));
const mockLock = jest.fn(() => callOrder.push('lock'));
const mockIsUnlocked = jest.fn(() => true);
const mockCanMountSecureNavigator = jest.fn(() => true);

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getBoolean: jest.fn(() => false),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('../../security/keyVault', () => ({
  keyVault: {
    lock: mockLock,
    isUnlocked: mockIsUnlocked,
    canMountSecureNavigator: mockCanMountSecureNavigator,
    isInitialized: jest.fn(async () => true),
    getAuthStatus: jest.fn(async () => 'LOCKED'),
    wipeVault: jest.fn(async () => undefined),
    unlockWithBiometric: jest.fn(async () => ({ ok: true })),
  },
}));

jest.mock('../../store/useUserStore', () => ({
  useUserStore: {
    getState: () => ({ clearProfile: mockClearProfile }),
  },
}));

jest.mock('../../store/useCardsStore', () => ({
  useCardsStore: {
    getState: () => ({ clearCards: mockClearCards }),
  },
}));

jest.mock('../../store/useLoansStore', () => ({
  useLoansStore: {
    getState: () => ({ clearLoans: mockClearLoans }),
  },
}));

jest.mock('../../store/useActivityStore', () => ({
  useActivityStore: {
    getState: () => ({ clearActivity: mockClearActivity }),
  },
}));

jest.mock('../../store/useProfileStore', () => ({
  useProfileStore: {
    getState: () => ({
      clearProfiles: mockClearProfiles,
      hydrate: mockHydrate,
      allProfiles: [],
    }),
  },
}));

describe('auth lifecycle AUTH-07 grace handling', () => {
  beforeEach(() => {
    callOrder.length = 0;
    jest.clearAllMocks();
    mockIsUnlocked.mockReturnValue(true);
    mockCanMountSecureNavigator.mockReturnValue(true);
    const { __resetAuth07GraceForTests } = require('../authLifecycle') as typeof import('../authLifecycle');
    __resetAuth07GraceForTests();
  });

  test('pre-lock helper locks keyVault before clearing stores', () => {
    const { preLockClearAndLockVault } = require('../authLifecycle') as typeof import('../authLifecycle');

    preLockClearAndLockVault();

    expect(mockLock).toHaveBeenCalledTimes(1);
    expect(mockClearProfile).toHaveBeenCalledTimes(1);
    expect(mockClearCards).toHaveBeenCalledTimes(1);
    expect(mockClearLoans).toHaveBeenCalledTimes(1);
    expect(mockClearActivity).toHaveBeenCalledTimes(1);
    expect(mockClearProfiles).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual([
      'lock',
      'clearProfile',
      'clearCards',
      'clearLoans',
      'clearActivity',
      'clearProfiles',
    ]);
  });

  test('starts in-process grace from known-valid unlocked session without persisting authority', () => {
    const {
      beginAuth07InProcessGraceOrLock,
    } = require('../authLifecycle') as typeof import('../authLifecycle');

    const result = beginAuth07InProcessGraceOrLock(true, 1_000);

    expect(result).toBe('GRACE_STARTED');
    expect(mockLock).not.toHaveBeenCalled();
    expect(callOrder).toEqual([
      'clearProfile',
      'clearCards',
      'clearLoans',
      'clearActivity',
      'clearProfiles',
    ]);
  });

  test('restores within five-minute grace only while keyVault remains unlocked', () => {
    const {
      beginAuth07InProcessGraceOrLock,
      resolveAuth07ForegroundGrace,
    } = require('../authLifecycle') as typeof import('../authLifecycle');

    beginAuth07InProcessGraceOrLock(true, 1_000);
    callOrder.length = 0;

    const result = resolveAuth07ForegroundGrace(1_000 + 5 * 60 * 1000);

    expect(result).toBe('RESTORE_UNLOCKED');
    expect(mockLock).not.toHaveBeenCalled();
    expect(mockHydrate).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['hydrate']);
  });

  test('keeps existing grace across repeated non-active transitions without resetting the clock', () => {
    const {
      beginAuth07InProcessGraceOrLock,
      resolveAuth07ForegroundGrace,
    } = require('../authLifecycle') as typeof import('../authLifecycle');

    expect(beginAuth07InProcessGraceOrLock(true, 1_000)).toBe('GRACE_STARTED');
    expect(beginAuth07InProcessGraceOrLock(false, 2_000)).toBe('GRACE_STARTED');
    callOrder.length = 0;

    const result = resolveAuth07ForegroundGrace(1_000 + 5 * 60 * 1000 + 1);

    expect(result).toBe('LOCKED');
    expect(callOrder).toEqual([
      'lock',
      'clearProfile',
      'clearCards',
      'clearLoans',
      'clearActivity',
      'clearProfiles',
    ]);
  });

  test('locks and clears when grace has expired', () => {
    const {
      beginAuth07InProcessGraceOrLock,
      resolveAuth07ForegroundGrace,
    } = require('../authLifecycle') as typeof import('../authLifecycle');

    beginAuth07InProcessGraceOrLock(true, 1_000);
    callOrder.length = 0;

    const result = resolveAuth07ForegroundGrace(1_000 + 5 * 60 * 1000 + 1);

    expect(result).toBe('LOCKED');
    expect(callOrder).toEqual([
      'lock',
      'clearProfile',
      'clearCards',
      'clearLoans',
      'clearActivity',
      'clearProfiles',
    ]);
    expect(mockHydrate).not.toHaveBeenCalled();
  });

  test('cold start with no in-process grace never restores', () => {
    const {
      resolveAuth07ForegroundGrace,
    } = require('../authLifecycle') as typeof import('../authLifecycle');

    const result = resolveAuth07ForegroundGrace(1_000);

    expect(result).toBe('NO_GRACE');
    expect(mockLock).not.toHaveBeenCalled();
    expect(mockHydrate).not.toHaveBeenCalled();
  });

  test('missing grace timestamp with known-valid marker fails closed', () => {
    const {
      __setAuth07GraceForTests,
      resolveAuth07ForegroundGrace,
    } = require('../authLifecycle') as typeof import('../authLifecycle');

    __setAuth07GraceForTests({
      inactiveSinceMs: null,
      sessionKnownValid: true,
    });

    const result = resolveAuth07ForegroundGrace(1_000);

    expect(result).toBe('LOCKED');
    expect(callOrder).toEqual([
      'lock',
      'clearProfile',
      'clearCards',
      'clearLoans',
      'clearActivity',
      'clearProfiles',
    ]);
    expect(mockHydrate).not.toHaveBeenCalled();
  });

  test('corrupt grace timestamp with known-valid marker fails closed', () => {
    const {
      __setAuth07GraceForTests,
      resolveAuth07ForegroundGrace,
    } = require('../authLifecycle') as typeof import('../authLifecycle');

    __setAuth07GraceForTests({
      inactiveSinceMs: Number.NaN,
      sessionKnownValid: true,
    });

    const result = resolveAuth07ForegroundGrace(1_000);

    expect(result).toBe('LOCKED');
    expect(callOrder).toEqual([
      'lock',
      'clearProfile',
      'clearCards',
      'clearLoans',
      'clearActivity',
      'clearProfiles',
    ]);
    expect(mockHydrate).not.toHaveBeenCalled();
  });

  test('negative clock movement fails closed', () => {
    const {
      beginAuth07InProcessGraceOrLock,
      resolveAuth07ForegroundGrace,
    } = require('../authLifecycle') as typeof import('../authLifecycle');

    beginAuth07InProcessGraceOrLock(true, 2_000);
    callOrder.length = 0;

    const result = resolveAuth07ForegroundGrace(1_999);

    expect(result).toBe('LOCKED');
    expect(callOrder).toEqual([
      'lock',
      'clearProfile',
      'clearCards',
      'clearLoans',
      'clearActivity',
      'clearProfiles',
    ]);
    expect(mockHydrate).not.toHaveBeenCalled();
  });

  test('invalid background timestamp does not start grace and locks immediately', () => {
    const {
      beginAuth07InProcessGraceOrLock,
    } = require('../authLifecycle') as typeof import('../authLifecycle');

    const result = beginAuth07InProcessGraceOrLock(true, Number.NaN);

    expect(result).toBe('LOCKED');
    expect(callOrder).toEqual([
      'lock',
      'clearProfile',
      'clearCards',
      'clearLoans',
      'clearActivity',
      'clearProfiles',
    ]);
    expect(mockHydrate).not.toHaveBeenCalled();
  });

  test('fails closed when vault routing authority is unavailable during grace', () => {
    const {
      beginAuth07InProcessGraceOrLock,
      resolveAuth07ForegroundGrace,
    } = require('../authLifecycle') as typeof import('../authLifecycle');

    beginAuth07InProcessGraceOrLock(true, 1_000);
    callOrder.length = 0;
    mockCanMountSecureNavigator.mockReturnValue(false);

    const result = resolveAuth07ForegroundGrace(1_001);

    expect(result).toBe('LOCKED');
    expect(callOrder).toEqual([
      'lock',
      'clearProfile',
      'clearCards',
      'clearLoans',
      'clearActivity',
      'clearProfiles',
    ]);
    expect(mockHydrate).not.toHaveBeenCalled();
  });
});
