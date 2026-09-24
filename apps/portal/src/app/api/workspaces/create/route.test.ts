import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const currentUserMock = vi.fn();
const cookiesSetMock = vi.fn();
const cookiesMock = vi.fn();
const organizationFindUniqueMock = vi.fn();
const organizationCreateMock = vi.fn();
const subscriptionCreateMock = vi.fn();
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
    // Present only so the test can assert it is never used.
    subscription: {
      create: (...args: unknown[]) => subscriptionCreateMock(...args),
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

type CreatedOrgData = {
  subscriptions?: unknown;
  appAccess: { create: Array<{ app: string; enabled: boolean }> };
};

function createdOrgData(): CreatedOrgData {
  expect(organizationCreateMock).toHaveBeenCalledTimes(1);
  return organizationCreateMock.mock.calls[0][0].data as CreatedOrgData;
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
    organizationCreateMock.mockResolvedValue({ id: 'org_1', name: 'Acme', slug: 'acme' });
    postConductorEntitlementsMock.mockResolvedValue(undefined);
  });

  it('grants AppAccess for every app by default and creates no subscriptions', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeReq({ name: 'Acme' }));

    expect(res.status).toBe(200);
    const data = createdOrgData();
    expect(data.subscriptions).toBeUndefined();
    expect(data.appAccess.create).toEqual([
      { app: 'ATRIUM', enabled: true },
      { app: 'CONDUCTOR', enabled: true },
      { app: 'DRIVE', enabled: true },
      { app: 'WORKPIPE', enabled: true },
    ]);
    expect(subscriptionCreateMock).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.workspace).not.toHaveProperty('trialEndsAt');
    expect(body.workspace.apps).toEqual(['ATRIUM', 'CONDUCTOR', 'DRIVE', 'WORKPIPE']);
  });

  it('grants AppAccess only for the requested apps (de-duplicated)', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeReq({ name: 'Acme', apps: ['WORKPIPE', 'DRIVE', 'WORKPIPE'] }));

    expect(res.status).toBe(200);
    expect(createdOrgData().appAccess.create).toEqual([
      { app: 'WORKPIPE', enabled: true },
      { app: 'DRIVE', enabled: true },
    ]);
  });

  it('rejects an unknown app with 400 and creates nothing', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeReq({ name: 'Acme', apps: ['WORKPIPE', 'NOT_AN_APP'] }));

    expect(res.status).toBe(400);
    expect(organizationCreateMock).not.toHaveBeenCalled();
  });

  it('rejects a non-array apps value with 400', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeReq({ name: 'Acme', apps: 'WORKPIPE' }));

    expect(res.status).toBe(400);
    expect(organizationCreateMock).not.toHaveBeenCalled();
  });

  it('requires a workspace name', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeReq({ name: '   ' }));

    expect(res.status).toBe(400);
  });

  it('posts the effective entitlement set after workspace bootstrap', async () => {
    const { POST } = await import('./route');

    const res = await POST(makeReq({ name: 'Acme', apps: ['WORKPIPE'] }));

    expect(res.status).toBe(200);
    expect(postConductorEntitlementsMock).toHaveBeenCalledWith('org_1');
  });

  it('keeps workspace creation successful when entitlement sync fails', async () => {
    postConductorEntitlementsMock.mockRejectedValue(new Error('conductor down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { POST } = await import('./route');

    const res = await POST(makeReq({ name: 'Acme' }));

    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
