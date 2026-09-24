<script lang="ts">
	import { onMount } from 'svelte';
	import { proposals, type Proposal, type ProposalStatus, activeOrgId } from '$lib/stores/atrium';
	import { user } from '$lib/stores';
	import { getProposals, reviewProposal, type Proposal as ApiProposal } from '$lib/apis/atrium';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import ProposalDetail from './ProposalDetail.svelte';

	let filterStatus: ProposalStatus | '' = 'pending';
	let selectedProposal: Proposal | null = null;
	let loading = false;
	let reviewSubmitting = false;


	const RISK_COLORS: Record<string, string> = {
		low: 'green', medium: 'yellow', high: 'orange', critical: 'red'
	};

	const STATUS_COLORS: Record<string, string> = {
		pending: 'yellow', approved: 'green', rejected: 'red', expired: 'purple'
	};

	function mapApiProposal(apiProposal: ApiProposal): Proposal {
		const mappedStatus: Proposal['status'] =
			apiProposal.status === 'pending' || apiProposal.status === 'approved' || apiProposal.status === 'rejected'
				? apiProposal.status
				: 'rejected';
		const createdAt = apiProposal.created_at
			? new Date(apiProposal.created_at * 1000).toLocaleString()
			: '—';

		return {
			id: apiProposal.id,
			title: apiProposal.title,
			dept: apiProposal.department_id || 'chief',
			description: apiProposal.description,
			status: mappedStatus,
			createdAt,
			priority: apiProposal.risk_level,
			actions: [
				{ label: 'Approve', type: 'primary' },
				{ label: 'Reject', type: 'danger' },
				{ label: 'View Details', type: 'secondary' }
			] as Proposal['actions']
		};
	}

	async function loadProposals() {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		if (!authToken) return;
		loading = true;
		try {
			const response = await getProposals(authToken, $activeOrgId, { limit: 100, offset: 0 });
			proposals.set(response.proposals.map(mapApiProposal));
		} catch (error) {
			console.error('Failed to load proposals', error);
		} finally {
			loading = false;
		}
	}

	async function handleReview(id: string, status: 'approved' | 'rejected', note?: string) {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		const currentUserId = $user?.id ?? 'unknown';
		if (!authToken) return;
		reviewSubmitting = true;
		try {
			await reviewProposal(authToken, id, $activeOrgId, currentUserId, {
				status,
				review_note: note?.trim() ? note : undefined
			});
			await loadProposals();
			selectedProposal = null;
		} catch (error) {
			console.error('Failed to review proposal', error);
		} finally {
			reviewSubmitting = false;
		}
	}

	onMount(() => {
		loadProposals();
	});

	$: filtered = filterStatus
		? $proposals.filter((p) => p.status === filterStatus)
		: $proposals;
</script>

<div class="flex h-full flex-col bg-[#0f0f13]">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 px-4 sm:px-5 md:px-6 lg:px-8 py-3 sm:py-4">
		<div class="flex items-center gap-2 min-w-0">
			<h2 class="text-lg sm:text-xl md:text-2xl font-semibold text-white truncate">Approval Inbox</h2>
			{#if $proposals.filter(p => p.status === 'pending').length > 0}
				<StatusBadge label="{String($proposals.filter(p => p.status === 'pending').length)}" color="yellow" size="md" />
			{/if}
		</div>

		<select
			bind:value={filterStatus}
			class="w-full sm:w-auto min-h-[44px] rounded-lg border border-white/10 bg-white/5 px-3 sm:px-3.5 py-2 text-sm md:text-base text-white focus:ring-0 focus:border-[#6961ff]"
		>
			<option value="">All Status</option>
			<option value="pending">Pending</option>
			<option value="approved">Approved</option>
			<option value="rejected">Rejected</option>
		</select>
	</div>

	<!-- Proposal List -->
	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex items-center justify-center px-4 py-12 sm:py-14 md:py-16 text-slate-400">
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white mr-3"></div>
				Loading proposals...
			</div>
		{:else if filtered.length === 0}
			<div class="flex flex-col items-center justify-center px-4 py-12 sm:py-14 md:py-16 text-slate-400">
				<MaterialIcon icon="check_circle" size={48} class="mb-3 text-slate-600" />
				<p class="text-sm sm:text-base">No proposals to review</p>
			</div>
		{:else}
			{#each filtered as proposal}
				<button
					class="flex w-full items-start gap-3 sm:gap-4 border-b border-white/5 px-4 sm:px-5 md:px-6 lg:px-8 py-3 sm:py-4 text-left transition-colors hover:bg-white/5 min-h-[44px]"
					on:click={() => (selectedProposal = proposal)}
				>
					<div class="mt-1.5">
						<div class="h-2.5 w-2.5 rounded-full {
							proposal.priority === 'critical' || proposal.priority === 'high' ? 'bg-red-500' :
							proposal.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
						}"></div>
					</div>
					<div class="flex-1 min-w-0">
						<span class="font-medium text-white text-sm sm:text-base truncate block">{proposal.title}</span>
						<div class="mt-1 flex items-center gap-2 text-xs sm:text-sm flex-wrap">
							<StatusBadge label="{proposal.priority}" color={RISK_COLORS[proposal.priority]} />
							<StatusBadge label="{proposal.status}" color={STATUS_COLORS[proposal.status]} />
							<span class="text-slate-500 truncate">{proposal.dept}</span>
						</div>
						<p class="mt-1 text-xs sm:text-sm text-slate-400 line-clamp-2">{proposal.description}</p>
					</div>
					<span class="mt-1 shrink-0 text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">{proposal.createdAt}</span>
				</button>
			{/each}
		{/if}
	</div>
</div>

{#if selectedProposal}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-5 md:p-6" on:click={() => (selectedProposal = null)}>
		<div class="w-full max-w-2xl md:max-w-3xl lg:max-w-4xl" on:click|stopPropagation>
			<ProposalDetail
				proposal={selectedProposal}
				submitting={reviewSubmitting}
				on:approve={(e) => handleReview(e.detail.id, 'approved', e.detail.note)}
				on:reject={(e) => handleReview(e.detail.id, 'rejected', e.detail.note)}
				on:close={() => (selectedProposal = null)}
			/>
		</div>
	</div>
{/if}
