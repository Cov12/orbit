import { WEBUI_BASE_URL } from '$lib/constants';

const ATRIUM_API_BASE = `${WEBUI_BASE_URL}/api/atrium`;

// ─── Types ────────────────────────────────────────────────────

export interface Organization {
	id: string;
	name: string;
	slug: string;
	plan: string;
	settings?: Record<string, unknown>;
}

export interface OrgMember {
	id: string;
	user_id: string;
	role: string;
	department_ids: string[];
}

export interface OrgSubAccount {
	id: string;
	name: string | null;
	slug: string | null;
	status: string | null;
}

export interface OrgSubAccountsResponse {
	subAccounts: OrgSubAccount[];
	activeSubAccountId: string | null;
	// Phase 1.4 onboarding fields. `syncOk` disambiguates an empty subAccounts list — it is
	// true only once a Portal pull has actually succeeded for this org, so a first-business
	// affordance can fire on "genuinely none" and stay silent during a Portal outage.
	// `publicOrigin` is this deployment's canonical origin (ATRIUM_PUBLIC_ORIGIN), which
	// the Portal return hop must match exactly; window.location.origin can differ behind a
	// proxy, a preview host or a custom domain.
	syncedAt?: string | null;
	syncOk?: boolean;
	publicOrigin?: string | null;
}

export interface WorkPipeStats {
	contacts: {
		total: number;
		recentCount: number;
	};
	tickets: {
		total: number;
		totalValue: number;
		byLane: Record<string, number>;
	};
	pipelines: {
		count: number;
	};
}

export interface WorkPipeTicket {
	id: string;
	name?: string | null;
	value?: number | string | null;
}

export interface WorkPipeLane {
	id: string;
	name?: string | null;
	order?: number | null;
	Ticket?: WorkPipeTicket[];
	Tickets?: WorkPipeTicket[];
	tickets?: WorkPipeTicket[];
}

export interface WorkPipePipeline {
	id: string;
	name: string;
	Lane?: WorkPipeLane[];
	lanes?: WorkPipeLane[];
}

export interface WorkPipePipelinesData {
	pipelines: WorkPipePipeline[];
	count: number;
}

export interface WorkPipeContact {
	id: string;
	name?: string | null;
	email?: string | null;
	phone?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
}

export interface WorkPipeContactsData {
	contacts: WorkPipeContact[];
	total: number;
}

export interface ConductorRun {
	id: string;
	status: string;
	agentId: string;
	agentName?: string | null;
	createdAt: string;
	updatedAt?: string | null;
	subAccountId?: string | null;
}

export interface Department {
	id: string;
	slug: string;
	name: string;
	description: string;
	model_tier: string;
	capabilities: string[];
	workpipe_modules?: string[];
	system_prompt?: string;
}

export interface Proposal {
	id: string;
	title: string;
	description: string;
	action_type: string;
	action_payload?: Record<string, unknown>;
	risk_level: 'low' | 'medium' | 'high' | 'critical';
	risk_reasoning?: string;
	status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
	department_id: string;
	chat_id?: string;
	created_by_ai?: string;
	reviewed_by?: string;
	review_note?: string;
	execution_result?: Record<string, unknown>;
	created_at: number;
	updated_at?: number;
}

export interface ProposalStats {
	total: number;
	pending: number;
	approved: number;
	rejected: number;
	executed: number;
}

export interface ChatResponse {
	department: string;
	model_tier: string;
	model: string;
	content: string;
	proposals: Proposal[];
	usage: Record<string, unknown>;
	status: string;
}

// ─── Helpers ──────────────────────────────────────────────────

async function apiCall<T>(
	url: string,
	token: string,
	options: RequestInit = {}
): Promise<T> {
	let error = null;

	const res = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...(token && { authorization: `Bearer ${token}` })
		},
		...options
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail ?? err;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res as T;
}

// ─── Organizations ────────────────────────────────────────────

export const getOrganization = async (token: string, orgId: string) => {
	return apiCall<Organization>(`${ATRIUM_API_BASE}/orgs/${orgId}`, token);
};

export const createOrganization = async (
	token: string,
	data: { name: string; slug: string; workpipe_account_id?: string; plan?: string }
) => {
	return apiCall<{ organization: Organization; departments: Department[] }>(
		`${ATRIUM_API_BASE}/orgs/`,
		token,
		{
			method: 'POST',
			body: JSON.stringify(data)
		}
	);
};

/**
 * Query param the login callback appends to the post-login redirect, carrying the
 * INTERNAL Atrium org uuid this login launched with (#79). Membership is already
 * ensured server-side; the frontend still reconciles it against the member-org list.
 */
export const ACTIVE_ORG_PARAM = 'activeOrgId';

/** localStorage key holding the org this browser last acted as. */
export const ORG_STORAGE_KEY = 'atrium-org-id';

/**
 * Write (or clear) the remembered org. Guarded so SSR and the unit tests, which run
 * without a DOM, can call the resolvers without stubbing storage.
 */
export const persistActiveOrgId = (orgId: string | null) => {
	if (typeof localStorage === 'undefined') return;
	if (orgId) {
		localStorage.setItem(ORG_STORAGE_KEY, orgId);
	} else {
		localStorage.removeItem(ORG_STORAGE_KEY);
	}
};

/**
 * A switcher is only meaningful when there is somewhere to switch to. Single-org users
 * (the common case) get no control at all rather than a dropdown with one entry.
 */
export const shouldShowOrgSwitcher = (orgs: Organization[] | null | undefined): boolean =>
	(orgs?.length ?? 0) > 1;

/**
 * Display order for the switcher only — never for resolution. `chooseActiveOrg` still
 * falls back to the server's first org, so sorting here must not mutate the input.
 */
export const sortOrgsForSwitcher = (orgs: Organization[] | null | undefined): Organization[] =>
	[...(orgs ?? [])].sort((a, b) =>
		(a.name || a.slug || '').localeCompare(b.name || b.slug || '', undefined, {
			sensitivity: 'base'
		})
	);

/**
 * Pure precedence for the active org. Exported for unit testing — no DOM, no network.
 *
 * (a) the launch org, when this login carried one AND the user is a member of it;
 * (b) else the stored org, when it is still in the member list — a stored id left over
 *     from a DIFFERENT account/session in the same browser must never be reused, or
 *     every scoped call 403s;
 * (c) else the first member org.
 *
 * Returns null for an empty list (caller clears the stored id).
 */
export const chooseActiveOrg = (
	orgs: Organization[] | null | undefined,
	launchOrgId?: string | null,
	storedOrgId?: string | null
): Organization | null => {
	if (!orgs || orgs.length === 0) {
		return null;
	}
	return (
		(launchOrgId && orgs.find((o) => o.id === launchOrgId)) ||
		(storedOrgId && orgs.find((o) => o.id === storedOrgId)) ||
		orgs[0]
	);
};

/**
 * Resolve the org this session should act as.
 *
 * `launchOrgId` is the `?activeOrgId=` signal from the login redirect, passed in by the
 * caller — this module stays DOM-free and never reads window.location itself. When it
 * names an org the user belongs to it wins over the stored choice, so a multi-org user
 * lands on the org they launched with instead of a stale localStorage pick. The chosen
 * id is written back so the launch choice sticks across subsequent navigations.
 */
export const getOrganizationForUser = async (token: string, launchOrgId?: string | null) => {
	// The active org MUST be one the authenticated user belongs to. Fetch the user's
	// orgs (server-side, membership-scoped) and reconcile both the launch id and any
	// stored id against that list.
	try {
		const orgs = await listOrganizations(token);
		const hasLS = typeof localStorage !== 'undefined';
		if (!orgs || orgs.length === 0) {
			persistActiveOrgId(null);
			return null;
		}
		const storedOrgId = hasLS ? localStorage.getItem(ORG_STORAGE_KEY) : null;
		const chosen = chooseActiveOrg(orgs, launchOrgId, storedOrgId);
		if (!chosen) {
			persistActiveOrgId(null);
			return null;
		}
		persistActiveOrgId(chosen.id);
		return chosen;
	} catch {
		return null;
	}
};

export const listOrganizations = async (token: string) => {
	return apiCall<Organization[]>(`${ATRIUM_API_BASE}/orgs/`, token);
};

export const getOrgMembers = async (token: string, orgId: string) => {
	return apiCall<{ members: OrgMember[]; total: number }>(
		`${ATRIUM_API_BASE}/orgs/${orgId}/members`,
		token
	);
};

export const getOrgSubAccounts = async (token: string, orgId: string) => {
	return apiCall<OrgSubAccountsResponse>(`${ATRIUM_API_BASE}/orgs/${orgId}/subaccounts`, token);
};

// ─── Onboarding (P1: capture + Engram seed + completion) ────

/** The FIXED P1 question set. Keys must match the backend's FACT_LABELS
 * (apps/atrium/backend/routers/onboarding.py) — that mapping turns each answer into one
 * seeded fact ("Industry: SaaS"). Every field is optional: the user can skip any of them
 * and only the answered ones get seeded. */
export interface OnboardingAnswers {
	orgName?: string;
	industry?: string;
	whatBusinessDoes?: string;
	customers?: string;
	primaryGoal?: string;
	dayToDay?: string;
}

export interface OnboardingState {
	completed: boolean;
	completedAt?: number | null;
	version?: number;
}

export interface OnboardingCompleteResponse {
	ok: boolean;
	completed: boolean;
	/** false when the Engram seed failed — onboarding is still complete (seeding is
	 * best-effort), and this is the signal a later retry keys off. */
	seeded: boolean;
	factCount?: number;
}

/** Server-side onboarding gate, replacing the ephemeral `onboardingComplete` store — the
 * old one reset on every reload and never crossed devices. */
export const getOnboardingState = async (token: string, orgId: string) => {
	return apiCall<OnboardingState>(`${ATRIUM_API_BASE}/orgs/${orgId}/onboarding`, token);
};

/** Persist the captured answers, seed them into Engram, and mark onboarding done.
 * `subAccountId` is accepted by the backend for a later per-sub-account pass; the P1
 * org-level flow omits it, so seeding lands at company/business scope. */
export const completeOnboarding = async (
	token: string,
	orgId: string,
	answers: OnboardingAnswers,
	subAccountId?: string
) => {
	return apiCall<OnboardingCompleteResponse>(
		`${ATRIUM_API_BASE}/orgs/${orgId}/onboarding`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ answers, ...(subAccountId && { subAccountId }) })
		}
	);
};

// ─── Onboarding (P2: explicit agent provisioning) ─────────────

export interface ProvisionedAgent {
	/** Canonical Conductor role, e.g. `cmo`. */
	role: string;
	agentId: string;
	/** false when the org already had an agent for this role (the call is idempotent). */
	created: boolean;
}

export interface ProvisionAgentsResponse {
	ok: boolean;
	agents: ProvisionedAgent[];
	roles: string[];
}

/** Provision one Conductor agent per canonical role for the org — the departments picked in
 * the wizard. The backend relays Conductor's 400 for an unknown role and returns 502 when the
 * bridge is down; callers treat any failure as best-effort (lazy provisioning covers the
 * rest later). */
export const provisionOnboardingAgents = async (token: string, orgId: string, roles: string[]) => {
	return apiCall<ProvisionAgentsResponse>(
		`${ATRIUM_API_BASE}/orgs/${orgId}/onboarding/agents`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ roles })
		}
	);
};

// ─── Onboarding (P3: assisted "help me decide" path) ──────────

export interface OnboardingRoleSuggestion {
	/** Canonical Conductor role, e.g. `cmo`. */
	role: string;
	rationale: string;
	first_task_hints: string[];
}

export interface OnboardingSuggestResponse {
	/** Suggested canonical roles; may be empty when the answers carry no strong signal. */
	roles: string[];
	suggestions: OnboardingRoleSuggestion[];
	model: string;
}

/** Ask the backend (Conductor via P3a) which departments fit the interview answers. Returns
 * 502 when Conductor is unreachable; callers fall back to manual picking on any failure. It
 * only suggests — nothing is provisioned until FinalSetup runs. */
export const suggestOnboardingRoles = async (
	token: string,
	orgId: string,
	answers: OnboardingAnswers,
	maxRoles?: number
) => {
	return apiCall<OnboardingSuggestResponse>(
		`${ATRIUM_API_BASE}/orgs/${orgId}/onboarding/suggest`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ answers, ...(maxRoles !== undefined && { maxRoles }) })
		}
	);
};

// ─── Onboarding (P4: opt-in starter tasks) ────────────────────

export interface OnboardingStarterTask {
	title: string;
	description?: string;
	priority?: string;
}

export interface SeededOnboardingIssue {
	id: string;
	identifier: string;
	title: string;
}

export interface SeedOnboardingTasksResponse {
	issues: SeededOnboardingIssue[];
}

/** File the starter tasks the user explicitly ticked in FinalSetup as CEO handoff tickets
 * (1..20 per call). Returns 502 when the tracker is unreachable; callers treat any failure
 * as best-effort — the user can start the work from chat later. */
export const seedOnboardingTasks = async (
	token: string,
	orgId: string,
	tasks: OnboardingStarterTask[]
) => {
	return apiCall<SeedOnboardingTasksResponse>(
		`${ATRIUM_API_BASE}/orgs/${orgId}/onboarding/tasks`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ tasks })
		}
	);
};

// ─── First sub-account onboarding (Phase 1.4) ─────────────────

/** Portal page that creates a sub-account, and the marker params of the return hop. */
const PORTAL_NEW_SUBACCOUNT_URL = 'https://portal.orbit.example/settings/subaccounts/new';
export const SUBACCOUNT_CREATED_PARAM = 'subAccountCreated';
export const NEW_SUBACCOUNT_ID_PARAM = 'newSubAccountId';

/**
 * Deep link to Portal's "create sub-account" page, carrying the full return hop back here.
 *
 * Portal redirects to `returnTo` with a fresh Portal JWT, which our auth callback exchanges
 * for an OWUI session cookie before 303-ing to `next`. `subAccountCreated=1` on the callback
 * makes it force-sync the sub-account mirror (bypassing the per-org back-off), so the
 * just-created sub-account is present by the time the UI reloads; the copy of it on `next`
 * is what the UI reads to auto-select the new scope.
 *
 * `publicOrigin` comes from the server and is preferred, because Portal's redirect allowlist
 * matches on an exact origin. Falling back to window.location.origin is best-effort: on a
 * host that is not the registered origin the hop will simply be refused by Portal.
 */
export const buildAddSubAccountUrl = (publicOrigin?: string | null): string => {
	const origin =
		publicOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
	const next = `/atrium/?${SUBACCOUNT_CREATED_PARAM}=1`;
	const returnTo = `${origin}/atrium/auth/callback?${SUBACCOUNT_CREATED_PARAM}=1&next=${encodeURIComponent(next)}`;
	return `${PORTAL_NEW_SUBACCOUNT_URL}?returnTo=${encodeURIComponent(returnTo)}`;
};

export const selectOrgSubAccount = async (
	token: string,
	orgId: string,
	subAccountId: string | null
) => {
	return apiCall<{ selected: string | null }>(
		`${ATRIUM_API_BASE}/orgs/${orgId}/subaccounts/select`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ subAccountId })
		}
	);
};

const buildWorkPipeDashboardQuery = (orgId: string, subAccountId?: string | null) => {
	const params = new URLSearchParams({ org_id: orgId });
	if (subAccountId) params.set('subAccountId', subAccountId);
	return params;
};

export const getDashboardWorkPipeStats = async (
	token: string,
	orgId: string,
	subAccountId: string | null
) => {
	const params = buildWorkPipeDashboardQuery(orgId, subAccountId);
	return apiCall<{ data: WorkPipeStats }>(
		`${ATRIUM_API_BASE}/dashboard/workpipe/stats?${params.toString()}`,
		token
	);
};

export const getDashboardWorkPipePipelines = async (
	token: string,
	orgId: string,
	subAccountId: string | null
) => {
	const params = buildWorkPipeDashboardQuery(orgId, subAccountId);
	return apiCall<{ data: WorkPipePipelinesData }>(
		`${ATRIUM_API_BASE}/dashboard/workpipe/pipelines?${params.toString()}`,
		token
	);
};

export const getDashboardWorkPipeContacts = async (
	token: string,
	orgId: string,
	subAccountId: string | null,
	options: {
		search?: string;
		limit?: number;
		offset?: number;
	} = {}
) => {
	const params = buildWorkPipeDashboardQuery(orgId, subAccountId);
	if (options.search) params.set('search', options.search);
	if (typeof options.limit === 'number') params.set('limit', String(options.limit));
	if (typeof options.offset === 'number') params.set('offset', String(options.offset));
	return apiCall<{ data: WorkPipeContactsData }>(
		`${ATRIUM_API_BASE}/dashboard/workpipe/contacts?${params.toString()}`,
		token
	);
};

export interface WorkPipeAppointment {
	id: string;
	title: string;
	start: string;
	end?: string | null;
	allDay?: boolean;
	category?: string | null;
}

export interface WorkPipeAppointmentsData {
	upcoming: WorkPipeAppointment[];
	upcomingCount: number;
}

export interface WorkPipeInvoiceRecent {
	id: string;
	name: string;
	type?: string | null;
	totalDue: number;
	dueDate?: string | null;
}

export interface WorkPipeInvoicesData {
	count: number;
	totalDue: number;
	dueSoonCount: number;
	recent: WorkPipeInvoiceRecent[];
}

export interface WorkPipeFunnelRecent {
	id: string;
	name: string;
	published: boolean;
	visits: number;
}

export interface WorkPipeFunnelsData {
	count: number;
	publishedCount: number;
	totalVisits: number;
	recent: WorkPipeFunnelRecent[];
}

export const getDashboardWorkPipeAppointments = async (
	token: string,
	orgId: string,
	subAccountId: string | null
) => {
	const params = buildWorkPipeDashboardQuery(orgId, subAccountId);
	return apiCall<{ data: WorkPipeAppointmentsData }>(
		`${ATRIUM_API_BASE}/dashboard/workpipe/appointments?${params.toString()}`,
		token
	);
};

export const getDashboardWorkPipeInvoices = async (
	token: string,
	orgId: string,
	subAccountId: string | null
) => {
	const params = buildWorkPipeDashboardQuery(orgId, subAccountId);
	return apiCall<{ data: WorkPipeInvoicesData }>(
		`${ATRIUM_API_BASE}/dashboard/workpipe/invoices?${params.toString()}`,
		token
	);
};

export const getDashboardWorkPipeFunnels = async (
	token: string,
	orgId: string,
	subAccountId: string | null
) => {
	const params = buildWorkPipeDashboardQuery(orgId, subAccountId);
	return apiCall<{ data: WorkPipeFunnelsData }>(
		`${ATRIUM_API_BASE}/dashboard/workpipe/funnels?${params.toString()}`,
		token
	);
};

export interface WorkPipeTrendPoint {
	date: string;
	contacts: number;
	deals: number;
	invoices: number;
}

export interface WorkPipeTrendsData {
	days: number;
	series: WorkPipeTrendPoint[];
	totals: { contacts: number; deals: number; invoices: number };
}

export const getDashboardWorkPipeTrends = async (
	token: string,
	orgId: string,
	subAccountId: string | null,
	days = 30
) => {
	const params = buildWorkPipeDashboardQuery(orgId, subAccountId);
	params.set('days', String(days));
	return apiCall<{ data: WorkPipeTrendsData }>(
		`${ATRIUM_API_BASE}/dashboard/workpipe/trends?${params.toString()}`,
		token
	);
};

export const getDashboardConductorHistory = async (
	token: string,
	orgId: string,
	subAccountId: string | null,
	limit?: number
) => {
	const params = buildWorkPipeDashboardQuery(orgId, subAccountId);
	if (typeof limit === 'number') params.set('limit', String(limit));
	return apiCall<{ data: ConductorRun[] }>(
		`${ATRIUM_API_BASE}/dashboard/conductor/history?${params.toString()}`,
		token
	);
};

export type DriveSummary = {
	quota: { usedBytes: string; quotaBytes: string };
	fileCount: number;
	folderCount: number;
	recentFiles: {
		id: string;
		name: string;
		size: string;
		mimeType: string;
		createdAt: string;
	}[];
};

export const getDashboardDriveSummary = async (
	token: string,
	orgId: string,
	subAccountId: string | null
) => {
	const params = buildWorkPipeDashboardQuery(orgId, subAccountId);
	return apiCall<{ data: DriveSummary }>(
		`${ATRIUM_API_BASE}/dashboard/drive/summary?${params.toString()}`,
		token
	);
};

export const addOrgMember = async (
	token: string,
	orgId: string,
	data: { user_id: string; role?: string; department_ids?: string[] }
) => {
	return apiCall<OrgMember>(`${ATRIUM_API_BASE}/orgs/${orgId}/members`, token, {
		method: 'POST',
		body: JSON.stringify(data)
	});
};

// ─── Departments ──────────────────────────────────────────────

export const getDepartments = async (token: string, orgId: string) => {
	return apiCall<{ departments: Department[]; total: number }>(
		`${ATRIUM_API_BASE}/departments/?org_id=${orgId}`,
		token
	);
};

export const getDepartment = async (token: string, departmentId: string, orgId: string) => {
	return apiCall<Department>(
		`${ATRIUM_API_BASE}/departments/${departmentId}?org_id=${orgId}`,
		token
	);
};

export const sendDepartmentChat = async (
	token: string,
	orgId: string,
	departmentSlug: string,
	data: {
		message: string;
		user_id: string;
		chat_id?: string;
		conversation_history?: { role: string; content: string }[];
	}
) => {
	return apiCall<ChatResponse>(
		`${ATRIUM_API_BASE}/departments/${departmentSlug}/chat?org_id=${orgId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify(data)
		}
	);
};

export const sendChiefChat = async (
	token: string,
	orgId: string,
	data: {
		message: string;
		user_id: string;
		chat_id?: string;
		conversation_history?: { role: string; content: string }[];
	}
) => {
	return apiCall<ChatResponse>(
		`${ATRIUM_API_BASE}/departments/chief/chat?org_id=${orgId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify(data)
		}
	);
};

// ─── Proposals ────────────────────────────────────────────────

export const getProposals = async (
	token: string,
	orgId: string,
	params?: { status?: string; department_id?: string; limit?: number; offset?: number }
) => {
	const searchParams = new URLSearchParams({ org_id: orgId });
	if (params?.status) searchParams.append('status', params.status);
	if (params?.department_id) searchParams.append('department_id', params.department_id);
	if (params?.limit) searchParams.append('limit', String(params.limit));
	if (params?.offset) searchParams.append('offset', String(params.offset));

	return apiCall<{ proposals: Proposal[]; total: number }>(
		`${ATRIUM_API_BASE}/proposals/?${searchParams.toString()}`,
		token
	);
};

export const getProposal = async (token: string, proposalId: string, orgId: string) => {
	return apiCall<Proposal>(
		`${ATRIUM_API_BASE}/proposals/${proposalId}?org_id=${orgId}`,
		token
	);
};

export const createProposal = async (
	token: string,
	orgId: string,
	data: {
		department_id: string;
		title: string;
		description: string;
		action_type: string;
		action_payload?: Record<string, unknown>;
		risk_level?: string;
		risk_reasoning?: string;
		chat_id?: string;
	}
) => {
	return apiCall<{ id: string; title: string; status: string }>(
		`${ATRIUM_API_BASE}/proposals/?org_id=${orgId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify(data)
		}
	);
};

export const reviewProposal = async (
	token: string,
	proposalId: string,
	orgId: string,
	userId: string,
	data: { status: 'approved' | 'rejected'; review_note?: string }
) => {
	return apiCall<{ id: string; status: string }>(
		`${ATRIUM_API_BASE}/proposals/${proposalId}/review?org_id=${orgId}&user_id=${userId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify(data)
		}
	);
};

export const getProposalStats = async (token: string, orgId: string) => {
	return apiCall<ProposalStats>(
		`${ATRIUM_API_BASE}/proposals/stats?org_id=${orgId}`,
		token
	);
};

// ─── Conductor Approvals ─────────────────────────────────────────

export interface ConductorApproval {
	id: string;
	type: 'hire_agent' | 'custom';
	status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
	payload: Record<string, unknown>;
	requested_by_agent_id?: string;
	requested_by_agent_name?: string;
	decision_note?: string;
	decided_by_user_id?: string;
	decided_at?: number;
	created_at: number;
	updated_at: number;
	synced_at: number;
}

export interface ConductorApprovalStats {
	total: number;
	pending: number;
	approved: number;
	rejected: number;
	revision_requested: number;
	hire_agent: number;
}

export const getConductorApprovals = async (
	token: string,
	orgId: string,
	params?: { status?: string; approval_type?: string; limit?: number; offset?: number }
) => {
	const searchParams = new URLSearchParams({ org_id: orgId });
	if (params?.status) searchParams.append('status', params.status);
	if (params?.approval_type) searchParams.append('approval_type', params.approval_type);
	if (params?.limit) searchParams.append('limit', String(params.limit));
	if (params?.offset) searchParams.append('offset', String(params.offset));

	return apiCall<{ approvals: ConductorApproval[]; total: number }>(
		`${ATRIUM_API_BASE}/conductor-approvals/?${searchParams.toString()}`,
		token
	);
};

export const getConductorApproval = async (token: string, approvalId: string, orgId: string) => {
	return apiCall<ConductorApproval>(
		`${ATRIUM_API_BASE}/conductor-approvals/${approvalId}?org_id=${orgId}`,
		token
	);
};

export const getConductorApprovalStats = async (token: string, orgId: string) => {
	return apiCall<ConductorApprovalStats>(
		`${ATRIUM_API_BASE}/conductor-approvals/stats?org_id=${orgId}`,
		token
	);
};

export const getConductorPendingCount = async (token: string, orgId: string) => {
	return apiCall<{ count: number }>(
		`${ATRIUM_API_BASE}/conductor-approvals/pending-count?org_id=${orgId}`,
		token
	);
};

export const approveConductorApproval = async (
	token: string,
	approvalId: string,
	orgId: string,
	userId: string,
	data: { decision_note?: string }
) => {
	return apiCall<{ id: string; status: string; message: string }>(
		`${ATRIUM_API_BASE}/conductor-approvals/${approvalId}/approve?org_id=${orgId}&user_id=${userId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify(data)
		}
	);
};

export const rejectConductorApproval = async (
	token: string,
	approvalId: string,
	orgId: string,
	userId: string,
	data: { decision_note?: string }
) => {
	return apiCall<{ id: string; status: string; message: string }>(
		`${ATRIUM_API_BASE}/conductor-approvals/${approvalId}/reject?org_id=${orgId}&user_id=${userId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify(data)
		}
	);
};

export const syncConductorApprovals = async (
	token: string,
	orgId: string,
	conductorCompanyId: string
) => {
	return apiCall<{ success: boolean; stats: Record<string, number>; message: string }>(
		`${ATRIUM_API_BASE}/conductor-approvals/sync?org_id=${orgId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ conductor_company_id: conductorCompanyId })
		}
	);
};

// ─── Employee Tabs ────────────────────────────────────────────

export interface EmployeeTab {
	id: string;
	agent_id: string;
	agent_name: string;
	agent_icon?: string;
	department: string;
	is_visible: boolean;
	is_pinned: boolean;
	sort_order: number;
	conversation_history?: Array<{ role: string; content: string; timestamp?: number }>;
	message_count?: number;
	last_interaction_at?: number;
	created_at: number;
	updated_at: number;
}

export const getEmployeeTabs = async (
	token: string,
	orgId: string,
	userId: string,
	visibleOnly: boolean = true
) => {
	const searchParams = new URLSearchParams({
		org_id: orgId,
		user_id: userId,
		visible_only: String(visibleOnly)
	});
	return apiCall<{ tabs: EmployeeTab[]; total: number }>(
		`${ATRIUM_API_BASE}/employee-tabs/?${searchParams.toString()}`,
		token
	);
};

export const getEmployeeTab = async (
	token: string,
	tabId: string,
	orgId: string,
	userId: string
) => {
	return apiCall<EmployeeTab>(
		`${ATRIUM_API_BASE}/employee-tabs/${tabId}?org_id=${orgId}&user_id=${userId}`,
		token
	);
};

export const getEmployeeTabByAgent = async (
	token: string,
	agentId: string,
	orgId: string,
	userId: string
) => {
	return apiCall<EmployeeTab>(
		`${ATRIUM_API_BASE}/employee-tabs/by-agent/${agentId}?org_id=${orgId}&user_id=${userId}`,
		token
	);
};

export const toggleTabVisibility = async (
	token: string,
	tabId: string,
	orgId: string,
	userId: string,
	isVisible: boolean
) => {
	return apiCall<{ id: string; is_visible: boolean; message: string }>(
		`${ATRIUM_API_BASE}/employee-tabs/${tabId}/visibility?org_id=${orgId}&user_id=${userId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ is_visible: isVisible })
		}
	);
};

export const toggleTabPin = async (
	token: string,
	tabId: string,
	orgId: string,
	userId: string,
	isPinned: boolean
) => {
	return apiCall<{ id: string; is_pinned: boolean; message: string }>(
		`${ATRIUM_API_BASE}/employee-tabs/${tabId}/pin?org_id=${orgId}&user_id=${userId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ is_pinned: isPinned })
		}
	);
};

export const addTabMessage = async (
	token: string,
	tabId: string,
	orgId: string,
	userId: string,
	role: 'user' | 'assistant',
	content: string
) => {
	return apiCall<{ id: string; message_count: number; last_interaction_at: number }>(
		`${ATRIUM_API_BASE}/employee-tabs/${tabId}/messages?org_id=${orgId}&user_id=${userId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ role, content })
		}
	);
};

export const clearTabHistory = async (
	token: string,
	tabId: string,
	orgId: string,
	userId: string
) => {
	return apiCall<{ id: string; message: string }>(
		`${ATRIUM_API_BASE}/employee-tabs/${tabId}/messages?org_id=${orgId}&user_id=${userId}`,
		token,
		{
			method: 'DELETE'
		}
	);
};

export const syncEmployeeTabs = async (
	token: string,
	orgId: string,
	userId: string,
	conductorCompanyId: string
) => {
	return apiCall<{ success: boolean; stats: Record<string, number>; message: string }>(
		`${ATRIUM_API_BASE}/employee-tabs/sync?org_id=${orgId}&user_id=${userId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ conductor_company_id: conductorCompanyId })
		}
	);
};

export const reorderTabs = async (
	token: string,
	orgId: string,
	userId: string,
	tabIds: string[]
) => {
	return apiCall<{ success: boolean; message: string }>(
		`${ATRIUM_API_BASE}/employee-tabs/reorder?org_id=${orgId}&user_id=${userId}`,
		token,
		{
			method: 'POST',
			body: JSON.stringify({ tab_ids: tabIds })
		}
	);
};
