import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-jwt-round-trip';
});

describe('signOrbitToken', () => {
  it('round-trips the aud claim through jwt.verify', async () => {
    const { signOrbitToken } = await import('./jwt');

    const token = signOrbitToken(
      {
        sub: 'user_123',
        email: 'a@b.com',
        name: 'Test User',
        org_id: 'org_1',
        org_slug: 'org-1',
        role: 'MEMBER',
        subscriptions: [],
        app_access: [],
      },
      { aud: 'conductor' }
    );

    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ['HS256'],
      audience: 'conductor',
    }) as Record<string, unknown>;

    expect(decoded.aud).toBe('conductor');
    expect(decoded.sub).toBe('user_123');
  });

  it('omits aud when not provided (back-compat)', async () => {
    const { signOrbitToken } = await import('./jwt');

    const token = signOrbitToken({
      sub: 'user_123',
      email: 'a@b.com',
      name: 'Test User',
      org_id: 'org_1',
      org_slug: 'org-1',
      role: 'MEMBER',
      subscriptions: [],
      app_access: [],
    });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ['HS256'],
    }) as Record<string, unknown>;

    expect(decoded.aud).toBeUndefined();
  });
});
