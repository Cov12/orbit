import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The form only reads useRouter; there is no Next router in a node test.
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

import {
  SubAccountForm,
  buildRefreshUrl,
  createErrorMessage,
  createSubAccount,
  exitTarget,
} from './subaccount-form';

const ATRIUM_RETURN = 'https://atrium.orbit.example/sub-accounts?tab=all';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('buildRefreshUrl', () => {
  it('routes through /api/auth/refresh with an encoded redirect_uri', () => {
    expect(buildRefreshUrl(ATRIUM_RETURN)).toBe(
      '/api/auth/refresh?redirect_uri=' + encodeURIComponent(ATRIUM_RETURN)
    );
  });

  it('encodes the whole returnTo so it cannot smuggle extra query params', () => {
    const url = buildRefreshUrl('https://app.example.com/x?a=1&b=2');
    // Exactly one query parameter reaches the refresh route.
    expect(url.split('&')).toHaveLength(1);
    expect(url).toContain('%3Fa%3D1%26b%3D2');
  });
});

describe('exitTarget', () => {
  it('with a returnTo → the refresh hop (mints a fresh JWT, then 302s to the app)', () => {
    expect(exitTarget(ATRIUM_RETURN)).toEqual({
      kind: 'refresh',
      url: '/api/auth/refresh?redirect_uri=' + encodeURIComponent(ATRIUM_RETURN),
    });
  });

  it('without a returnTo → back to the Portal list', () => {
    expect(exitTarget(null)).toEqual({ kind: 'portal', path: '/settings/subaccounts' });
  });
});

describe('createErrorMessage', () => {
  it('403 → the owner/admin message', () => {
    expect(createErrorMessage(403, 'Only workspace owners or admins can create sub-accounts')).toBe(
      'You need owner/admin access to add a sub-account'
    );
  });

  it("400 → the API's own message", () => {
    expect(createErrorMessage(400, 'Sub-account name is required')).toBe(
      'Sub-account name is required'
    );
  });

  it('anything else → a generic message', () => {
    expect(createErrorMessage(500, 'Internal server error')).toBe(
      'Something went wrong. Please try again.'
    );
  });
});

describe('createSubAccount', () => {
  function mockFetch(status: number, body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({
      status,
      json: async () => body,
    } as unknown as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('POSTs { name } and NOTHING else — the org comes from the session cookie', async () => {
    const fetchMock = mockFetch(201, { subAccount: { id: 'sa_1' } });

    const result = await createSubAccount('Acme Client');

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/subaccounts');
    expect(init.method).toBe('POST');
    // Multi-tenancy guard: no orgId / workspaceId / subAccountId from the client.
    expect(JSON.parse(init.body)).toEqual({ name: 'Acme Client' });
    expect(Object.keys(JSON.parse(init.body))).toEqual(['name']);
  });

  it('403 → the owner/admin error, not a success', async () => {
    mockFetch(403, { error: 'Only workspace owners or admins can create sub-accounts' });
    expect(await createSubAccount('Acme')).toEqual({
      ok: false,
      message: 'You need owner/admin access to add a sub-account',
    });
  });

  it("400 → surfaces the API's message", async () => {
    mockFetch(400, { error: 'Sub-account name is required' });
    expect(await createSubAccount('')).toEqual({
      ok: false,
      message: 'Sub-account name is required',
    });
  });

  it('500 → a generic message', async () => {
    mockFetch(500, { error: 'Internal server error' });
    expect(await createSubAccount('Acme')).toEqual({
      ok: false,
      message: 'Something went wrong. Please try again.',
    });
  });

  it('network failure → a generic message, no throw', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await createSubAccount('Acme')).toEqual({
      ok: false,
      message: 'Something went wrong. Please try again.',
    });
  });
});

describe('<SubAccountForm /> markup', () => {
  it('owner/admin gets a real form with a name input, Create and Cancel', () => {
    const html = renderToStaticMarkup(
      createElement(SubAccountForm, { returnTo: null, isAdmin: true })
    );
    expect(html).toContain('<form');
    expect(html).toContain('id="subaccount-name"');
    expect(html).toContain('>Create</button>');
    expect(html).toContain('>Cancel</button>');
  });

  it('non-admin gets no form at all, just an explanation', () => {
    const html = renderToStaticMarkup(
      createElement(SubAccountForm, { returnTo: ATRIUM_RETURN, isAdmin: false })
    );
    expect(html).not.toContain('<form');
    expect(html).not.toContain('id="subaccount-name"');
    expect(html).not.toContain('type="submit"');
    expect(html).toContain('Only workspace owners and admins can add sub-accounts');
  });

  it('never renders returnTo into an href', () => {
    const html = renderToStaticMarkup(
      createElement(SubAccountForm, { returnTo: ATRIUM_RETURN, isAdmin: true })
    );
    expect(html).not.toContain('href=');
    expect(html).not.toContain(ATRIUM_RETURN);
  });
});
