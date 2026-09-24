import { describe, expect, it } from 'vitest';
import { mergeOnboardingAnswers, preselectDepartmentsByRole } from './atrium';

const depts = [
	{ id: 'marketing', role: 'cmo', status: 'inactive' as const },
	{ id: 'sales', role: 'sales', status: 'inactive' as const },
	{ id: 'finance', role: 'cfo', status: 'active' as const },
	{ id: 'api-loaded', role: '', status: 'inactive' as const }
];

describe('assisted path: suggested roles → department pre-selection', () => {
	it('switches on the departments whose role was suggested', () => {
		const { departments, matchedIds } = preselectDepartmentsByRole(depts, ['cmo', 'sales']);
		expect(matchedIds).toEqual(['marketing', 'sales']);
		expect(departments.filter((d) => d.status === 'active').map((d) => d.id)).toEqual([
			'marketing',
			'sales',
			'finance'
		]);
	});

	it('keeps manual picks and never switches anything off', () => {
		const { departments } = preselectDepartmentsByRole(depts, ['cmo']);
		expect(departments.find((d) => d.id === 'finance')?.status).toBe('active');
	});

	it('matches trimmed and case-insensitively, ignoring unknown and empty roles', () => {
		const { matchedIds } = preselectDepartmentsByRole(depts, [' CMO ', 'wizard', '']);
		expect(matchedIds).toEqual(['marketing']);
	});

	it('reports no match for an empty suggestion and leaves the list untouched', () => {
		const { departments, matchedIds } = preselectDepartmentsByRole(depts, []);
		expect(matchedIds).toEqual([]);
		expect(departments).toEqual(depts);
	});
});

describe('assisted path: interview answers → onboarding draft', () => {
	it('adds interview answers under the P1 keys', () => {
		expect(
			mergeOnboardingAnswers({ orgName: 'Acme' }, { whatBusinessDoes: ' Shopify builds ', customers: 'DTC brands' })
		).toEqual({ orgName: 'Acme', whatBusinessDoes: 'Shopify builds', customers: 'DTC brands' });
	});

	it('never clobbers an earlier answer with a skipped one', () => {
		expect(mergeOnboardingAnswers({ primaryGoal: 'Grow retainers' }, { primaryGoal: '  ' })).toEqual({
			primaryGoal: 'Grow retainers'
		});
	});
});
