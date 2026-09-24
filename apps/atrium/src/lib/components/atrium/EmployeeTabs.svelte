<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { activeOrgId } from '$lib/stores/atrium';
	import { user } from '$lib/stores';
	import {
		getEmployeeTabs,
		toggleTabVisibility,
		toggleTabPin,
		syncEmployeeTabs,
		type EmployeeTab
	} from '$lib/apis/atrium';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';

	export let conductorCompanyId: string = '';
	export let selectedTabId: string | null = null;

	const dispatch = createEventDispatcher<{
		select: { tab: EmployeeTab };
		chat: { tab: EmployeeTab };
	}>();

	let tabs: EmployeeTab[] = [];
	let loading = false;
	let syncing = false;
	let showHidden = false;

	const DEPT_COLORS: Record<string, string> = {
		ceo: '#6961ff',
		employee: '#20B2AA',
		manager: '#FFB347',
		default: '#888'
	};

	function getDeptColor(role: string): string {
		return DEPT_COLORS[role.toLowerCase()] || DEPT_COLORS.default;
	}

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	function formatLastInteraction(timestamp?: number): string {
		if (!timestamp) return '';
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
	}

	async function loadTabs() {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		const userId = $user?.id;
		if (!authToken || !userId) return;

		loading = true;
		try {
			const response = await getEmployeeTabs(authToken, $activeOrgId, userId, !showHidden);
			tabs = response.tabs;
		} catch (error) {
			console.error('Failed to load employee tabs', error);
		} finally {
			loading = false;
		}
	}

	async function handleSync() {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		const userId = $user?.id;
		if (!authToken || !userId || !conductorCompanyId) return;

		syncing = true;
		try {
			await syncEmployeeTabs(authToken, $activeOrgId, userId, conductorCompanyId);
			await loadTabs();
		} catch (error) {
			console.error('Failed to sync tabs', error);
		} finally {
			syncing = false;
		}
	}

	async function handleToggleVisibility(tab: EmployeeTab) {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		const userId = $user?.id;
		if (!authToken || !userId) return;

		try {
			await toggleTabVisibility(authToken, tab.id, $activeOrgId, userId, !tab.is_visible);
			await loadTabs();
		} catch (error) {
			console.error('Failed to toggle visibility', error);
		}
	}

	async function handleTogglePin(tab: EmployeeTab) {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		const userId = $user?.id;
		if (!authToken || !userId) return;

		try {
			await toggleTabPin(authToken, tab.id, $activeOrgId, userId, !tab.is_pinned);
			await loadTabs();
		} catch (error) {
			console.error('Failed to toggle pin', error);
		}
	}

	function handleSelect(tab: EmployeeTab) {
		selectedTabId = tab.id;
		dispatch('select', { tab });
	}

	function handleChat(tab: EmployeeTab) {
		dispatch('chat', { tab });
	}

	onMount(() => {
		loadTabs();
	});

	$: pinnedTabs = tabs.filter((t) => t.is_pinned);
	$: regularTabs = tabs.filter((t) => !t.is_pinned);
</script>

<div class="flex flex-col h-full bg-[#0f0f13]">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-white/5 px-4 py-3">
		<div class="flex items-center gap-2">
			<MaterialIcon icon="groups" size={20} class="text-[#6961ff]" />
			<h3 class="text-sm font-semibold text-white">Team</h3>
			{#if tabs.length > 0}
				<span class="text-xs text-slate-500">({tabs.length})</span>
			{/if}
		</div>

		<div class="flex items-center gap-1">
			<button
				on:click={() => {
					showHidden = !showHidden;
					loadTabs();
				}}
				class="p-1.5 rounded hover:bg-white/5 transition-colors"
				title={showHidden ? 'Hide hidden tabs' : 'Show hidden tabs'}
			>
				<MaterialIcon
					icon={showHidden ? 'visibility' : 'visibility_off'}
					size={16}
					class="text-slate-400"
				/>
			</button>
			<button
				on:click={handleSync}
				disabled={syncing || !conductorCompanyId}
				class="p-1.5 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
				title="Sync from Conductor"
			>
				<MaterialIcon
					icon="sync"
					size={16}
					class={`text-slate-400 ${syncing ? 'animate-spin' : ''}`}
				/>
			</button>
		</div>
	</div>

	<!-- Tab List -->
	<div class="flex-1 overflow-y-auto py-2">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
			</div>
		{:else if tabs.length === 0}
			<div class="flex flex-col items-center justify-center py-8 px-4 text-center">
				<MaterialIcon icon="person_off" size={32} class="text-slate-600 mb-2" />
				<p class="text-sm text-slate-400">No team members yet</p>
				{#if conductorCompanyId}
					<button
						on:click={handleSync}
						class="mt-2 text-xs text-[#6961ff] hover:underline"
					>
						Sync from Conductor
					</button>
				{/if}
			</div>
		{:else}
			<!-- Pinned Tabs -->
			{#if pinnedTabs.length > 0}
				<div class="px-2 mb-2">
					<p class="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1">Pinned</p>
					{#each pinnedTabs as tab}
						<button
							class="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors {selectedTabId === tab.id
								? 'bg-[#6961ff]/20'
								: 'hover:bg-white/5'} {!tab.is_visible ? 'opacity-50' : ''}"
							on:click={() => handleSelect(tab)}
						>
							<!-- Avatar -->
							<div
								class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
								style="background-color: {getDeptColor(tab.department)}20; color: {getDeptColor(tab.department)}"
							>
								{#if tab.agent_icon}
									<span>{tab.agent_icon}</span>
								{:else}
									{getInitials(tab.agent_name)}
								{/if}
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0 text-left">
								<div class="flex items-center gap-1">
									<span class="text-sm font-medium text-white truncate">{tab.agent_name}</span>
									{#if tab.is_pinned}
										<MaterialIcon icon="push_pin" size={12} class="text-[#6961ff] shrink-0" />
									{/if}
								</div>
								<p class="text-xs text-slate-500 truncate capitalize">{tab.department}</p>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100">
								<button
									on:click|stopPropagation={() => handleChat(tab)}
									class="p-1 rounded hover:bg-white/10"
									title="Chat"
								>
									<MaterialIcon icon="chat" size={14} class="text-slate-400" />
								</button>
							</div>
						</button>
					{/each}
				</div>
			{/if}

			<!-- Regular Tabs -->
			{#if regularTabs.length > 0}
				<div class="px-2">
					{#if pinnedTabs.length > 0}
						<p class="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1">Team</p>
					{/if}
					{#each regularTabs as tab}
						<button
							class="group w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors {selectedTabId === tab.id
								? 'bg-[#6961ff]/20'
								: 'hover:bg-white/5'} {!tab.is_visible ? 'opacity-50' : ''}"
							on:click={() => handleSelect(tab)}
						>
							<!-- Avatar -->
							<div
								class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
								style="background-color: {getDeptColor(tab.department)}20; color: {getDeptColor(tab.department)}"
							>
								{#if tab.agent_icon}
									<span>{tab.agent_icon}</span>
								{:else}
									{getInitials(tab.agent_name)}
								{/if}
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0 text-left">
								<div class="flex items-center gap-1">
									<span class="text-sm font-medium text-white truncate">{tab.agent_name}</span>
									{#if (tab.message_count ?? 0) > 0}
										<span class="text-[10px] text-slate-500">
											{formatLastInteraction(tab.last_interaction_at)}
										</span>
									{/if}
								</div>
								<p class="text-xs text-slate-500 truncate capitalize">{tab.department}</p>
							</div>

							<!-- Actions (show on hover) -->
							<div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
								<button
									on:click|stopPropagation={() => handleTogglePin(tab)}
									class="p-1 rounded hover:bg-white/10"
									title={tab.is_pinned ? 'Unpin' : 'Pin'}
								>
									<MaterialIcon
										icon="push_pin"
										size={14}
										class={tab.is_pinned ? 'text-[#6961ff]' : 'text-slate-400'}
									/>
								</button>
								<button
									on:click|stopPropagation={() => handleToggleVisibility(tab)}
									class="p-1 rounded hover:bg-white/10"
									title={tab.is_visible ? 'Hide' : 'Show'}
								>
									<MaterialIcon
										icon={tab.is_visible ? 'visibility_off' : 'visibility'}
										size={14}
										class="text-slate-400"
									/>
								</button>
								<button
									on:click|stopPropagation={() => handleChat(tab)}
									class="p-1 rounded hover:bg-white/10"
									title="Chat"
								>
									<MaterialIcon icon="chat" size={14} class="text-slate-400" />
								</button>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
