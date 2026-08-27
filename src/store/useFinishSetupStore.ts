import { MMKV } from 'react-native-mmkv';
import { create } from 'zustand';

export const FINISH_SETUP_STEPS = ['income', 'add-card', 'security'] as const;
export type FinishSetupStep = (typeof FINISH_SETUP_STEPS)[number];

const storage = new MMKV({ id: 'onboarding-temp' });
const SKIPPED_KEY = 'finish_setup_skipped';
const DISMISSED_KEY = 'finish_setup_dismissed';

function isFinishSetupStep(value: unknown): value is FinishSetupStep {
  return (
    value === 'income' || value === 'add-card' || value === 'security'
  );
}

function readSkipped(): readonly FinishSetupStep[] {
  const raw = storage.getString(SKIPPED_KEY);
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFinishSetupStep);
  } catch {
    return [];
  }
}

function readDismissed(): boolean {
  return storage.getBoolean(DISMISSED_KEY) ?? false;
}

interface FinishSetupState {
  readonly skipped: readonly FinishSetupStep[];
  readonly dismissed: boolean;
  recordSkipped(steps: readonly FinishSetupStep[]): void;
  dismiss(): void;
  hydrate(): void;
}

export const useFinishSetupStore = create<FinishSetupState>(set => ({
  skipped: readSkipped(),
  dismissed: readDismissed(),
  recordSkipped(steps: readonly FinishSetupStep[]): void {
    const unique = FINISH_SETUP_STEPS.filter(step => steps.includes(step));
    storage.set(SKIPPED_KEY, JSON.stringify(unique));
    storage.set(DISMISSED_KEY, false);
    set({ skipped: unique, dismissed: false });
  },
  dismiss(): void {
    storage.set(DISMISSED_KEY, true);
    set({ dismissed: true });
  },
  hydrate(): void {
    set({ skipped: readSkipped(), dismissed: readDismissed() });
  },
}));

export function finishSetupIsVisible(
  skipped: readonly FinishSetupStep[],
  dismissed: boolean,
): boolean {
  return skipped.length > 0 && !dismissed;
}
