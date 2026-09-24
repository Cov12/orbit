import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { chooseActiveOrg, getOrganizationForUser, type Organization } from './atrium';

const ORG_STORAGE_KEY = 'atrium-org-id';

const org = (id: string): Organization => ({
	id,
	name: `Org ${id}`,
	slug: id,
	plan: 'pro'
});

const LAUNCH = org('launch-org-uuid');
const STORED = org('stored-org-uuid');
const FIRST = org('first-org-uuid');

// ── chooseActiveOrg: the precedence itself, no DOM and no network ────────────

describe('chooseActiveOrg', () => {
	it('prefers the launch org over a different stored org', () => {
		const orgs = [FIRST, STORED, LAUNCH];
		expect(chooseActiveOrg(orgs, LAUNCH.id, STORED.id)).toBe(LAUNCH);
	});

	it('falls through to the stored org when the launch id is not a member org', () => {
		const orgs = [FIRST, STORED];
		expect(chooseActiveOrg(orgs, 'org-the-user-does-not-belong-to', STORED.id)).toBe(STORED);
	});

	it('uses the stored org when no launch id is supplied', () => {
		const orgs = [FIRST, STORED];
		expect(chooseActiveOrg(orgs, null, STORED.id)).toBe(STORED);
	});

	it('falls back to the first org when neither id resolves', () => {
		const orgs = [FIRST, STORED];
		// A stored id left over from a DIFFERENT account must never survive reconciliation.
		expect(chooseActiveOrg(orgs, null, 'stale-id-from-another-account')).toBe(FIRST);
	});

	it('falls back to the first org when there is no launch id and no stored id', () => {
		const orgs = [FIRST, STORED];
		expect(chooseActiveOrg(orgs, null, null)).toBe(FIRST);
	});

	it('returns null for an empty or missing org list', () => {
		expect(chooseActiveOrg([], LAUNCH.id, STORED.id)).toBeNull();
		expect(chooseActiveOrg(null, LAUNCH.id, STORED.id)).toBeNull();
		expect(chooseActiveOrg(undefined, null, null)).toBeNull();
	});
});

// ── getOrganizationForUser: the same precedence wired to storage + fetch ─────

const memoryLocalStorage = () => {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, String(value)),
		removeItem: (key: string) => void store.delete(key),
		clear: () => store.clear(),
		get size() {
			return store.size;
		}
	};
};

let storage: ReturnType<typeof memoryLocalStorage>;

const stubOrgsResponse = (orgs: Organization[]) => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({
			ok: true,
			json: async () => orgs
		}))
	);
};

beforeEach(() => {
	storage = memoryLocalStorage();
	vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('getOrganizationForUser', () => {
	it('honours the launch org over a stale stored choice and persists it', async () => {
		stubOrgsResponse([FIRST, STORED, LAUNCH]);
		storage.setItem(ORG_STORAGE_KEY, STORED.id);

		const chosen = await getOrganizationForUser('token', LAUNCH.id);

		expect(chosen?.id).toBe(LAUNCH.id);
		// The launch choice must stick for subsequent navigations, once the param is stripped.
		expect(storage.getItem(ORG_STORAGE_KEY)).toBe(LAUNCH.id);
	});

	it('keeps the stored org when the launch id is not a member org', async () => {
		stubOrgsResponse([FIRST, STORED]);
		storage.setItem(ORG_STORAGE_KEY, STORED.id);

		const chosen = await getOrganizationForUser('token', 'not-a-member-org');

		expect(chosen?.id).toBe(STORED.id);
		expect(storage.getItem(ORG_STORAGE_KEY)).toBe(STORED.id);
	});

	it('keeps today’s behaviour when no launch id is passed', async () => {
		stubOrgsResponse([FIRST, STORED]);
		storage.setItem(ORG_STORAGE_KEY, STORED.id);

		expect((await getOrganizationForUser('token'))?.id).toBe(STORED.id);
	});

	it('reconciles a stored id from another account away and writes the first org', async () => {
		stubOrgsResponse([FIRST, STORED]);
		storage.setItem(ORG_STORAGE_KEY, 'stale-id-from-another-account');

		const chosen = await getOrganizationForUser('token');

		expect(chosen?.id).toBe(FIRST.id);
		expect(storage.getItem(ORG_STORAGE_KEY)).toBe(FIRST.id);
	});

	it('returns the first org and stores it when nothing is remembered', async () => {
		stubOrgsResponse([FIRST, STORED]);

		const chosen = await getOrganizationForUser('token', null);

		expect(chosen?.id).toBe(FIRST.id);
		expect(storage.getItem(ORG_STORAGE_KEY)).toBe(FIRST.id);
	});

	it('returns null and clears the stored id for an empty org list', async () => {
		stubOrgsResponse([]);
		storage.setItem(ORG_STORAGE_KEY, STORED.id);

		expect(await getOrganizationForUser('token', LAUNCH.id)).toBeNull();
		expect(storage.getItem(ORG_STORAGE_KEY)).toBeNull();
	});
});
