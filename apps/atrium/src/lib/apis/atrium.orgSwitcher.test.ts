import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ORG_STORAGE_KEY,
	persistActiveOrgId,
	shouldShowOrgSwitcher,
	sortOrgsForSwitcher,
	type Organization
} from './atrium';

const org = (id: string, name: string, slug = id): Organization => ({
	id,
	name,
	slug,
	plan: 'pro'
});

// ── shouldShowOrgSwitcher: the >1-org gate ───────────────────────────────────

describe('shouldShowOrgSwitcher', () => {
	it('hides the switcher for a single-org user — there is nowhere to switch to', () => {
		expect(shouldShowOrgSwitcher([org('a', 'Acme')])).toBe(false);
	});

	it('shows the switcher once the user belongs to more than one org', () => {
		expect(shouldShowOrgSwitcher([org('a', 'Acme'), org('b', 'Beta')])).toBe(true);
	});

	it('hides the switcher for an empty, null or undefined list', () => {
		expect(shouldShowOrgSwitcher([])).toBe(false);
		expect(shouldShowOrgSwitcher(null)).toBe(false);
		expect(shouldShowOrgSwitcher(undefined)).toBe(false);
	});
});

// ── sortOrgsForSwitcher: display order only ──────────────────────────────────

describe('sortOrgsForSwitcher', () => {
	it('orders by name, case-insensitively', () => {
		const orgs = [org('c', 'zeta'), org('a', 'Acme'), org('b', 'Beta')];
		expect(sortOrgsForSwitcher(orgs).map((o) => o.id)).toEqual(['a', 'b', 'c']);
	});

	it('falls back to the slug when an org has no name', () => {
		const orgs = [org('b', '', 'beta-slug'), org('a', 'Acme')];
		expect(sortOrgsForSwitcher(orgs).map((o) => o.id)).toEqual(['a', 'b']);
	});

	it('does not mutate the caller’s array — resolution still uses the server order', () => {
		const orgs = [org('c', 'Zeta'), org('a', 'Acme')];
		const sorted = sortOrgsForSwitcher(orgs);
		expect(orgs.map((o) => o.id)).toEqual(['c', 'a']);
		expect(sorted).not.toBe(orgs);
	});

	it('returns an empty array for a null or undefined list', () => {
		expect(sortOrgsForSwitcher(null)).toEqual([]);
		expect(sortOrgsForSwitcher(undefined)).toEqual([]);
	});
});

// ── persistActiveOrgId: what a deliberate switch writes ──────────────────────

const memoryLocalStorage = () => {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, String(value)),
		removeItem: (key: string) => void store.delete(key),
		clear: () => store.clear()
	};
};

let storage: ReturnType<typeof memoryLocalStorage>;

beforeEach(() => {
	storage = memoryLocalStorage();
	vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('persistActiveOrgId', () => {
	it('writes the chosen org under the key getOrganizationForUser reads back', () => {
		persistActiveOrgId('org-b');
		expect(storage.getItem(ORG_STORAGE_KEY)).toBe('org-b');
	});

	it('clears the stored id when passed null', () => {
		storage.setItem(ORG_STORAGE_KEY, 'org-a');
		persistActiveOrgId(null);
		expect(storage.getItem(ORG_STORAGE_KEY)).toBeNull();
	});

	it('is a no-op without a DOM, so SSR and tests can call it unguarded', () => {
		vi.unstubAllGlobals();
		vi.stubGlobal('localStorage', undefined);
		expect(() => persistActiveOrgId('org-b')).not.toThrow();
	});
});
