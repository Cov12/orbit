import { describe, it, expect } from 'vitest';
import { conductorActive, getEffectiveAppAccess, type OrgWithRelations } from './entitlements';

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
