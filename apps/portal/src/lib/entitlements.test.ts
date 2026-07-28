import { describe, it, expect } from 'vitest';
import {
  conductorActive,
  getAppEntitlementMap,
  getEffectiveAppAccess,
  getEffectiveAppAccessEntries,
  type OrgWithRelations,
} from './entitlements';

function makeOrg(opts: Partial<OrgWithRelations>): OrgWithRelations {
  return {
    subscriptions: opts.subscriptions ?? [],
    appAccess: opts.appAccess ?? [],
  };
}

describe('conductorActive', () => {
  it('is true when ATRIUM subscription is ACTIVE and CONDUCTOR AppAccess enabled', () => {
    const org = makeOrg({
      subscriptions: [{ app: 'ATRIUM', status: 'ACTIVE' }],
      appAccess: [{ app: 'CONDUCTOR', enabled: true }],
    });
    expect(conductorActive(org)).toBe(true);
  });

  it('is true when ATRIUM subscription is TRIALING and CONDUCTOR AppAccess enabled', () => {
    const org = makeOrg({
      subscriptions: [{ app: 'ATRIUM', status: 'TRIALING' }],
      appAccess: [{ app: 'CONDUCTOR', enabled: true }],
    });
    expect(conductorActive(org)).toBe(true);
  });

  it('is false when no ATRIUM subscription at all', () => {
    const org = makeOrg({
      subscriptions: [{ app: 'WORKPIPE', status: 'ACTIVE' }],
      appAccess: [{ app: 'CONDUCTOR', enabled: true }],
    });
    expect(conductorActive(org)).toBe(false);
  });

  it('is false when ATRIUM subscription is ACTIVE but CONDUCTOR AppAccess disabled', () => {
    const org = makeOrg({
      subscriptions: [{ app: 'ATRIUM', status: 'ACTIVE' }],
      appAccess: [{ app: 'CONDUCTOR', enabled: false }],
    });
    expect(conductorActive(org)).toBe(false);
  });

  it('is false when ATRIUM subscription is CANCELED', () => {
    const org = makeOrg({
      subscriptions: [{ app: 'ATRIUM', status: 'CANCELED' }],
      appAccess: [{ app: 'CONDUCTOR', enabled: true }],
    });
    expect(conductorActive(org)).toBe(false);
  });
});

describe('getEffectiveAppAccessEntries', () => {
  it('keeps non-CONDUCTOR entries as stored and applies subscription gating to CONDUCTOR', () => {
    const org = makeOrg({
      subscriptions: [],
      appAccess: [
        { app: 'WORKPIPE', enabled: true },
        { app: 'CONDUCTOR', enabled: true },
        { app: 'ATRIUM', enabled: false },
      ],
    });

    expect(getEffectiveAppAccessEntries(org)).toEqual([
      { app: 'ATRIUM', enabled: false },
      { app: 'CONDUCTOR', enabled: false },
      { app: 'WORKPIPE', enabled: true },
    ]);
  });
});

describe('getEffectiveAppAccess', () => {
  it('includes CONDUCTOR when ATRIUM sub is ACTIVE and CONDUCTOR AppAccess enabled', () => {
    const org = makeOrg({
      subscriptions: [{ app: 'ATRIUM', status: 'ACTIVE' }],
      appAccess: [
        { app: 'ATRIUM', enabled: true },
        { app: 'CONDUCTOR', enabled: true },
      ],
    });
    const result = getEffectiveAppAccess(org, false);
    expect(result).toContain('CONDUCTOR');
  });

  it('does NOT include CONDUCTOR when no ATRIUM subscription', () => {
    const org = makeOrg({
      subscriptions: [],
      appAccess: [{ app: 'CONDUCTOR', enabled: true }],
    });
    const result = getEffectiveAppAccess(org, false);
    expect(result).not.toContain('CONDUCTOR');
  });

  it('does NOT include CONDUCTOR when CONDUCTOR AppAccess is disabled', () => {
    const org = makeOrg({
      subscriptions: [{ app: 'ATRIUM', status: 'ACTIVE' }],
      appAccess: [
        { app: 'ATRIUM', enabled: true },
        { app: 'CONDUCTOR', enabled: false },
      ],
    });
    const result = getEffectiveAppAccess(org, false);
    expect(result).not.toContain('CONDUCTOR');
  });

  it('platform admin without ATRIUM subscription does NOT get CONDUCTOR (no admin shortcut)', () => {
    const org = makeOrg({
      subscriptions: [],
      appAccess: [],
    });
    const result = getEffectiveAppAccess(org, true);
    expect(result).not.toContain('CONDUCTOR');
    expect(result).toEqual(['ATRIUM', 'DRIVE', 'WORKPIPE']);
  });

  it('output is deterministically sorted alphabetically', () => {
    const org = makeOrg({
      subscriptions: [{ app: 'ATRIUM', status: 'ACTIVE' }],
      appAccess: [
        { app: 'WORKPIPE', enabled: true },
        { app: 'CONDUCTOR', enabled: true },
        { app: 'DRIVE', enabled: true },
        { app: 'ATRIUM', enabled: true },
      ],
    });
    const result = getEffectiveAppAccess(org, false);
    const sorted = [...result].sort((a, b) => a.localeCompare(b));
    expect(result).toEqual(sorted);
  });
});

describe('getAppEntitlementMap', () => {
  it('returns a complete map for every app, mirroring getEffectiveAppAccess', () => {
    const org = makeOrg({
      subscriptions: [{ app: 'ATRIUM', status: 'ACTIVE' }],
      appAccess: [
        { app: 'WORKPIPE', enabled: true },
        { app: 'CONDUCTOR', enabled: true },
        { app: 'ATRIUM', enabled: true },
        { app: 'DRIVE', enabled: false },
      ],
    });
    // Member (non-admin) view: exactly the enabled/derived set the JWT grants.
    expect(getAppEntitlementMap(org, false)).toEqual({
      ATRIUM: true,
      WORKPIPE: true,
      CONDUCTOR: true, // active ATRIUM sub + CONDUCTOR appAccess enabled
      DRIVE: false, // appAccess disabled → not entitled
    });
  });

  it('reflects the admin free-base branch (ATRIUM/DRIVE/WORKPIPE true, CONDUCTOR still gated)', () => {
    const org = makeOrg({ subscriptions: [], appAccess: [] });
    expect(getAppEntitlementMap(org, true)).toEqual({
      ATRIUM: true,
      DRIVE: true,
      WORKPIPE: true,
      CONDUCTOR: false, // no ATRIUM sub → no Conductor, even for admins
    });
  });

  it('is all-false for a member with no entitlements', () => {
    const org = makeOrg({ subscriptions: [], appAccess: [] });
    expect(getAppEntitlementMap(org, false)).toEqual({
      ATRIUM: false,
      DRIVE: false,
      WORKPIPE: false,
      CONDUCTOR: false,
    });
  });
});

describe('license mode (licensed flag)', () => {
  const emptyOrg = makeOrg({ subscriptions: [], appAccess: [] });

  it('conductorActive is true under license even with no ATRIUM subscription', () => {
    expect(conductorActive(emptyOrg)).toBe(false);
    expect(conductorActive(emptyOrg, true)).toBe(true);
  });

  it('getEffectiveAppAccess grants every app under license (non-admin, no subs)', () => {
    expect(getEffectiveAppAccess(emptyOrg, false)).toEqual([]);
    expect(getEffectiveAppAccess(emptyOrg, false, true)).toEqual([
      'ATRIUM',
      'CONDUCTOR',
      'DRIVE',
      'WORKPIPE',
    ]);
  });

  it('getEffectiveAppAccessEntries marks every app enabled under license', () => {
    expect(getEffectiveAppAccessEntries(emptyOrg, true)).toEqual([
      { app: 'ATRIUM', enabled: true },
      { app: 'CONDUCTOR', enabled: true },
      { app: 'DRIVE', enabled: true },
      { app: 'WORKPIPE', enabled: true },
    ]);
  });

  it('getAppEntitlementMap is all-true under license', () => {
    expect(getAppEntitlementMap(emptyOrg, false, true)).toEqual({
      ATRIUM: true,
      CONDUCTOR: true,
      DRIVE: true,
      WORKPIPE: true,
    });
  });
});
