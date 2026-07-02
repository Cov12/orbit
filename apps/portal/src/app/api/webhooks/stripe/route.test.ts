import { describe, it, expect, beforeEach, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
  },
  subscription: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  appAccess: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
}));

const fetchMock = vi.hoisted(() => vi.fn());

const stripeMock = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  subscriptions: { retrieve: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));
vi.mock('@/lib/stripe', () => ({ getStripe: () => stripeMock }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'stripe-signature': 'test-sig' }),
}));

vi.stubGlobal('fetch', fetchMock);

function makeReq(body: unknown = { ignored: true }): Request {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Find the upsert call (if any) targeting a specific app on appAccess.
function findUpsertFor(app: 'CONDUCTOR' | 'WORKPIPE' | 'ATRIUM') {
  return dbMock.appAccess.upsert.mock.calls.find(
    ([arg]) => arg?.where?.orgId_app?.app === app
  );
}

describe('stripe webhook → CONDUCTOR AppAccess lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.CONDUCTOR_URL = 'https://conductor.example.com';
    process.env.ORBIT_PORTAL_JWT_SECRET = 'bridge-secret';
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    dbMock.organization.findUnique.mockResolvedValue({
      id: 'org_1',
      subscriptions: [{ app: 'ATRIUM', status: 'ACTIVE' }],
      appAccess: [
        { app: 'ATRIUM', enabled: true },
        { app: 'CONDUCTOR', enabled: true },
        { app: 'WORKPIPE', enabled: true },
      ],
    });
  });

  describe('checkout.session.completed', () => {
    it('enables CONDUCTOR AppAccess when app=ATRIUM', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orgId: 'org_1', app: 'ATRIUM', plan: 'PRO' },
            subscription: 'sub_atrium_1',
            customer: 'cus_1',
          },
        },
      });
      stripeMock.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_atrium_1',
        current_period_end: 1_800_000_000,
      });

      const { POST } = await import('./route');
      const res = await POST(makeReq());

      expect(res.status).toBe(200);
      const conductorCall = findUpsertFor('CONDUCTOR');
      expect(conductorCall).toBeDefined();
      expect(conductorCall![0]).toMatchObject({
        where: { orgId_app: { orgId: 'org_1', app: 'CONDUCTOR' } },
        create: { orgId: 'org_1', app: 'CONDUCTOR', enabled: true },
        update: { enabled: true },
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://conductor.example.com/api/webhooks/portal/entitlements',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-orbit-bridge-secret': 'bridge-secret',
          },
          body: JSON.stringify({
            org_id: 'org_1',
            appAccess: [
              { app: 'ATRIUM', enabled: true },
              { app: 'CONDUCTOR', enabled: true },
              { app: 'WORKPIPE', enabled: true },
            ],
          }),
        })
      );
    });

    it('does NOT touch CONDUCTOR AppAccess when app=WORKPIPE', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { orgId: 'org_2', app: 'WORKPIPE', plan: 'STARTER' },
            subscription: 'sub_wp_1',
            customer: 'cus_2',
          },
        },
      });
      stripeMock.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_wp_1',
        current_period_end: 1_800_000_000,
      });

      const { POST } = await import('./route');
      const res = await POST(makeReq());

      expect(res.status).toBe(200);
      expect(findUpsertFor('CONDUCTOR')).toBeUndefined();
    });
  });

  describe('customer.subscription.updated', () => {
    it('flips CONDUCTOR to enabled=false when ATRIUM sub transitions ACTIVE → CANCELED', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_atrium_1',
            status: 'canceled',
            current_period_end: 1_800_000_000,
          },
        },
      });
      dbMock.subscription.findUnique.mockResolvedValue({
        orgId: 'org_1',
        app: 'ATRIUM',
        status: 'ACTIVE',
      });
      dbMock.organization.findUnique.mockResolvedValue({
        id: 'org_1',
        subscriptions: [{ app: 'ATRIUM', status: 'CANCELED' }],
        appAccess: [
          { app: 'ATRIUM', enabled: true },
          { app: 'CONDUCTOR', enabled: false },
          { app: 'WORKPIPE', enabled: true },
        ],
      });

      const { POST } = await import('./route');
      const res = await POST(makeReq());

      expect(res.status).toBe(200);
      const conductorCall = findUpsertFor('CONDUCTOR');
      expect(conductorCall).toBeDefined();
      expect(conductorCall![0]).toMatchObject({
        where: { orgId_app: { orgId: 'org_1', app: 'CONDUCTOR' } },
        create: { orgId: 'org_1', app: 'CONDUCTOR', enabled: false },
        update: { enabled: false },
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://conductor.example.com/api/webhooks/portal/entitlements',
        expect.objectContaining({
          body: JSON.stringify({
            org_id: 'org_1',
            appAccess: [
              { app: 'ATRIUM', enabled: true },
              { app: 'CONDUCTOR', enabled: false },
              { app: 'WORKPIPE', enabled: true },
            ],
          }),
        })
      );
    });

    it('flips CONDUCTOR back to enabled=true when ATRIUM sub transitions CANCELED → ACTIVE', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_atrium_1',
            status: 'active',
            current_period_end: 1_800_000_000,
          },
        },
      });
      dbMock.subscription.findUnique.mockResolvedValue({
        orgId: 'org_1',
        app: 'ATRIUM',
        status: 'CANCELED',
      });

      const { POST } = await import('./route');
      const res = await POST(makeReq());

      expect(res.status).toBe(200);
      const conductorCall = findUpsertFor('CONDUCTOR');
      expect(conductorCall).toBeDefined();
      expect(conductorCall![0]).toMatchObject({
        where: { orgId_app: { orgId: 'org_1', app: 'CONDUCTOR' } },
        create: { orgId: 'org_1', app: 'CONDUCTOR', enabled: true },
        update: { enabled: true },
      });
    });

    it('does NOT touch CONDUCTOR when the updated subscription is for WORKPIPE', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_wp_1',
            status: 'canceled',
            current_period_end: 1_800_000_000,
          },
        },
      });
      dbMock.subscription.findUnique.mockResolvedValue({
        orgId: 'org_2',
        app: 'WORKPIPE',
        status: 'ACTIVE',
      });

      const { POST } = await import('./route');
      const res = await POST(makeReq());

      expect(res.status).toBe(200);
      expect(findUpsertFor('CONDUCTOR')).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('customer.subscription.deleted', () => {
    it('disables CONDUCTOR AppAccess when ATRIUM sub is deleted', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_atrium_1' },
        },
      });
      dbMock.subscription.findUnique.mockResolvedValue({
        orgId: 'org_1',
        app: 'ATRIUM',
        status: 'ACTIVE',
      });
      dbMock.organization.findUnique.mockResolvedValue({
        id: 'org_1',
        subscriptions: [{ app: 'ATRIUM', status: 'CANCELED' }],
        appAccess: [
          { app: 'ATRIUM', enabled: false },
          { app: 'CONDUCTOR', enabled: false },
          { app: 'WORKPIPE', enabled: true },
        ],
      });

      const { POST } = await import('./route');
      const res = await POST(makeReq());

      expect(res.status).toBe(200);
      const conductorDisable = dbMock.appAccess.updateMany.mock.calls.find(
        ([arg]) => arg?.where?.app === 'CONDUCTOR'
      );
      expect(conductorDisable).toBeDefined();
      expect(conductorDisable![0]).toMatchObject({
        where: { orgId: 'org_1', app: 'CONDUCTOR' },
        data: { enabled: false },
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://conductor.example.com/api/webhooks/portal/entitlements',
        expect.objectContaining({
          body: JSON.stringify({
            org_id: 'org_1',
            appAccess: [
              { app: 'ATRIUM', enabled: false },
              { app: 'CONDUCTOR', enabled: false },
              { app: 'WORKPIPE', enabled: true },
            ],
          }),
        })
      );
    });

    it('does NOT touch CONDUCTOR AppAccess when a non-ATRIUM sub is deleted', async () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_wp_1' },
        },
      });
      dbMock.subscription.findUnique.mockResolvedValue({
        orgId: 'org_2',
        app: 'WORKPIPE',
        status: 'ACTIVE',
      });

      const { POST } = await import('./route');
      const res = await POST(makeReq());

      expect(res.status).toBe(200);
      const conductorDisable = dbMock.appAccess.updateMany.mock.calls.find(
        ([arg]) => arg?.where?.app === 'CONDUCTOR'
      );
      expect(conductorDisable).toBeUndefined();
    });
  });
});
