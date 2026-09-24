import { describe, expect, it } from 'vitest';
import { STARTER_TASKS, starterTasksFor } from './atrium';

describe('starter tasks: selected departments → opt-in checklist', () => {
	it('maps each selected department to its starter tasks, in order', () => {
		const groups = starterTasksFor([
			{ id: 'marketing', name: 'Marketing' },
			{ id: 'finance', name: 'Finance' }
		]);
		expect(groups).toEqual([
			{
				deptId: 'marketing',
				deptName: 'Marketing',
				tasks: STARTER_TASKS.marketing.map((title) => ({ title }))
			},
			{
				deptId: 'finance',
				deptName: 'Finance',
				tasks: STARTER_TASKS.finance.map((title) => ({ title }))
			}
		]);
	});

	it('is empty when no department is selected', () => {
		expect(starterTasksFor([])).toEqual([]);
	});

	it('skips departments without a template', () => {
		expect(starterTasksFor([{ id: 'api-loaded', name: 'Custom' }])).toEqual([]);
	});

	it('offers two tasks for every onboarding department', () => {
		for (const id of ['marketing', 'sales', 'customer-success', 'finance', 'design', 'content', 'operations', 'engineering']) {
			expect(STARTER_TASKS[id]).toHaveLength(2);
		}
	});
});
