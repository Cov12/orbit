/**
 * Atrium Stores — Central state management
 */
import { writable, derived } from 'svelte/store';
import type { OnboardingAnswers } from '$lib/apis/atrium';

// ── Navigation & UI ──────────────────────────────────────────
export const agencyNavCollapsed = writable(false);
export const agencyNavMobile = writable(false);

// ── Departments ──────────────────────────────────────────────
export interface Department {
	id: string;
	name: string;
	icon: string;
	gradient: string;
	description: string;
	/** `active` doubles as the onboarding selection: DeptSetup toggles active/inactive and
	 * FinalSetup provisions an agent for every active department. */
	status: 'active' | 'inactive' | 'setup';
	agentCount: number;
	/** Canonical Conductor role this department provisions (POST /orgs/{id}/onboarding/agents).
	 * Empty for departments that are not provisionable from onboarding (e.g. the ones
	 * DeptConfig loads from the API). */
	role: string;
	model?: string;
}

/** The agency department set offered by onboarding, one department per canonical Conductor
 * role (1:1). All start unselected — the user opts in on the DeptSetup step. */
const defaultDepartments: Department[] = [
	{ id: 'marketing', role: 'cmo', name: 'Marketing', icon: 'campaign', gradient: 'from-fuchsia-500 to-pink-600', description: 'Campaigns, social, and brand growth.', status: 'inactive', agentCount: 0 },
	{ id: 'sales', role: 'sales', name: 'Sales', icon: 'payments', gradient: 'from-blue-500 to-indigo-600', description: 'Leads, pipeline, and closing deals.', status: 'inactive', agentCount: 0 },
	{ id: 'customer-success', role: 'support', name: 'Customer Success', icon: 'support_agent', gradient: 'from-emerald-400 to-teal-600', description: 'Tickets, live chat, and client satisfaction.', status: 'inactive', agentCount: 0 },
	{ id: 'finance', role: 'cfo', name: 'Finance', icon: 'account_balance', gradient: 'from-orange-400 to-rose-500', description: 'Invoicing, budgets, and cash flow.', status: 'inactive', agentCount: 0 },
	{ id: 'design', role: 'designer', name: 'Design', icon: 'palette', gradient: 'from-violet-500 to-purple-600', description: 'Creative, visuals, and brand assets.', status: 'inactive', agentCount: 0 },
	{ id: 'content', role: 'content', name: 'Content', icon: 'edit_note', gradient: 'from-amber-400 to-orange-500', description: 'Copy, blogs, and newsletters.', status: 'inactive', agentCount: 0 },
	{ id: 'operations', role: 'pm', name: 'Operations', icon: 'inventory_2', gradient: 'from-sky-400 to-cyan-600', description: 'Projects, workflows, and delivery.', status: 'inactive', agentCount: 0 },
	{ id: 'engineering', role: 'cto', name: 'Engineering', icon: 'code', gradient: 'from-slate-500 to-slate-700', description: 'Web, automation, and technical builds.', status: 'inactive', agentCount: 0 },
];

export const departments = writable<Department[]>(defaultDepartments);

/** Departments the user switched on in the onboarding DeptSetup step. */
export const selectedDepartments = derived(departments, ($d) => $d.filter((x) => x.status === 'active'));

/** Deduped, non-empty canonical roles for a set of departments — the `roles` payload of
 * the onboarding provisioning call. Pure, so it is unit-testable without a DOM. */
export const departmentRoles = (depts: Pick<Department, 'role'>[]): string[] => [
	...new Set(depts.map((d) => d.role.trim()).filter(Boolean))
];

/** Switch on every department whose role is in `roles` (the assisted-path suggestion).
 * Additive: departments the user already picked stay picked, nothing is switched off.
 * Roles are matched trimmed + case-insensitively; unknown roles are ignored. Returns the
 * updated list plus the ids that matched, so the caller can tell "no usable suggestion"
 * apart from "suggested". Pure, so it is unit-testable without a DOM. */
export const preselectDepartmentsByRole = <T extends Pick<Department, 'id' | 'role' | 'status'>>(
	depts: T[],
	roles: string[]
): { departments: T[]; matchedIds: string[] } => {
	const wanted = new Set(roles.map((r) => r.trim().toLowerCase()).filter(Boolean));
	const matchedIds: string[] = [];
	const updated = depts.map((d) => {
		const role = d.role.trim().toLowerCase();
		if (!role || !wanted.has(role)) return d;
		matchedIds.push(d.id);
		return { ...d, status: 'active' as const };
	});
	return { departments: updated, matchedIds };
};

/** Suggested first tasks per onboarding department (keyed by department id), offered as an
 * opt-in checklist in FinalSetup. Static for v1. */
export const STARTER_TASKS: Record<string, string[]> = {
	marketing: ['Draft a launch announcement plan', 'Audit our current marketing channels'],
	sales: ['Organize the pipeline stages', 'Review and qualify current leads'],
	'customer-success': ['Set up the support intake', 'Triage open customer issues'],
	finance: ["Review this month's budget", 'Set up invoicing'],
	design: ['Assemble the brand basics', 'Draft the key screens and assets'],
	content: ['Plan a 2-week content calendar', 'Draft the first posts'],
	operations: ['Map the core workflows', 'Define the first milestone'],
	engineering: ['Review the tech stack', 'Scope the first build']
};

export interface DepartmentStarterTasks {
	deptId: string;
	deptName: string;
	tasks: { title: string }[];
}

/** Starter tasks for the given (selected) departments, in department order. Departments
 * without a template are skipped. Pure, so it is unit-testable without a DOM. */
export const starterTasksFor = (
	depts: Pick<Department, 'id' | 'name'>[]
): DepartmentStarterTasks[] =>
	depts
		.filter((d) => (STARTER_TASKS[d.id] ?? []).length > 0)
		.map((d) => ({
			deptId: d.id,
			deptName: d.name,
			tasks: STARTER_TASKS[d.id].map((title) => ({ title }))
		}));

// ── Notifications ────────────────────────────────────────────
export interface Notification {
	id: string;
	title: string;
	body: string;
	dept: string;
	icon: string;
	time: string;
	read: boolean;
	type: 'info' | 'action' | 'alert';
}

export const notifications = writable<Notification[]>([]);
export const unreadCount = derived(notifications, ($n) => $n.filter((x) => !x.read).length);

// ── Proposals (Delegated Actions) ────────────────────────────
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Proposal {
	id: string;
	title: string;
	dept: string;
	description: string;
	status: ProposalStatus;
	createdAt: string;
	priority: 'low' | 'medium' | 'high' | 'critical';
	actions: { label: string; type: 'primary' | 'danger' | 'secondary' }[];
}

export const proposals = writable<Proposal[]>([]);
export const pendingProposals = derived(proposals, ($p) => $p.filter((x) => x.status === 'pending'));

// ── Chat / Active Department ─────────────────────────────────
export const activeDeptId = writable<string | null>(null);
export const activeDept = derived([departments, activeDeptId], ([$depts, $id]) =>
	$depts.find((d) => d.id === $id) ?? null
);

// ── Onboarding ───────────────────────────────────────────────
/** Mirror of the SERVER-side gate (org.settings.onboarding.completed), hydrated by
 * LockScreen. Kept as a store so in-app surfaces can read it synchronously, but it is no
 * longer the source of truth — GET /orgs/{id}/onboarding is. */
export const onboardingComplete = writable(false);
export const onboardingStep = writable(0);

/** Draft answers while the wizard is in flight, shared across the step routes (each step
 * is its own page, so a store is the only thing that survives the navigation). Durable
 * storage is the backend: the final step POSTs these and they are persisted into
 * org.settings + seeded into Engram. */
export const onboardingAnswers = writable<OnboardingAnswers>({});

/** Reset the draft so a re-entered wizard never shows a previous run's answers. */
export const resetOnboardingAnswers = () => onboardingAnswers.set({});

/** Fold interview answers into the draft. Blank answers never clobber something the user
 * already typed elsewhere in the wizard (the interview reuses the P1 keys). */
export const mergeOnboardingAnswers = (
	current: OnboardingAnswers,
	incoming: Partial<Record<keyof OnboardingAnswers, string>>
): OnboardingAnswers => {
	const next: OnboardingAnswers = { ...current };
	for (const [key, value] of Object.entries(incoming) as [keyof OnboardingAnswers, string | undefined][]) {
		const trimmed = (value ?? '').trim();
		if (trimmed) next[key] = trimmed;
	}
	return next;
};

// ── Organization Context ─────────────────────────────────────
export interface OrgContext {
	id: string;
	name: string;
	slug: string;
	plan: string;
	// Org profile captured at Portal signup and surfaced by the org API (derived from
	// settings). Present when the account carries it; the onboarding wizard prefills + locks
	// these instead of re-asking. `industry` arrives once Portal persists it + adds the claim.
	logo?: string | null;
	industry?: string | null;
}

export const activeOrg = writable<OrgContext | null>(null);
export const activeOrgId = derived(activeOrg, ($org) => $org?.id ?? '');
