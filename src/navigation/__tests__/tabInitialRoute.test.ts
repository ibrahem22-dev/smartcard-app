/**
 * THE APP OPENS ON HOME IN EVERY DIRECTION.
 *
 * React Navigation defaults `initialRouteName` to a tab navigator's FIRST CHILD. `TabNavigator`
 * renders its children from `getTabsForDirection`, which REVERSES the IA order under RTL so the bar
 * reads right-to-left — and that made More the first child in Hebrew and Arabic. Every unlock in the
 * app's own default language landed the reader on the More list rather than the Command Center.
 * It was found on the device: the screen after unlocking artifact #8 read *"עוד · הגדרות · לומדים:
 * מילון, זכויות ואנשי קשר"*, and Home rendered only when its tab was tapped.
 *
 * This suite pins both halves: the reversal that caused it (which is correct and must stay), and
 * the explicit `initialRouteName` that separates the ORDER of the bar from the SCREEN the app opens
 * on. It reads the navigator's source rather than mounting it because mounting the real tab tree
 * pulls the whole authenticated graph — SQLite, notifications, every screen — into a suite whose
 * question is one prop. What it cannot do is pass while the prop is absent.
 */
import fs from 'node:fs';
import path from 'node:path';

import { TAB_ITEMS } from '../ia';
import { getTabsForDirection } from '../../utils/direction';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'TabNavigator.tsx'),
  'utf8',
);

describe('the tab navigator opens on Home', () => {
  it('declares the initial route explicitly', () => {
    expect(SOURCE).toContain('initialRouteName="Home"');
  });

  it('and needs to, because the first child differs by direction', () => {
    const keys = TAB_ITEMS.map((item) => item.key);
    const ltr = getTabsForDirection(keys, false);
    const rtl = getTabsForDirection(keys, true);

    expect(ltr[0]).toBe('Home');
    // The defect, stated as a fact rather than as a memory: in RTL the first child is NOT Home, so
    // the default would open the app somewhere else.
    expect(rtl[0]).not.toBe('Home');
    expect(rtl).toEqual([...ltr].reverse());
    expect(rtl).toContain('Home');
  });

  it('keeps five items in the bar — criterion A1 — with Home among them', () => {
    // TAB_ITEMS is the four non-raised tabs; the raised Check action is the fifth item.
    expect(TAB_ITEMS).toHaveLength(4);
    expect(TAB_ITEMS.map((item) => item.key)).toContain('Home');
  });
});
