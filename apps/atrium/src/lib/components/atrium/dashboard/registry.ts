/**
 * Dashboard Provider Registry (Dashboard D1)
 * ------------------------------------------
 * The cross-ecosystem dashboard is a SHELL: `CrossEcosystemDashboard.svelte`
 * iterates `dashboardWidgets`, calls each descriptor's `load()` with the
 * current (token, orgId, subAccountId), and renders its `component` inside a
 * GlassPanel with the loaded data.
 *
 * ► ADDING A WIDGET (this is the whole extension story — no dashboard rewrite):
 *     1. Build a `.svelte` component under ./widgets that takes a `data` prop.
 *     2. Append one `DashboardWidget` descriptor to `dashboardWidgets` below.
 *   D2 (WorkPipe widgets) and D4 (Conductor widgets) plug in exactly this way.
 *
 * ► READ-ONLY CONTRACT: a widget's `load()` MUST call only read (get-prefixed)
 *   endpoints from `$lib/apis/atrium`. Never call a mutation (create, update,
 *   select, approve, reject, sync, …) from the dashboard — it is view-only.
 */
import type { ComponentType } from 'svelte';
import {
	getDashboardConductorHistory,
	getDashboardDriveSummary,
	getDashboardWorkPipeContacts,
	getDashboardWorkPipePipelines,
	getDashboardWorkPipeStats,
	getDashboardWorkPipeAppointments,
	getDashboardWorkPipeInvoices,
	getDashboardWorkPipeFunnels,
	getDashboardWorkPipeTrends,
	getOrganization,
	getOrgSubAccounts
} from '$lib/apis/atrium';
import ConductorRecentRunsWidget from './widgets/ConductorRecentRunsWidget.svelte';
import DriveSummaryWidget from './widgets/DriveSummaryWidget.svelte';
import OrganizationWidget from './widgets/OrganizationWidget.svelte';
import SubAccountsWidget from './widgets/SubAccountsWidget.svelte';
import WorkPipeKpiWidget from './widgets/WorkPipeKpiWidget.svelte';
import WorkPipePipelineBoardWidget from './widgets/WorkPipePipelineBoardWidget.svelte';
import WorkPipeRecentContactsWidget from './widgets/WorkPipeRecentContactsWidget.svelte';
import WorkPipeAppointmentsWidget from './widgets/WorkPipeAppointmentsWidget.svelte';
import WorkPipeInvoicesWidget from './widgets/WorkPipeInvoicesWidget.svelte';
import WorkPipeFunnelsWidget from './widgets/WorkPipeFunnelsWidget.svelte';
import WorkPipeTrendsWidget from './widgets/WorkPipeTrendsWidget.svelte';

export type DashboardWidget = {
	/** Stable unique key — used for keyed rendering + per-widget state. */
	id: string;
	/** Panel heading shown in the widget's GlassPanel. */
	title: string;
	/** Material Symbols icon name for the panel heading. */
	icon: string;
	/** Grid columns to span on large screens (1–3). Defaults to 1. */
	span?: number;
	/**
	 * Fetches the widget's data. MUST be read-only (get* endpoints only).
	 * @param subAccountId active scope; `null` means the Business (org-wide) view.
	 */
	load: (token: string, orgId: string, subAccountId: string | null) => Promise<unknown>;
	/** Svelte component rendered with `data={<load() result>}`. */
	component: ComponentType;
};

const WORKPIPE_SCOPE_EMPTY_STATE = {
	emptyState: 'Select a sub-account to view CRM.'
} as const;

export const dashboardWidgets: DashboardWidget[] = [
	{
		id: 'organization',
		title: 'Organization',
		icon: 'corporate_fare',
		span: 1,
		load: (token, orgId) => getOrganization(token, orgId),
		component: OrganizationWidget
	},
	{
		id: 'sub-accounts',
		title: 'Sub-accounts',
		icon: 'workspaces',
		span: 1,
		load: (token, orgId) => getOrgSubAccounts(token, orgId),
		component: SubAccountsWidget
	},
	{
		id: 'workpipe-kpis',
		title: 'WorkPipe KPIs',
		icon: 'monitoring',
		span: 1,
		load: async (token, orgId, subAccountId) => {
			if (!subAccountId) return WORKPIPE_SCOPE_EMPTY_STATE;
			return (await getDashboardWorkPipeStats(token, orgId, subAccountId)).data;
		},
		component: WorkPipeKpiWidget
	},
	{
		id: 'workpipe-pipeline-board',
		title: 'Pipeline board',
		icon: 'view_kanban',
		span: 2,
		load: async (token, orgId, subAccountId) => {
			if (!subAccountId) return WORKPIPE_SCOPE_EMPTY_STATE;
			const [pipelines, stats] = await Promise.all([
				getDashboardWorkPipePipelines(token, orgId, subAccountId),
				getDashboardWorkPipeStats(token, orgId, subAccountId)
			]);
			return {
				pipelines: pipelines.data.pipelines,
				count: pipelines.data.count,
				ticketsByLane: stats.data.tickets.byLane
			};
		},
		component: WorkPipePipelineBoardWidget
	},
	{
		id: 'workpipe-recent-contacts',
		title: 'Recent contacts',
		icon: 'contacts',
		span: 1,
		load: async (token, orgId, subAccountId) => {
			if (!subAccountId) return WORKPIPE_SCOPE_EMPTY_STATE;
			return (await getDashboardWorkPipeContacts(token, orgId, subAccountId, { limit: 6 })).data;
		},
		component: WorkPipeRecentContactsWidget
	},
	{
		id: 'workpipe-appointments',
		title: 'Upcoming appointments',
		icon: 'event',
		span: 1,
		load: async (token, orgId, subAccountId) => {
			if (!subAccountId) return WORKPIPE_SCOPE_EMPTY_STATE;
			return (await getDashboardWorkPipeAppointments(token, orgId, subAccountId)).data;
		},
		component: WorkPipeAppointmentsWidget
	},
	{
		id: 'workpipe-invoices',
		title: 'Invoices',
		icon: 'receipt_long',
		span: 1,
		load: async (token, orgId, subAccountId) => {
			if (!subAccountId) return WORKPIPE_SCOPE_EMPTY_STATE;
			return (await getDashboardWorkPipeInvoices(token, orgId, subAccountId)).data;
		},
		component: WorkPipeInvoicesWidget
	},
	{
		id: 'workpipe-funnels',
		title: 'Funnels',
		icon: 'filter_alt',
		span: 1,
		load: async (token, orgId, subAccountId) => {
			if (!subAccountId) return WORKPIPE_SCOPE_EMPTY_STATE;
			return (await getDashboardWorkPipeFunnels(token, orgId, subAccountId)).data;
		},
		component: WorkPipeFunnelsWidget
	},
	{
		id: 'workpipe-trends',
		title: 'Activity trend',
		icon: 'show_chart',
		span: 2,
		load: async (token, orgId, subAccountId) => {
			if (!subAccountId) return WORKPIPE_SCOPE_EMPTY_STATE;
			return (await getDashboardWorkPipeTrends(token, orgId, subAccountId, 30)).data;
		},
		component: WorkPipeTrendsWidget
	},
	{
		id: 'conductor-recent-runs',
		title: 'Recent Conductor activity',
		icon: 'smart_toy',
		span: 1,
		// Conductor history works at business scope too — no sub-account gate needed;
		// `null` subAccountId returns business-level runs from the /history verb.
		load: async (token, orgId, subAccountId) =>
			(await getDashboardConductorHistory(token, orgId, subAccountId, 8)).data,
		component: ConductorRecentRunsWidget
	},
	{
		id: 'drive-summary',
		title: 'Drive',
		icon: 'folder_open',
		span: 1,
		// Drive summary works at business scope too — the endpoint treats a null
		// subAccountId as the org-wide (business) view, so no sub-account gate needed.
		load: async (token, orgId, subAccountId) =>
			(await getDashboardDriveSummary(token, orgId, subAccountId)).data,
		component: DriveSummaryWidget
	}
];
