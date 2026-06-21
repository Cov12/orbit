import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const authMock = vi.fn();
const currentUserMock = vi.fn();
const cookiesMock = vi.fn();
const orgFindUniqueMock = vi.fn();
const memberFindFirstMock = vi.fn();

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
    member: { findFirst: (...args: unknown[]) => memberFindFirstMock(...args) },
  },
}));

const TEST_SECRET = 'test-secret-for-token-route';

const baseOrgWithConductor = {
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

const orgWithoutAtrium = {
  ...baseOrgWithConductor,
  subscriptions: [],
  appAccess: [{ app: 'CONDUCTOR', enabled: true }],
};

const orgWithConductorDisabled = {
  ...baseOrgWithConductor,
  appAccess: [
    { app: 'ATRIUM', enabled: true },
    { app: 'CONDUCTOR', enabled: false },
  ],
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/token — aud handling', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
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
  });

  it('aud=conductor with active ATRIUM sub + CONDUCTOR enabled → 200 with aud and CONDUCTOR in app_access', async () => {
    memberFindFirstMock.mockResolvedValue({ org: baseOrgWithConductor });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ aud: 'conductor' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const decoded = jwt.verify(body.token, TEST_SECRET, {
      algorithms: ['HS256'],
      audience: 'conductor',
    }) as Record<string, unknown>;

    expect(decoded.aud).toBe('conductor');
    expect(decoded.app_access).toContain('CONDUCTOR');
  });

  it('mints a token (does not 500) when neither Clerk nor member has a name — falls back to email local-part', async () => {
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ id: 'e1', emailAddress: 'nameless@example.com' }],
      primaryEmailAddressId: 'e1',
      firstName: null,
      lastName: null,
    });
    memberFindFirstMock.mockResolvedValue({
      org: {
        ...baseOrgWithConductor,
        members: [{ id: 'm_1', clerkUserId: 'user_1', email: null, name: null, role: 'MEMBER' }],
      },
    });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    const decoded = jwt.verify(body.token, TEST_SECRET, { algorithms: ['HS256'] }) as Record<string, unknown>;
    expect(decoded.email).toBe('nameless@example.com');
    expect(decoded.name).toBe('nameless');
  });

  it('aud=conductor with no ATRIUM subscription → 403 with conductor_entitlement_missing', async () => {
    memberFindFirstMock.mockResolvedValue({ org: orgWithoutAtrium });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ aud: 'conductor' }));
    expect(res.status).toBe(403);

    const denial = infoSpy.mock.calls
      .map((c) => String(c[0]))
      .find((line) => line.includes('"kind":"entitlement_decision"') && line.includes('"decision":"denied"'));
    expect(denial).toBeDefined();
    expect(denial!).toContain('"reason":"conductor_entitlement_missing"');
    infoSpy.mockRestore();
  });

  it('aud=conductor with CONDUCTOR AppAccess.enabled=false despite ATRIUM active → 403', async () => {
    memberFindFirstMock.mockResolvedValue({ org: orgWithConductorDisabled });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({ aud: 'conductor' }));
    expect(res.status).toBe(403);
  });

  it('no aud in body → 200, JWT does NOT carry aud (back-compat)', async () => {
    memberFindFirstMock.mockResolvedValue({ org: baseOrgWithConductor });
    const { POST } = await import('./route');

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    const decoded = jwt.verify(body.token, TEST_SECRET, {
      algorithms: ['HS256'],
    }) as Record<string, unknown>;

    expect(decoded.aud).toBeUndefined();
  });
});
