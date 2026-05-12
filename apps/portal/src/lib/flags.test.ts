import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isFlagEnabled } from './flags';

const FLAG = 'portal_conductor_visible';
const ENV_KEY = 'PORTAL_CONDUCTOR_VISIBLE_ORGS';

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
