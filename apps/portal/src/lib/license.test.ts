import { describe, it, expect, afterEach, vi } from 'vitest';
import { isLicenseActive, isOrgLicensed } from './license';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe('isLicenseActive', () => {
  it('is true by default when ORBIT_LICENSE_MODE is unset (license edition)', () => {
    delete process.env.ORBIT_LICENSE_MODE;
    delete process.env.ORBIT_LICENSE_EXPIRES_AT;
    expect(isLicenseActive()).toBe(true);
  });

  it('is true when ORBIT_LICENSE_MODE is set but empty', () => {
    process.env.ORBIT_LICENSE_MODE = '  ';
    delete process.env.ORBIT_LICENSE_EXPIRES_AT;
    expect(isLicenseActive()).toBe(true);
  });

  it.each(['0', 'false', 'off', 'no', 'FALSE', ' Off '])(
    'is false when explicitly disabled with %s',
    (val) => {
      process.env.ORBIT_LICENSE_MODE = val;
      expect(isLicenseActive()).toBe(false);
    }
  );

  it.each(['1', 'true', 'on', 'yes', 'TRUE', ' On '])(
    'is true for truthy flag %s (no expiry)',
    (val) => {
      process.env.ORBIT_LICENSE_MODE = val;
      delete process.env.ORBIT_LICENSE_EXPIRES_AT;
      expect(isLicenseActive()).toBe(true);
    }
  );

  it('fails CLOSED (inactive) for an unrecognized flag value', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.ORBIT_LICENSE_MODE = 'maybe';
    expect(isLicenseActive()).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });

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

  it('honors the expiry under the default (unset) mode too', () => {
    delete process.env.ORBIT_LICENSE_MODE;
    process.env.ORBIT_LICENSE_EXPIRES_AT = '2026-01-01T00:00:00Z';
    expect(isLicenseActive(new Date('2026-07-28T00:00:00Z'))).toBe(false);
  });

  it('fails CLOSED (inactive) when the expiry is unparseable', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.ORBIT_LICENSE_MODE = '1';
    process.env.ORBIT_LICENSE_EXPIRES_AT = 'not-a-date';
    expect(isLicenseActive()).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('isOrgLicensed', () => {
  it('is true for any org under the default instance license', () => {
    delete process.env.ORBIT_LICENSE_MODE;
    delete process.env.ORBIT_LICENSE_EXPIRES_AT;
    expect(isOrgLicensed({ licensed: false })).toBe(true);
    expect(isOrgLicensed(null)).toBe(true);
  });

  it('falls back to the per-org flag when the instance license is explicitly off', () => {
    process.env.ORBIT_LICENSE_MODE = 'off';
    expect(isOrgLicensed({ licensed: true })).toBe(true);
    expect(isOrgLicensed({ licensed: false })).toBe(false);
    expect(isOrgLicensed(undefined)).toBe(false);
  });
});
