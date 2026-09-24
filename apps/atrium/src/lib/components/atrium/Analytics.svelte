<script lang="ts">
	import { onMount } from 'svelte';
	import { departments, proposals, activeOrgId } from '$lib/stores/atrium';
	import { user } from '$lib/stores';
	import { getProposalStats, type ProposalStats } from '$lib/apis/atrium';
	import GlassPanel from '$lib/components/atrium/shared/GlassPanel.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';

	let isLoading = false;
	let stats: ProposalStats = {
		total: 0,
		pending: 0,
		approved: 0,
		rejected: 0,
		executed: 0
	};

	$: activeDepts = $departments.filter((d) => d.status === 'active').length;
	$: successRate = stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : '0.0';

	$: kpis = [
		{ label: 'Total AI Actions', value: String(stats.total || 0), change: `${stats.pending} pending`, icon: 'bolt', iconBg: 'bg-[#6961ff]/10', iconColor: 'text-[#6961ff]' },
		{ label: 'Active Departments', value: String(activeDepts), change: `${activeDepts}/${$departments.length}`, icon: 'domain', iconBg: 'bg-indigo-500/10', iconColor: 'text-indigo-500' },
		{ label: 'Approval Rate', value: `${successRate}%`, change: `${stats.approved} approved`, icon: 'check_circle', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
	];

	const taskDist = [
		{ label: 'Drafting', pct: 45, opacity: '' },
		{ label: 'Research', pct: 32, opacity: '/60' },
		{ label: 'Coding', pct: 23, opacity: '/30' },
	];

	// TODO: Replace placeholder chart/task distribution with API analytics endpoint when available.

	const BAR_CLASSES: Record<string, string> = {
		'': 'bg-[#6961ff]',
		'/60': 'bg-[#6961ff]/60',
		'/30': 'bg-[#6961ff]/30',
	};

	async function loadStats() {
		const token = ($user as { token?: string } | undefined)?.token;
		if (!token) return;

		isLoading = true;
		try {
			stats = await getProposalStats(token, $activeOrgId);
		} catch (error) {
			console.error('Failed to load proposal stats:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadStats();
	});

	$: recentProcesses = $proposals.slice(0, 4).map((p) => ({
		name: `${p.dept} Agent`,
		action: p.title,
		status: p.status === 'approved' ? 'Success' : p.status === 'pending' ? 'Pending' : p.status,
		statusColor: p.status === 'approved' ? 'green' : p.status === 'pending' ? 'yellow' : 'red',
		time: p.createdAt,
	}));
</script>

<div class="w-full h-full overflow-y-auto">
	<div class="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
			<div class="min-w-0">
				<h2 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">Analytics Overview</h2>
				<p class="text-slate-400 mt-1 text-sm sm:text-base">Real-time performance data for your agency agents.</p>
			</div>
			<div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
				<button class="bg-white/5 border border-white/10 px-3 sm:px-4 py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 hover:bg-white/10 transition-colors text-white">
					<MaterialIcon icon="calendar_today" size={18} />
					<span class="hidden sm:inline">Last 30 Days</span>
					<span class="sm:hidden">30d</span>
				</button>
				<button class="bg-[#6961ff] text-white px-3 sm:px-4 py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold shadow-lg shadow-[#6961ff]/20 hover:brightness-110 transition-all whitespace-nowrap" on:click={loadStats}>
					{isLoading ? 'Loading...' : 'Refresh'}
				</button>
			</div>
		</div>

		<!-- KPIs -->
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
			{#each kpis as kpi}
				<GlassPanel class="p-4 sm:p-6" opacity={0.5} borderOpacity={0.1}>
					<div class="flex justify-between items-start mb-3 sm:mb-4">
						<div class="p-2 {kpi.iconBg} rounded-lg">
							<MaterialIcon icon={kpi.icon} class={kpi.iconColor} />
						</div>
						<StatusBadge label={kpi.change} color="green" size="md" />
					</div>
					<p class="text-slate-400 text-xs sm:text-sm font-medium truncate">{kpi.label}</p>
					<h3 class="text-2xl sm:text-3xl font-bold text-white mt-1">{kpi.value}</h3>
				</GlassPanel>
			{/each}
		</div>

		<!-- Charts -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
			<GlassPanel class="lg:col-span-2 p-4 sm:p-6" opacity={0.5} borderOpacity={0.1}>
				<div class="flex justify-between items-center mb-6 sm:mb-8 gap-2">
					<div class="min-w-0">
						<h4 class="text-base sm:text-lg font-bold text-white truncate">AI Activity Over Time</h4>
						<p class="text-xs text-slate-500">Processing volume per weekday</p>
					</div>
					<div class="flex items-center gap-1.5 text-xs font-medium text-slate-500 flex-shrink-0">
						<div class="w-2 h-2 rounded-full bg-[#6961ff]"></div> Activity
					</div>
				</div>
				<div class="w-full relative" style="padding-bottom: 35%; min-height: 180px;">
					<svg class="absolute inset-0 w-full h-full" viewBox="0 0 800 280" preserveAspectRatio="none">
						<defs>
							<linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="#6961ff" stop-opacity="0.2" />
								<stop offset="100%" stop-color="#6961ff" stop-opacity="0" />
							</linearGradient>
						</defs>
						<path d="M0,200 Q100,180 200,220 T400,120 T600,150 T800,50 L800,280 L0,280 Z" fill="url(#chartGradient)" />
						<path d="M0,200 Q100,180 200,220 T400,120 T600,150 T800,50" fill="none" stroke="#6961ff" stroke-width="4" stroke-linecap="round" />
						<circle cx="200" cy="220" r="5" fill="#6961ff" stroke="white" stroke-width="2" />
						<circle cx="400" cy="120" r="5" fill="#6961ff" stroke="white" stroke-width="2" />
						<circle cx="800" cy="50" r="5" fill="#6961ff" stroke="white" stroke-width="2" />
					</svg>
				</div>
				<div class="flex justify-between mt-4 px-1 sm:px-2">
					{#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as day}
						<span class="text-[10px] sm:text-[11px] font-bold text-slate-400">{day}</span>
					{/each}
				</div>
			</GlassPanel>

			<GlassPanel class="p-4 sm:p-6 flex flex-col" opacity={0.5} borderOpacity={0.1}>
				<h4 class="text-base sm:text-lg font-bold text-white mb-1">Task Distribution</h4>
				<p class="text-xs text-slate-500 mb-6 sm:mb-8">Workload volume by type</p>
				<div class="space-y-5 sm:space-y-6 flex-1 flex flex-col justify-center">
					{#each taskDist as task}
						<div>
							<div class="flex justify-between items-center mb-2">
								<span class="text-sm font-medium text-slate-300">{task.label}</span>
								<span class="text-sm font-bold text-white">{task.pct}%</span>
							</div>
							<div class="h-2 w-full bg-white/5 rounded-full overflow-hidden">
								<div class="{BAR_CLASSES[task.opacity]} h-full rounded-full" style="width: {task.pct}%"></div>
							</div>
						</div>
					{/each}
				</div>
				<button class="mt-6 sm:mt-8 w-full py-3 min-h-[44px] rounded-lg border border-white/10 text-xs font-bold text-slate-400 hover:bg-white/5 transition-colors">
					VIEW DETAILED BREAKDOWN
				</button>
			</GlassPanel>
		</div>

		<!-- Recent Processes -->
		<GlassPanel class="mt-6 sm:mt-8 overflow-hidden" opacity={0.5} borderOpacity={0.1}>
			<div class="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center">
				<h4 class="text-base sm:text-lg font-bold text-white">Recent AI Processes</h4>
				<button class="text-[#6961ff] text-xs font-bold min-h-[44px] flex items-center">VIEW ALL</button>
			</div>
			{#if recentProcesses.length === 0}
				<div class="p-6 text-center text-sm text-slate-400">No processes yet.</div>
			{:else}
				<div class="divide-y divide-white/5">
					{#each recentProcesses as proc}
						<div class="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
							<div class="w-10 h-10 rounded-full overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center">
								<MaterialIcon icon="smart_toy" class="text-[#6961ff]" />
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-bold text-white truncate">{proc.name}</p>
								<p class="text-xs text-slate-500 truncate">{proc.action}</p>
							</div>
							<div class="text-right flex-shrink-0">
								<StatusBadge label={proc.status} color={proc.statusColor} />
								<p class="text-[10px] text-slate-500 uppercase mt-1">{proc.time}</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</GlassPanel>
	</div>
</div>
