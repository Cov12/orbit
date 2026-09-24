<!--
	CrossEcosystemDashboard (Dashboard D1)
	--------------------------------------
	Read-only cross-ecosystem dashboard SHELL. Renders an org header, a local
	sub-account scope selector, and a responsive GlassPanel grid of widgets
	sourced from the provider registry (./dashboard/registry.ts).

	This shell never mutates: the scope selector drives a LOCAL `activeSubAccountId`
	(null = Business / org-wide) and reloads widgets — it does NOT persist scope.
	New widgets arrive by appending a descriptor to `dashboardWidgets`; no edits
	here are needed. See registry.ts for the extension + read-only contract.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores';
	import { activeOrg, activeOrgId } from '$lib/stores/atrium';
	import { getOrgSubAccounts, type OrgSubAccount } from '$lib/apis/atrium';
	import GlassPanel from '$lib/components/atrium/shared/GlassPanel.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import SubAccountScopeSelector from '$lib/components/atrium/SubAccountScopeSelector.svelte';
	import { dashboardWidgets } from '$lib/components/atrium/dashboard/registry';

	// Sub-account scope (local, read-only — not persisted)
	let subAccounts: OrgSubAccount[] = [];
	let activeSubAccountId: string | null = null;
	let loadingSubAccounts = false;

	// Per-widget state, keyed by widget id
	type WidgetState = { loading: boolean; error: boolean; unavailable: boolean; data: unknown };
	let widgetStates: Record<string, WidgetState> = Object.fromEntries(
		dashboardWidgets.map((w) => [w.id, { loading: true, error: false, unavailable: false, data: null }])
	);

	// Predefined span classes (Tailwind can't purge dynamic class names)
	const spanClasses: Record<number, string> = {
		1: '',
		2: 'sm:col-span-2',
		3: 'sm:col-span-2 lg:col-span-3'
	};

	function getToken(): string | undefined {
		return (($user as { token?: string } | undefined)?.token ?? localStorage.token) as string | undefined;
	}

	async function loadSubAccounts() {
		const token = getToken();
		if (!token || !$activeOrgId) {
			subAccounts = [];
			return;
		}
		loadingSubAccounts = true;
		try {
			const response = await getOrgSubAccounts(token, $activeOrgId);
			subAccounts = response.subAccounts;
		} catch (error) {
			subAccounts = [];
			console.error('Failed to load sub-account scope', error);
		} finally {
			loadingSubAccounts = false;
		}
	}

	// A widget's app may simply not be enabled for this workspace (entitlement/authorization
	// denial) — that is EXPECTED, not a failure. The backend surfaces it as an HTTP 403 whose
	// `detail` (which apiCall throws) is "App access denied: <APP>" / "Org access denied" /
	// "Org admin access required". Treat those as a muted "not enabled" state, not a red error.
	function isNotEnabled(err: unknown): boolean {
		const msg = String(
			typeof err === 'string'
				? err
				: (err && typeof err === 'object' && 'detail' in err
						? (err as { detail?: unknown }).detail
						: (err as { message?: unknown })?.message) ?? err
		);
		return /access denied|access required/i.test(msg);
	}

	async function loadWidgets() {
		const token = getToken();
		if (!token || !$activeOrgId) return;

		// Parallel load — each widget resolves/fails independently.
		await Promise.all(
			dashboardWidgets.map(async (widget) => {
				widgetStates[widget.id] = { loading: true, error: false, unavailable: false, data: null };
				widgetStates = widgetStates;
				try {
					const data = await widget.load(token, $activeOrgId, activeSubAccountId);
					widgetStates[widget.id] = { loading: false, error: false, unavailable: false, data };
				} catch (error) {
					const unavailable = isNotEnabled(error);
					if (!unavailable) {
						console.error(`Failed to load dashboard widget "${widget.id}"`, error);
					}
					widgetStates[widget.id] = { loading: false, error: !unavailable, unavailable, data: null };
				}
				widgetStates = widgetStates;
			})
		);
	}

	function handleSubAccountSelect(event: CustomEvent<{ subAccountId: string | null }>) {
		// Read-only: update local scope and re-fetch widgets. Do NOT persist.
		activeSubAccountId = event.detail.subAccountId;
		loadWidgets();
	}

	function isEmpty(data: unknown): boolean {
		return data == null;
	}

	onMount(async () => {
		await loadSubAccounts();
		await loadWidgets();
	});
</script>

<div class="w-full max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6">
	<!-- Org header -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="min-w-0">
			<h1 class="text-xl sm:text-2xl font-bold text-white truncate">
				{$activeOrg?.name ?? 'Dashboard'}
			</h1>
			<p class="text-xs sm:text-sm text-slate-500">Cross-ecosystem overview • read-only</p>
		</div>
		<SubAccountScopeSelector
			{subAccounts}
			{activeSubAccountId}
			loading={loadingSubAccounts}
			on:select={handleSubAccountSelect}
		/>
	</div>

	<!-- Widget grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
		{#each dashboardWidgets as widget (widget.id)}
			<GlassPanel
				class="p-4 sm:p-6 flex flex-col gap-4 {spanClasses[widget.span ?? 1] ?? ''}"
				opacity={0.5}
				borderOpacity={0.1}
			>
				<div class="flex items-center gap-2">
					<div class="p-1.5 bg-[#6961ff]/10 rounded-lg">
						<MaterialIcon icon={widget.icon} size={18} class="text-[#6961ff]" />
					</div>
					<h2 class="text-sm font-semibold text-white truncate">{widget.title}</h2>
				</div>

				{#if widgetStates[widget.id]?.loading}
					<div class="flex items-center gap-2 text-sm text-slate-400 py-2">
						<div class="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
						Loading...
					</div>
				{:else if widgetStates[widget.id]?.unavailable}
					<div class="flex items-center gap-2 text-sm text-slate-500 py-2">
						<MaterialIcon icon="lock" size={18} />
						Not enabled for this workspace.
					</div>
				{:else if widgetStates[widget.id]?.error}
					<div class="flex items-center gap-2 text-sm text-red-400 py-2">
						<MaterialIcon icon="error" size={18} />
						Failed to load.
					</div>
				{:else if isEmpty(widgetStates[widget.id]?.data)}
					<p class="text-sm text-slate-500 py-2">No data available.</p>
				{:else}
					<svelte:component this={widget.component} data={widgetStates[widget.id]?.data} />
				{/if}
			</GlassPanel>
		{/each}
	</div>
</div>
