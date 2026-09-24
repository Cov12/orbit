import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { departmentRoles, departments, selectedDepartments } from './atrium';

describe('onboarding department → role mapping', () => {
	it('maps the default agency set 1:1 onto canonical Conductor roles', () => {
		const byName = Object.fromEntries(get(departments).map((d) => [d.name, d.role]));
		expect(byName).toEqual({
			Marketing: 'cmo',
			Sales: 'sales',
			'Customer Success': 'support',
			Finance: 'cfo',
			Design: 'designer',
			Content: 'content',
			Operations: 'pm',
			Engineering: 'cto'
		});
	});

	it('starts with nothing selected', () => {
		expect(get(selectedDepartments)).toEqual([]);
	});

	it('dedupes roles and drops empty ones', () => {
		expect(
			departmentRoles([{ role: 'cmo' }, { role: 'cmo' }, { role: '' }, { role: ' cto ' }])
		).toEqual(['cmo', 'cto']);
	});

	it('selection follows the active status DeptSetup toggles', () => {
		departments.update((items) =>
			items.map((d) => (d.role === 'cfo' || d.role === 'pm' ? { ...d, status: 'active' } : d))
		);
		expect(departmentRoles(get(selectedDepartments))).toEqual(['cfo', 'pm']);
	});
});
