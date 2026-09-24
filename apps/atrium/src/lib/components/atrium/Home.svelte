<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores';
	import { activeOrgId } from '$lib/stores/atrium';
	import { getConductorPendingCount, getDepartments, getProposals, getProposalStats, type Department as ApiDepartment } from '$lib/apis/atrium';
	import AppIcon from '$lib/components/atrium/shared/AppIcon.svelte';
	import GlassPanel from '$lib/components/atrium/shared/GlassPanel.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';

	let searchQuery = '';
	let showSpotlight = true;
	let isLoading = false;
	let apiDepartments: ApiDepartment[] = [];
	let proposalTotal = 0;
	let pendingTotal = 0;

	let apps = [
		{ label: 'Chat', icon: 'chat_bubble', gradient: 'from-green-400 to-emerald-600', href: '/atrium/chat', badge: 0 },
		{ label: 'Dashboard', icon: 'dashboard', gradient: 'from-blue-500 to-indigo-600', href: '/atrium/analytics' },
		{ label: 'Proposals', icon: 'description', gradient: 'from-orange-400 to-red-500', href: '/atrium/proposals', badge: 0 },
		{ label: 'Conductor Approvals', icon: 'approval', gradient: 'from-teal-400 to-emerald-600', href: '/atrium/conductor-approvals', badge: 0 },
		{ label: 'Departments', icon: 'domain', gradient: 'from-purple-500 to-pink-600', href: '/atrium/departments', badge: 0 },
		{ label: 'Voice', icon: 'graphic_eq', gradient: 'from-cyan-400 to-blue-500', href: '/atrium/voice' },
		{ label: 'Knowledge', icon: 'school', gradient: 'from-yellow-400 to-orange-500', href: '/atrium/knowledge', badge: 1 },
		{ label: 'Settings', icon: 'settings', gradient: 'from-slate-500 to-slate-700', href: '/atrium/settings' },
		{ label: 'Analytics', icon: 'monitoring', gradient: 'from-fuchsia-500 to-purple-600', href: '/atrium/analytics' },
	];

	interface SearchResult {
		title: string;
		subtitle: string;
		icon: string;
		gradient: string;
		tag: string;
		tagColor: string;
	}

	async function loadHomeData() {
		const token = ($user as { token?: string } | undefined)?.token;
		if (!token) return;

		isLoading = true;
		try {
			const [departmentsResponse, proposalStats, proposalsResponse, conductorPendingResponse] = await Promise.all([
				getDepartments(token, $activeOrgId),
				getProposalStats(token, $activeOrgId),
				getProposals(token, $activeOrgId, { limit: 3 }),
				getConductorPendingCount(token, $activeOrgId).catch(() => ({ count: 0 }))
			]);

			apiDepartments = departmentsResponse.departments;
			proposalTotal = proposalStats.total;
			pendingTotal = proposalStats.pending;

			const proposalsApp = apps.find((app) => app.label === 'Proposals');
			const departmentsApp = apps.find((app) => app.label === 'Departments');
			const chatApp = apps.find((app) => app.label === 'Chat');
			const conductorApprovalsApp = apps.find((app) => app.label === 'Conductor Approvals');

			if (proposalsApp) proposalsApp.badge = pendingTotal;
			if (departmentsApp) departmentsApp.badge = apiDepartments.length;
			if (chatApp) chatApp.badge = Math.min(proposalsResponse.total, 9);
			if (conductorApprovalsApp) conductorApprovalsApp.badge = conductorPendingResponse.count;
			apps = [...apps];
		} catch (error) {
			console.error('Failed to load Atrium home data:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadHomeData();
	});

	$: searchResults = [
		{
			title: `${proposalTotal} Total Proposals`,
			subtitle: pendingTotal > 0 ? `${pendingTotal} require review` : 'No pending approvals',
			icon: 'description',
			gradient: 'from-orange-400 to-red-500',
			tag: 'Proposals',
			tagColor: 'orange'
		},
		{
			title: `${apiDepartments.length} Departments Connected`,
			subtitle: apiDepartments.map((d) => d.name).slice(0, 2).join(' • ') || 'No departments found',
			icon: 'domain',
			gradient: 'from-purple-500 to-pink-600',
			tag: 'Departments',
			tagColor: 'pink'
		},
		{
			title: isLoading ? 'Syncing workspace data...' : 'Analytics Overview Ready',
			subtitle: 'Live data connected from Atrium API',
			icon: 'monitoring',
			gradient: 'from-fuchsia-500 to-purple-600',
			tag: 'Analytics',
			tagColor: 'purple'
		}
	] as SearchResult[];

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') showSpotlight = false;
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="relative w-full h-full overflow-hidden flex flex-col bg-gradient-to-br from-[#1A1A2E] to-[#2D2B55]">
	<div class="flex-1 relative p-8 md:p-12 overflow-y-auto {showSpotlight ? 'blur-sm brightness-75 pointer-events-none' : ''}">
		<div class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-6 gap-y-10 max-w-7xl mx-auto">
			{#each apps as app}
				<AppIcon label={app.label} icon={app.icon} gradient={app.gradient} href={app.href} badge={app.badge} />
			{/each}
		</div>
	</div>

	<div class="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
		<GlassPanel class="px-4 py-3 flex items-end gap-3 md:gap-4 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.4)] transition-all duration-300 hover:scale-[1.02]">
			{#each apps.slice(0, 3) as app}
				<button class="relative group cursor-pointer" on:click={() => goto(app.href)}>
					<div class="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br {app.gradient} rounded-xl flex items-center justify-center text-white shadow-lg transition-transform duration-200 group-hover:-translate-y-3 group-hover:scale-110">
						<MaterialIcon icon={app.icon} />
					</div>
				</button>
			{/each}
			<div class="w-px h-10 bg-white/10 mx-1"></div>
			<button class="relative group cursor-pointer" on:click={() => goto('/atrium/settings')}>
				<div class="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-slate-500 to-slate-700 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform duration-200 group-hover:-translate-y-3 group-hover:scale-110">
					<MaterialIcon icon="settings" />
				</div>
			</button>
		</GlassPanel>
	</div>

	{#if showSpotlight}
		<div class="absolute inset-0 z-[100] flex items-start justify-center pt-[20vh]">
			<div class="w-full max-w-2xl px-6 flex flex-col gap-4">
				<GlassPanel blur={40} opacity={0.75} borderOpacity={0.15} class="p-1 flex items-center gap-3 h-16 relative ring-1 ring-white/20">
					<div class="pl-5 text-slate-400">
						<MaterialIcon icon="search" size={28} />
					</div>
					<div class="flex-1 flex items-center">
						<input bind:value={searchQuery} class="w-full bg-transparent border-none text-2xl font-light text-slate-100 tracking-wide focus:outline-none focus:ring-0 placeholder-slate-500" placeholder="Search Atrium..." />
					</div>
					<button class="pr-4" on:click={() => (showSpotlight = false)}>
						<span class="px-2 py-1 text-xs font-medium text-slate-400 bg-white/5 rounded border border-white/5">ESC</span>
					</button>
				</GlassPanel>
				<GlassPanel blur={40} opacity={0.75} borderOpacity={0.15} class="overflow-hidden flex flex-col ring-1 ring-white/10">
					{#each searchResults as result, i}
						<button class="group flex items-center gap-4 p-3 hover:bg-white/10 cursor-pointer transition-colors {i < searchResults.length - 1 ? 'border-b border-white/5' : ''} {i === 0 ? 'bg-white/5' : ''}">
							<div class="w-10 h-10 rounded-lg bg-gradient-to-br {result.gradient} flex items-center justify-center shadow-lg">
								<MaterialIcon icon={result.icon} size={20} class="text-white" />
							</div>
							<div class="flex-1 min-w-0 text-left">
								<h3 class="text-base font-medium text-white group-hover:text-blue-100 truncate">{result.title}</h3>
								<p class="text-xs text-slate-400 truncate">{result.subtitle}</p>
							</div>
							<StatusBadge label={result.tag} color={result.tagColor} size="md" class="rounded-full" />
						</button>
					{/each}
				</GlassPanel>
			</div>
		</div>
	{/if}
</div>
