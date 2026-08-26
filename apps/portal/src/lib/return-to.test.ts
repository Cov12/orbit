import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ATRIUM_URL = 'https://atrium.orbit.example';
const APP_URL = 'https://portal.orbit.example';

const ORIGINAL = { ...process.env };

/**
 * ALLOWED_ORIGINS is computed at module load, so every test sets the
 * NEXT_PUBLIC_* env vars first and then re-imports the module — the same
 * idiom as src/app/api/auth/refresh/route.test.ts and src/lib/jwt.test.ts.
 */
async function loadReturnTo(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
  return import('./return-to');
}

const DEFAULT_ENV = {
  NEXT_PUBLIC_ATRIUM_URL: ATRIUM_URL,
  NEXT_PUBLIC_APP_URL: APP_URL,
  NEXT_PUBLIC_WORKPIPE_URL: undefined,
  NEXT_PUBLIC_DRIVE_URL: undefined,
  NEXT_PUBLIC_CONDUCTOR_URL: undefined,
};

beforeEach(() => {
  process.env = { ...ORIGINAL };
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL };
});

describe('resolveReturnTo', () => {
  it('returns the normalized URL for an allowlisted origin', async () => {
    const { resolveReturnTo } = await loadReturnTo(DEFAULT_ENV);
    expect(resolveReturnTo(`${ATRIUM_URL}/sub-accounts/new`)).toBe(
      `${ATRIUM_URL}/sub-accounts/new`
    );
  });

  it('preserves query strings on an allowlisted origin', async () => {
    const { resolveReturnTo } = await loadReturnTo(DEFAULT_ENV);
    expect(resolveReturnTo(`${APP_URL}/dashboard?tab=subaccounts`)).toBe(
      `${APP_URL}/dashboard?tab=subaccounts`
    );
  });

  it('rejects an unknown origin', async () => {
    const { resolveReturnTo } = await loadReturnTo(DEFAULT_ENV);
    expect(resolveReturnTo('https://evil.example.com/auth/callback')).toBeNull();
  });

  it('rejects a look-alike subdomain of an allowlisted origin', async () => {
    const { resolveReturnTo } = await loadReturnTo(DEFAULT_ENV);
    expect(resolveReturnTo('https://portal.orbit.example.evil.example.com/x')).toBeNull();
  });

  it('rejects a javascript: scheme', async () => {
    const { resolveReturnTo } = await loadReturnTo(DEFAULT_ENV);
    expect(resolveReturnTo('javascript:alert(1)')).toBeNull();
  });

  it('rejects a data: URL', async () => {
    const { resolveReturnTo } = await loadReturnTo(DEFAULT_ENV);
    expect(resolveReturnTo('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects a malformed string', async () => {
    const { resolveReturnTo } = await loadReturnTo(DEFAULT_ENV);
    expect(resolveReturnTo('not a url')).toBeNull();
  });

  it('rejects a relative path (no origin to check)', async () => {
    const { resolveReturnTo } = await loadReturnTo(DEFAULT_ENV);
    expect(resolveReturnTo('/dashboard')).toBeNull();
  });

  it('rejects null, undefined and empty string', async () => {
    const { resolveReturnTo } = await loadReturnTo(DEFAULT_ENV);
    expect(resolveReturnTo(null)).toBeNull();
    expect(resolveReturnTo(undefined)).toBeNull();
    expect(resolveReturnTo('')).toBeNull();
  });

  it('rejects http:// on an allowlisted host in production', async () => {
    const { resolveReturnTo } = await loadReturnTo({
      ...DEFAULT_ENV,
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    });
    vi.stubEnv('NODE_ENV', 'production');
    expect(resolveReturnTo('http://localhost:3000/dashboard')).toBeNull();
  });

  it('allows http:// on an allowlisted host outside production (local dev)', async () => {
    const { resolveReturnTo } = await loadReturnTo({
      ...DEFAULT_ENV,
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    });
    vi.stubEnv('NODE_ENV', 'development');
    expect(resolveReturnTo('http://localhost:3000/dashboard')).toBe(
      'http://localhost:3000/dashboard'
    );
  });
});

describe('ALLOWED_ORIGINS', () => {
  it('maps each configured app URL to its origin', async () => {
    const { ALLOWED_ORIGINS } = await loadReturnTo({
      ...DEFAULT_ENV,
      NEXT_PUBLIC_ATRIUM_URL: `${ATRIUM_URL}/atrium/auth/callback`,
    });
    expect(ALLOWED_ORIGINS).toContain(ATRIUM_URL);
    expect(ALLOWED_ORIGINS).toContain(APP_URL);
  });

  it('skips falsy and malformed env entries without throwing', async () => {
    const { ALLOWED_ORIGINS } = await loadReturnTo({
      NEXT_PUBLIC_WORKPIPE_URL: '',
      NEXT_PUBLIC_DRIVE_URL: 'not-a-url',
      NEXT_PUBLIC_CONDUCTOR_URL: '://broken',
      NEXT_PUBLIC_ATRIUM_URL: ATRIUM_URL,
      NEXT_PUBLIC_APP_URL: APP_URL,
    });
    expect(ALLOWED_ORIGINS).toEqual([ATRIUM_URL, APP_URL]);
  });

  it('is empty when no app URLs are configured', async () => {
    const { ALLOWED_ORIGINS, resolveReturnTo } = await loadReturnTo({
      NEXT_PUBLIC_WORKPIPE_URL: undefined,
      NEXT_PUBLIC_DRIVE_URL: undefined,
      NEXT_PUBLIC_ATRIUM_URL: undefined,
      NEXT_PUBLIC_CONDUCTOR_URL: undefined,
      NEXT_PUBLIC_APP_URL: undefined,
    });
    expect(ALLOWED_ORIGINS).toEqual([]);
    expect(resolveReturnTo(`${ATRIUM_URL}/x`)).toBeNull();
  });
});
