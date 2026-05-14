import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isFlagEnabled } from './flags';

const FLAG = 'portal_conductor_visible';
const ENV_KEY = 'PORTAL_CONDUCTOR_VISIBLE_ORGS';
const LAUNCH_FLAG = 'portal_conductor_launch_enabled';
const LAUNCH_ENV_KEY = 'PORTAL_CONDUCTOR_LAUNCH_ENABLED_ORGS';

describe('isFlagEnabled', () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it('returns false for any org when CSV is empty', () => {
    process.env[ENV_KEY] = '';
    expect(isFlagEnabled(FLAG, { id: 'org_1', slug: 'one' })).toBe(false);
  });

  it('returns false when env var is unset', () => {
    expect(isFlagEnabled(FLAG, { id: 'org_1', slug: 'one' })).toBe(false);
  });

  it('returns true when org.id matches (id precedence)', () => {
    process.env[ENV_KEY] = 'org_1,other_org';
    expect(isFlagEnabled(FLAG, { id: 'org_1', slug: 'unrelated' })).toBe(true);
  });

  it('returns true when org.slug matches (slug fallback)', () => {
    process.env[ENV_KEY] = 'unrelated_id,acme';
    expect(isFlagEnabled(FLAG, { id: 'org_xyz', slug: 'acme' })).toBe(true);
  });

  it('tolerates whitespace around CSV entries', () => {
    process.env[ENV_KEY] = '  org_1 ,  acme  ';
    expect(isFlagEnabled(FLAG, { id: 'org_1', slug: 'other' })).toBe(true);
    expect(isFlagEnabled(FLAG, { id: 'no_match', slug: 'acme' })).toBe(true);
  });

  it('returns false when neither id nor slug match', () => {
    process.env[ENV_KEY] = 'some_other_id,some_other_slug';
    expect(isFlagEnabled(FLAG, { id: 'org_1', slug: 'one' })).toBe(false);
  });
});

describe('isFlagEnabled — independent env-var to flag mapping', () => {
  let originalVisible: string | undefined;
  let originalLaunch: string | undefined;

  beforeEach(() => {
    originalVisible = process.env[ENV_KEY];
    originalLaunch = process.env[LAUNCH_ENV_KEY];
    delete process.env[ENV_KEY];
    delete process.env[LAUNCH_ENV_KEY];
  });

  afterEach(() => {
    if (originalVisible === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = originalVisible;
    if (originalLaunch === undefined) delete process.env[LAUNCH_ENV_KEY];
    else process.env[LAUNCH_ENV_KEY] = originalLaunch;
  });

  it('reads each flag from its own env var with disjoint allowlists', () => {
    // visible: only org_visible; launch: only org_launch
    process.env[ENV_KEY] = 'org_visible';
    process.env[LAUNCH_ENV_KEY] = 'org_launch';

    const visibleOnly = { id: 'org_visible', slug: 'visible-co' };
    const launchOnly = { id: 'org_launch', slug: 'launch-co' };

    expect(isFlagEnabled(FLAG, visibleOnly)).toBe(true);
    expect(isFlagEnabled(LAUNCH_FLAG, visibleOnly)).toBe(false);

    expect(isFlagEnabled(FLAG, launchOnly)).toBe(false);
    expect(isFlagEnabled(LAUNCH_FLAG, launchOnly)).toBe(true);
  });
});
