<script lang="ts">
	import { proposals, pendingProposals, type Proposal, activeOrgId } from '$lib/stores/atrium';
	import { user } from '$lib/stores';
	import { getProposals, reviewProposal, type Proposal as ApiProposal } from '$lib/apis/atrium';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';
	import { onMount } from 'svelte';

	let loading = false;
	let reviewLoadingId: string | null = null;


	const PRIORITY_COLORS: Record<string, string> = {
		critical: 'red',
		high: 'red',
		medium: 'yellow',
		low: 'green'
	};

	const PROPOSAL_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
		backoffice: { icon: 'account_balance_wallet', bg: 'bg-indigo-500/10', color: 'text-[#6961ff]' },
		sales: { icon: 'send', bg: 'bg-purple-500/10', color: 'text-purple-500' },
		customer: { icon: 'calendar_month', bg: 'bg-teal-500/10', color: 'text-teal-500' },
		chief: { icon: 'psychology', bg: 'bg-cyan-500/10', color: 'text-cyan-400' }
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

	async function updateProposalStatus(id: string, status: 'approved' | 'rejected') {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		const currentUserId = $user?.id ?? 'unknown';
		if (!authToken) return;
		reviewLoadingId = id;
		try {
			await reviewProposal(authToken, id, $activeOrgId, currentUserId, { status });
			await loadProposals();
		} catch (error) {
			console.error(`Failed to ${status} proposal`, error);
		} finally {
			reviewLoadingId = null;
		}
	}

	function getProposalIcon(dept: string) {
		return PROPOSAL_ICONS[dept] ?? { icon: 'description', bg: 'bg-white/10', color: 'text-white/60' };
	}

	function approveProposal(id: string) {
		updateProposalStatus(id, 'approved');
	}

	function rejectProposal(id: string) {
		updateProposalStatus(id, 'rejected');
	}

	onMount(() => {
		loadProposals();
	});
</script>

<div class="w-full h-full flex overflow-hidden bg-[#0f0f13]">
	<div class="flex-1 flex flex-col h-full min-w-0">
		<!-- Header -->
		<header class="h-14 sm:h-16 md:h-[4.5rem] lg:h-20 border-b border-white/5 flex items-center justify-between px-4 sm:px-8 md:px-10 lg:px-12 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
			<div class="flex items-center gap-3">
				<div class="flex flex-col">
					<h1 class="text-base sm:text-xl md:text-2xl lg:text-[1.9rem] font-bold text-white tracking-tight">Pending Proposals</h1>
					<span class="text-[10px] sm:text-xs md:text-sm text-slate-500">
						{$pendingProposals.length} item{$pendingProposals.length !== 1 ? 's' : ''} require your attention
					</span>
				</div>
			</div>
			<div class="flex items-center gap-1.5 sm:gap-3 md:gap-4">
				<button class="p-1.5 sm:p-2 md:p-2.5 lg:p-3 rounded-lg hover:bg-white/5 text-slate-400 transition-colors">
					<MaterialIcon icon="filter_list" size={22} />
				</button>
				<button class="p-1.5 sm:p-2 md:p-2.5 lg:p-3 rounded-lg hover:bg-white/5 text-slate-400 transition-colors">
					<MaterialIcon icon="sort" size={22} />
				</button>
			</div>
		</header>

		<!-- List Content -->
		<div class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-7 lg:p-10">
			{#if loading}
				<div class="flex items-center justify-center py-12 text-slate-400">
					<div class="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white mr-3"></div>
					Loading proposals...
				</div>
			{:else}
			<div class="space-y-4 sm:space-y-6 md:space-y-7 lg:space-y-8">
				{#each $proposals as proposal}
					<div class="group relative bg-white/5 border border-white/5 rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-7 shadow-sm hover:shadow-md transition-all duration-200 hover:border-white/10 {proposal.status !== 'pending' ? 'opacity-50' : ''}">
						<!-- Risk + Time -->
						<div class="flex flex-wrap items-center gap-2 md:gap-3 mb-3 sm:absolute sm:top-5 sm:right-5 md:top-6 md:right-6 lg:top-7 lg:right-7 sm:mb-0">
							<StatusBadge
								label="{proposal.priority.charAt(0).toUpperCase() + proposal.priority.slice(1)} Risk"
								color={PRIORITY_COLORS[proposal.priority]}
								size="md"
							/>
							<span class="text-xs text-slate-400 font-medium py-1">{proposal.createdAt}</span>
						</div>

						<div class="flex items-start gap-3 sm:gap-4 md:gap-5 lg:gap-6">
							<div class="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-lg sm:rounded-xl md:rounded-2xl {getProposalIcon(proposal.dept).bg} border border-white/10 flex items-center justify-center flex-shrink-0">
								<MaterialIcon icon={getProposalIcon(proposal.dept).icon} size={22} class={getProposalIcon(proposal.dept).color} />
							</div>
							<div class="flex-1 min-w-0 sm:pr-24 md:pr-28 lg:pr-36">
								<h3 class="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white truncate mb-1 md:mb-2">{proposal.title}</h3>
								<p class="text-xs sm:text-sm md:text-base text-slate-500 mb-3 md:mb-4 line-clamp-2">{proposal.description}</p>

								{#if proposal.status === 'pending'}
									<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 md:gap-4 lg:gap-5">
										{#each proposal.actions as action}
											{#if action.type === 'primary'}
												<button
													disabled={reviewLoadingId === proposal.id}
											class="flex items-center justify-center px-4 py-2 md:py-2.5 lg:py-3 bg-[#6961ff] hover:bg-[#5851d8] text-white text-sm md:text-base font-semibold rounded-lg shadow-sm shadow-[#6961ff]/30 transition-all active:scale-95 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
													on:click={() => approveProposal(proposal.id)}
												>
													<MaterialIcon icon="check" size={18} class="mr-2" />
													{action.label}
												</button>
											{:else if action.type === 'danger'}
												<button
													disabled={reviewLoadingId === proposal.id}
											class="flex items-center justify-center px-4 py-2 md:py-2.5 lg:py-3 bg-white/5 border border-white/10 hover:bg-red-500/20 text-slate-300 hover:text-red-400 text-sm md:text-base font-semibold rounded-lg transition-all active:scale-95 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
													on:click={() => rejectProposal(proposal.id)}
												>
													<MaterialIcon icon="close" size={18} class="mr-2" />
													{action.label}
												</button>
											{:else}
												<button class="sm:ml-auto text-slate-400 hover:text-[#6961ff] text-xs font-medium flex items-center justify-center gap-1 transition-colors py-2 sm:py-0">
													{action.label}
													<MaterialIcon icon="arrow_forward" size={14} />
												</button>
											{/if}
										{/each}
									</div>
								{:else}
									<StatusBadge
										label={proposal.status === 'approved' ? 'Approved' : 'Rejected'}
										color={proposal.status === 'approved' ? 'green' : 'red'}
										size="md"
									/>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
			{/if}
		</div>
	</div>
</div>
