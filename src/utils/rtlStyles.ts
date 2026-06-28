// @deprecated RTL experiment — NOT used at runtime (no importers).
// Also a layering violation (a util importing a hook). Kept for reference only;
// safe to delete once the device-verified fix is confirmed.
import { useMemo } from 'react';

import { useAppDirection } from '../hooks/useAppDirection';

const STATIC = {
  screen: {
    flex: 1,
  },
  scrollOuter: {
    flex: 1,
  },
  scrollInner: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  listInner: {
    flexGrow: 1,
  },
} as const;

export function useRtlStyles(): {
  readonly row: { flexDirection: 'row-reverse' | 'row'; alignItems: 'center' };
  readonly screen: { flex: 1 };
  readonly scrollOuter: { flex: 1 };
  readonly scrollInner: { flexGrow: number; paddingBottom: number };
  readonly listInner: { flexGrow: number };
  readonly inputStyle: () => {
    textAlign: 'left' | 'right';
    writingDirection: 'rtl' | 'ltr';
  };
} {
  const { row, textAlign, writingDirection } = useAppDirection();

  return useMemo(
    () => ({
      row,
      ...STATIC,
      inputStyle: () => ({ textAlign, writingDirection }),
    }),
    [row, textAlign, writingDirection],
  );
}
