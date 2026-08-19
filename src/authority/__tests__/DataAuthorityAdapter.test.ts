import {
  DisabledDataAuthorityAdapter,
  INTEGRATION_DISABLED_REASON,
  getDataAuthorityAdapter,
  hasOfficialAuthorityFor,
  resetDataAuthorityAdapter,
  setDataAuthorityAdapter,
  type DataAuthorityAdapter,
} from '../DataAuthorityAdapter';
import { isCurrentAuthority, known } from '../authorityValue';

describe('W1-AS-01 Data Authority Adapter contract', () => {
  afterEach(() => {
    resetDataAuthorityAdapter();
  });

  it('defaults to the disabled adapter', () => {
    const adapter = getDataAuthorityAdapter();
    expect(adapter.adapterId).toBe('DISABLED_DATA_AUTHORITY_ADAPTER');
    expect(adapter.isLive).toBe(false);
  });

  it('BLOCKS rather than inventing data, and says why', () => {
    const adapter = new DisabledDataAuthorityAdapter();
    const value = adapter.lookupNumber({
      field: 'card.fx.foreignFeePercent',
      entityId: 'cal-365-vip',
    });
    expect(value.state).toBe('BLOCKED');
    if (value.state === 'BLOCKED') {
      expect(value.reason).toContain(INTEGRATION_DISABLED_REASON);
      expect(value.reason).toContain('card.fx.foreignFeePercent');
    }
    // BLOCKED, not UNKNOWN: "not permitted to look" differs from "looked and
    // do not know", and the UI is entitled to that distinction.
    expect(adapter.lookupText({ field: 'card.name', entityId: 'x' }).state).toBe(
      'BLOCKED',
    );
  });

  it('never reports official authority while disabled', () => {
    expect(
      hasOfficialAuthorityFor({ field: 'card.fee', entityId: 'x' }),
    ).toBe(false);
  });

  it('refuses to install a live adapter without an Owner integration decision', () => {
    const live: DataAuthorityAdapter = {
      adapterId: 'PRETEND_LIVE',
      isLive: true,
      lookupNumber: () => known(2.8, 'OFFICIAL_AUTHORITY', '2026-01-01'),
      lookupText: () => known('x', 'OFFICIAL_AUTHORITY', '2026-01-01'),
    };
    expect(() => setDataAuthorityAdapter(live)).toThrow(/APP-DEC-10/);
    // And the disabled adapter is still installed.
    expect(getDataAuthorityAdapter().isLive).toBe(false);
  });

  it('allows a non-live test adapter to be installed', () => {
    const stub: DataAuthorityAdapter = {
      adapterId: 'TEST',
      isLive: false,
      lookupNumber: () => known(1, 'OFFICIAL_AUTHORITY', '2026-01-01'),
      lookupText: () => known('t', 'OFFICIAL_AUTHORITY', '2026-01-01'),
    };
    setDataAuthorityAdapter(stub);
    expect(getDataAuthorityAdapter().adapterId).toBe('TEST');
    expect(
      isCurrentAuthority(
        getDataAuthorityAdapter().lookupNumber({ field: 'f', entityId: 'e' }),
      ),
    ).toBe(true);
  });
});
