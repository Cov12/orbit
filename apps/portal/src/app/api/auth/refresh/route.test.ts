import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const authMock = vi.fn();
const currentUserMock = vi.fn();
const cookiesMock = vi.fn();
const orgFindUniqueMock = vi.fn();
const memberFindFirstMock = vi.fn();
const memberUpdateMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

vi.mock('next/headers', () => ({
  cookies: () => cookiesMock(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    organization: { findUnique: (...args: unknown[]) => orgFindUniqueMock(...args) },
    member: {
      findFirst: (...args: unknown[]) => memberFindFirstMock(...args),
      update: (...args: unknown[]) => memberUpdateMock(...args),
    },
  },
}));

const TEST_SECRET = 'test-secret-for-refresh-route';
const CONDUCTOR_URL = 'https://conductor.example.com';
const ATRIUM_URL = 'https://atrium.example.com';

const orgWithConductor = {
  id: 'org_1',
  slug: 'acme',
  members: [
    { id: 'm_1', clerkUserId: 'user_1', email: 'u@example.com', name: 'User One', role: 'MEMBER' },
  ],
  subscriptions: [{ app: 'ATRIUM', status: 'ACTIVE', plan: 'GROWTH' }],
  appAccess: [
    { app: 'ATRIUM', enabled: true },
    { app: 'CONDUCTOR', enabled: true },
  ],
};

function makeReq(redirectUri: string): Request {
  return new Request(
    `http://localhost/api/auth/refresh?redirect_uri=${encodeURIComponent(redirectUri)}`,
    { method: 'GET' }
  );
}

function tokenFromRedirect(res: Response): string {
  const location = res.headers.get('location')!;
  const url = new URL(location);
  return url.searchParams.get('token')!;
}

describe('GET /api/auth/refresh — aud derivation from redirect_uri origin', () => {
  const originalConductorUrl = process.env.NEXT_PUBLIC_CONDUCTOR_URL;
  const originalAtriumUrl = process.env.NEXT_PUBLIC_ATRIUM_URL;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_CONDUCTOR_URL = CONDUCTOR_URL;
    process.env.NEXT_PUBLIC_ATRIUM_URL = ATRIUM_URL;
  });

  afterAll(() => {
    if (originalConductorUrl === undefined) delete process.env.NEXT_PUBLIC_CONDUCTOR_URL;
    else process.env.NEXT_PUBLIC_CONDUCTOR_URL = originalConductorUrl;
    if (originalAtriumUrl === undefined) delete process.env.NEXT_PUBLIC_ATRIUM_URL;
    else process.env.NEXT_PUBLIC_ATRIUM_URL = originalAtriumUrl;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ id: 'e1', emailAddress: 'u@example.com' }],
      primaryEmailAddressId: 'e1',
      firstName: 'User',
      lastName: 'One',
    });
    cookiesMock.mockResolvedValue({ get: () => undefined });
    orgFindUniqueMock.mockResolvedValue(null);
    memberFindFirstMock.mockResolvedValue({ org: orgWithConductor });
    memberUpdateMock.mockResolvedValue(undefined);
  });

  it('allowlisted Conductor origin → JWT carries aud=conductor', async () => {
    const { GET } = await import('./route');
    const res = await GET(makeReq(`${CONDUCTOR_URL}/conductor/auth/callback`));

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);

    const token = tokenFromRedirect(res);
    const decoded = jwt.verify(token, TEST_SECRET, {
      algorithms: ['HS256'],
      audience: 'conductor',
    }) as Record<string, unknown>;
    expect(decoded.aud).toBe('conductor');
  });

  it('non-allowlisted origin → 400', async () => {
    const { GET } = await import('./route');
    const res = await GET(makeReq('https://evil.example.com/auth/callback'));
    expect(res.status).toBe(400);
  });

  it('allowlisted ATRIUM origin → JWT does NOT carry aud=conductor', async () => {
    const { GET } = await import('./route');
    const res = await GET(makeReq(`${ATRIUM_URL}/atrium/auth/callback`));

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);

    const token = tokenFromRedirect(res);
    const decoded = jwt.verify(token, TEST_SECRET, {
      algorithms: ['HS256'],
    }) as Record<string, unknown>;
    expect(decoded.aud).toBeUndefined();
  });
});
