<script lang="ts">
	import { departments, proposals, pendingProposals } from '$lib/stores/atrium';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';

	const DEPT_ICONS: Record<string, string> = {
		sales: '💼', customer: '🤝', backoffice: '📋',
	};

	const PRIORITY_COLORS: Record<string, string> = {
		low: 'green', medium: 'yellow', high: 'red', critical: 'red',
	};

	const STATUS_COLORS: Record<string, string> = {
		pending: 'yellow', approved: 'green', rejected: 'red', expired: 'purple',
	};

	$: approvedCount = $proposals.filter((p) => p.status === 'approved').length;
	$: rejectedCount = $proposals.filter((p) => p.status === 'rejected').length;
</script>

<div class="mx-auto max-w-5xl space-y-5 sm:space-y-6 md:space-y-7 lg:space-y-8 p-3 sm:p-4 md:p-6 lg:p-8">
	<!-- Org Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 md:gap-5">
		<div class="min-w-0">
			<h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-white truncate">Atrium</h1>
			<p class="text-sm md:text-base text-slate-400">Organization Dashboard</p>
		</div>
		<div class="grid grid-cols-3 gap-3 sm:gap-4 md:gap-5 text-sm">
			<div class="text-center min-h-[44px] flex flex-col justify-center">
				<p class="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-500">{$pendingProposals.length}</p>
				<p class="text-[10px] sm:text-xs md:text-sm text-slate-500">Pending</p>
			</div>
			<div class="text-center min-h-[44px] flex flex-col justify-center">
				<p class="text-xl sm:text-2xl md:text-3xl font-bold text-green-500">{approvedCount}</p>
				<p class="text-[10px] sm:text-xs md:text-sm text-slate-500">Approved</p>
			</div>
			<div class="text-center min-h-[44px] flex flex-col justify-center">
				<p class="text-xl sm:text-2xl md:text-3xl font-bold text-red-500">{rejectedCount}</p>
				<p class="text-[10px] sm:text-xs md:text-sm text-slate-500">Rejected</p>
			</div>
		</div>
	</div>

	<!-- Departments Grid -->
	<div>
		<h2 class="mb-3 md:mb-4 text-base sm:text-lg md:text-xl font-semibold text-white">Departments</h2>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-3">
			{#each $departments as dept}
				<div class="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5 md:p-6 transition-colors hover:border-white/20 min-h-[44px]">
					<div class="flex items-center gap-3 md:gap-4">
						<span class="text-2xl md:text-[1.7rem] shrink-0">{DEPT_ICONS[dept.id] ?? '🏢'}</span>
						<div class="min-w-0">
							<h3 class="font-medium text-white text-sm sm:text-base md:text-lg truncate">{dept.name}</h3>
							<StatusBadge label={dept.status} color={dept.status === 'active' ? 'green' : 'yellow'} />
						</div>
					</div>
					<p class="mt-2 md:mt-3 text-sm md:text-base text-slate-400 line-clamp-2">{dept.description}</p>
					<div class="mt-3 md:mt-4 flex items-center gap-2 text-xs md:text-sm text-slate-500">
						<MaterialIcon icon="smart_toy" size={14} />
						<span>{dept.agentCount} agent{dept.agentCount !== 1 ? 's' : ''}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Recent Proposals -->
	<div>
		<h2 class="mb-3 md:mb-4 text-base sm:text-lg md:text-xl font-semibold text-white">Recent Proposals</h2>
		{#if $proposals.length === 0}
			<p class="text-sm md:text-base text-slate-400">No proposals yet.</p>
		{:else}
			<!-- Mobile: card layout -->
			<div class="sm:hidden space-y-3">
				{#each $proposals.slice(0, 10) as proposal}
					<div class="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
						<div class="flex items-start justify-between gap-2">
							<span class="font-medium text-white text-sm break-words flex-1">{proposal.title}</span>
							<StatusBadge label={proposal.status} color={STATUS_COLORS[proposal.status]} />
						</div>
						<div class="flex items-center gap-2 flex-wrap">
							<StatusBadge label={proposal.priority} color={PRIORITY_COLORS[proposal.priority]} />
							<span class="text-xs text-slate-500">{proposal.createdAt}</span>
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop: table layout -->
			<div class="hidden sm:block overflow-hidden rounded-xl border border-white/10">
				<div class="overflow-x-auto">
					<table class="w-full text-sm md:text-base">
						<thead class="bg-white/5">
							<tr>
								<th class="px-4 md:px-5 py-2.5 md:py-3 text-left font-medium text-slate-400">Proposal</th>
								<th class="px-4 md:px-5 py-2.5 md:py-3 text-left font-medium text-slate-400">Priority</th>
								<th class="px-4 md:px-5 py-2.5 md:py-3 text-left font-medium text-slate-400">Status</th>
								<th class="px-4 md:px-5 py-2.5 md:py-3 text-right font-medium text-slate-400">When</th>
							</tr>
						</thead>
						<tbody>
							{#each $proposals.slice(0, 10) as proposal}
								<tr class="border-t border-white/5 hover:bg-white/5 transition-colors">
									<td class="px-4 md:px-5 py-2.5 md:py-3">
										<span class="font-medium text-white break-words">{proposal.title}</span>
									</td>
									<td class="px-4 md:px-5 py-2.5 md:py-3">
										<StatusBadge label={proposal.priority} color={PRIORITY_COLORS[proposal.priority]} />
									</td>
									<td class="px-4 md:px-5 py-2.5 md:py-3">
										<StatusBadge label={proposal.status} color={STATUS_COLORS[proposal.status]} />
									</td>
									<td class="px-4 md:px-5 py-2.5 md:py-3 text-right text-slate-400 whitespace-nowrap">
										{proposal.createdAt}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
