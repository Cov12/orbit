<script lang="ts">
	import { onMount } from 'svelte';
	import { activeOrgId } from '$lib/stores/atrium';
	import { user } from '$lib/stores';
	import {
		getConductorApprovals,
		approveConductorApproval,
		rejectConductorApproval,
		syncConductorApprovals,
		type ConductorApproval
	} from '$lib/apis/atrium';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import ConductorApprovalDetail from './ConductorApprovalDetail.svelte';

	export let conductorCompanyId: string = '';

	let filterStatus: string = 'pending';
	let selectedApproval: ConductorApproval | null = null;
	let approvals: ConductorApproval[] = [];
	let loading = false;
	let syncing = false;
	let actionSubmitting = false;

	const STATUS_COLORS: Record<string, string> = {
		pending: 'yellow',
		approved: 'green',
		rejected: 'red',
		revision_requested: 'orange'
	};

	const TYPE_LABELS: Record<string, string> = {
		hire_agent: 'Hire Agent',
		custom: 'Custom'
	};

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString();
	}

	function getAgentName(approval: ConductorApproval): string {
		if (approval.type === 'hire_agent' && approval.payload?.name) {
			return String(approval.payload.name);
		}
		return approval.requested_by_agent_name || 'Unknown';
	}

	function getAgentTitle(approval: ConductorApproval): string {
		if (approval.type === 'hire_agent' && approval.payload?.title) {
			return String(approval.payload.title);
		}
		return '';
	}

	async function loadApprovals() {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		if (!authToken) return;
		loading = true;
		try {
			const response = await getConductorApprovals(authToken, $activeOrgId, {
				status: filterStatus || undefined,
				limit: 100,
				offset: 0
			});
			approvals = response.approvals;
		} catch (error) {
			console.error('Failed to load Conductor approvals', error);
		} finally {
			loading = false;
		}
	}

	async function handleSync() {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		if (!authToken || !conductorCompanyId) return;
		syncing = true;
		try {
			await syncConductorApprovals(authToken, $activeOrgId, conductorCompanyId);
			await loadApprovals();
		} catch (error) {
			console.error('Failed to sync approvals', error);
		} finally {
			syncing = false;
		}
	}

	async function handleApprove(id: string, note?: string) {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		const currentUserId = $user?.id ?? 'unknown';
		if (!authToken) return;
		actionSubmitting = true;
		try {
			await approveConductorApproval(authToken, id, $activeOrgId, currentUserId, {
				decision_note: note?.trim() || undefined
			});
			await loadApprovals();
			selectedApproval = null;
		} catch (error) {
			console.error('Failed to approve', error);
		} finally {
			actionSubmitting = false;
		}
	}

	async function handleReject(id: string, note?: string) {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		const currentUserId = $user?.id ?? 'unknown';
		if (!authToken) return;
		actionSubmitting = true;
		try {
			await rejectConductorApproval(authToken, id, $activeOrgId, currentUserId, {
				decision_note: note?.trim() || undefined
			});
			await loadApprovals();
			selectedApproval = null;
		} catch (error) {
			console.error('Failed to reject', error);
		} finally {
			actionSubmitting = false;
		}
	}

	onMount(() => {
		loadApprovals();
	});

	$: if (filterStatus !== undefined) {
		loadApprovals();
	}

	$: pendingCount = approvals.filter((a) => a.status === 'pending').length;
</script>

<div class="flex h-full flex-col bg-[#0f0f13]">
	<!-- Header -->
	<div
		class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 px-4 sm:px-5 md:px-6 lg:px-8 py-3 sm:py-4"
	>
		<div class="flex items-center gap-2 min-w-0">
			<MaterialIcon icon="smart_toy" size={24} class="text-[#6961ff]" />
			<h2 class="text-lg sm:text-xl md:text-2xl font-semibold text-white truncate">
				Conductor Approvals
			</h2>
			{#if pendingCount > 0}
				<StatusBadge label={String(pendingCount)} color="yellow" size="md" />
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<button
				on:click={handleSync}
				disabled={syncing || !conductorCompanyId}
				class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<MaterialIcon
					icon="sync"
					size={16}
					class={syncing ? 'animate-spin' : ''}
				/>
				{syncing ? 'Syncing...' : 'Sync'}
			</button>

			<select
				bind:value={filterStatus}
				class="w-full sm:w-auto min-h-[44px] rounded-lg border border-white/10 bg-white/5 px-3 sm:px-3.5 py-2 text-sm md:text-base text-white focus:ring-0 focus:border-[#6961ff]"
			>
				<option value="">All Status</option>
				<option value="pending">Pending</option>
				<option value="approved">Approved</option>
				<option value="rejected">Rejected</option>
				<option value="revision_requested">Revision Requested</option>
			</select>
		</div>
	</div>

	<!-- Approval List -->
	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex items-center justify-center px-4 py-12 sm:py-14 md:py-16 text-slate-400">
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white mr-3"
				></div>
				Loading approvals...
			</div>
		{:else if approvals.length === 0}
			<div
				class="flex flex-col items-center justify-center px-4 py-12 sm:py-14 md:py-16 text-slate-400"
			>
				<MaterialIcon icon="check_circle" size={48} class="mb-3 text-slate-600" />
				<p class="text-sm sm:text-base">No Conductor approvals to review</p>
				{#if conductorCompanyId}
					<button
						on:click={handleSync}
						class="mt-3 text-sm text-[#6961ff] hover:underline"
					>
						Sync from Conductor
					</button>
				{/if}
			</div>
		{:else}
			{#each approvals as approval}
				<button
					class="flex w-full items-start gap-3 sm:gap-4 border-b border-white/5 px-4 sm:px-5 md:px-6 lg:px-8 py-3 sm:py-4 text-left transition-colors hover:bg-white/5 min-h-[44px]"
					on:click={() => (selectedApproval = approval)}
				>
					<!-- Icon -->
					<div
						class="mt-1 h-10 w-10 rounded-lg bg-[#6961ff]/20 flex items-center justify-center shrink-0"
					>
						<MaterialIcon
							icon={approval.type === 'hire_agent' ? 'person_add' : 'approval'}
							size={20}
							class="text-[#6961ff]"
						/>
					</div>

					<!-- Content -->
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="font-medium text-white text-sm sm:text-base truncate">
								{getAgentName(approval)}
							</span>
							<StatusBadge label={TYPE_LABELS[approval.type]} color="blue" size="sm" />
						</div>
						{#if getAgentTitle(approval)}
							<p class="text-xs sm:text-sm text-slate-400 mt-0.5">
								{getAgentTitle(approval)}
							</p>
						{/if}
						<div class="mt-1 flex items-center gap-2 text-xs sm:text-sm flex-wrap">
							<StatusBadge
								label={approval.status.replace('_', ' ')}
								color={STATUS_COLORS[approval.status]}
							/>
							{#if approval.requested_by_agent_name}
								<span class="text-slate-500 truncate">
									Requested by {approval.requested_by_agent_name}
								</span>
							{/if}
						</div>
					</div>

					<!-- Timestamp -->
					<span class="mt-1 shrink-0 text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">
						{formatDate(approval.created_at)}
					</span>
				</button>
			{/each}
		{/if}
	</div>
</div>

{#if selectedApproval}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-5 md:p-6"
		on:click={() => (selectedApproval = null)}
	>
		<div class="w-full max-w-2xl md:max-w-3xl lg:max-w-4xl" on:click|stopPropagation>
			<ConductorApprovalDetail
				approval={selectedApproval}
				submitting={actionSubmitting}
				on:approve={(e) => handleApprove(e.detail.id, e.detail.note)}
				on:reject={(e) => handleReject(e.detail.id, e.detail.note)}
				on:close={() => (selectedApproval = null)}
			/>
		</div>
	</div>
{/if}
