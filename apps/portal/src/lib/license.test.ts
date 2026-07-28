import { describe, it, expect, afterEach } from 'vitest';
import { isLicenseActive } from './license';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('isLicenseActive', () => {
  it('is false when ORBIT_LICENSE_MODE is unset', () => {
    delete process.env.ORBIT_LICENSE_MODE;
    expect(isLicenseActive()).toBe(false);
  });

  it('is false for a non-truthy flag value', () => {
    process.env.ORBIT_LICENSE_MODE = 'false';
    expect(isLicenseActive()).toBe(false);
    process.env.ORBIT_LICENSE_MODE = '0';
    expect(isLicenseActive()).toBe(false);
  });

  it.each(['1', 'true', 'on', 'yes', 'TRUE', ' On '])(
    'is true for truthy flag %s (no expiry)',
    (val) => {
      process.env.ORBIT_LICENSE_MODE = val;
      delete process.env.ORBIT_LICENSE_EXPIRES_AT;
      expect(isLicenseActive()).toBe(true);
    }
  );

  it('is true when the expiry is in the future', () => {
    process.env.ORBIT_LICENSE_MODE = '1';
    process.env.ORBIT_LICENSE_EXPIRES_AT = '2027-01-01T00:00:00Z';
    expect(isLicenseActive(new Date('2026-07-28T00:00:00Z'))).toBe(true);
  });

  it('is false once the expiry has passed', () => {
    process.env.ORBIT_LICENSE_MODE = '1';
    process.env.ORBIT_LICENSE_EXPIRES_AT = '2026-01-01T00:00:00Z';
    expect(isLicenseActive(new Date('2026-07-28T00:00:00Z'))).toBe(false);
  });

  it('fails CLOSED (inactive) when the expiry is unparseable', () => {
    process.env.ORBIT_LICENSE_MODE = '1';
    process.env.ORBIT_LICENSE_EXPIRES_AT = 'not-a-date';
    expect(isLicenseActive()).toBe(false);
  });
});
