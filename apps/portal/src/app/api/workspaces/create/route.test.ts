import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const currentUserMock = vi.fn();
const cookiesSetMock = vi.fn();
const cookiesMock = vi.fn();
const organizationFindUniqueMock = vi.fn();
const organizationCreateMock = vi.fn();
const subscriptionCreateMock = vi.fn();
const appAccessCreateMock = vi.fn();
const postConductorEntitlementsMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

vi.mock('next/headers', () => ({
  cookies: () => cookiesMock(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      findUnique: (...args: unknown[]) => organizationFindUniqueMock(...args),
      create: (...args: unknown[]) => organizationCreateMock(...args),
    },
    subscription: {
      create: (...args: unknown[]) => subscriptionCreateMock(...args),
    },
    appAccess: {
      create: (...args: unknown[]) => appAccessCreateMock(...args),
    },
  },
}));

vi.mock('@/lib/conductor-entitlements', () => ({
  postConductorEntitlements: (...args: unknown[]) => postConductorEntitlementsMock(...args),
}));

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/workspaces/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/workspaces/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'user_1' });
    currentUserMock.mockResolvedValue({
      emailAddresses: [{ id: 'e1', emailAddress: 'owner@example.com' }],
      primaryEmailAddressId: 'e1',
      firstName: 'Owner',
      lastName: 'User',
    });
    cookiesMock.mockResolvedValue({ set: cookiesSetMock });
    organizationFindUniqueMock.mockResolvedValue(null);
    organizationCreateMock.mockResolvedValue({
      id: 'org_1',
      name: 'Acme',
      slug: 'acme',
      subscriptions: [{ app: 'WORKPIPE', status: 'TRIALING' }],
      members: [{ clerkUserId: 'user_1' }],
    });
    subscriptionCreateMock.mockResolvedValue(undefined);
    appAccessCreateMock.mockResolvedValue(undefined);
    postConductorEntitlementsMock.mockResolvedValue(undefined);
  });

  it('posts the effective entitlement set after workspace bootstrap', async () => {
    const { POST } = await import('./route');

    const res = await POST(
      makeReq({
        name: 'Acme',
        products: [{ app: 'WORKPIPE', plan: 'STARTER' }],
      })
    );

    expect(res.status).toBe(200);
    expect(postConductorEntitlementsMock).toHaveBeenCalledWith('org_1');
  });

  it('keeps workspace creation successful when entitlement sync fails', async () => {
    postConductorEntitlementsMock.mockRejectedValue(new Error('conductor down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { POST } = await import('./route');

    const res = await POST(
      makeReq({
        name: 'Acme',
        products: [{ app: 'WORKPIPE', plan: 'STARTER' }],
      })
    );

    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
