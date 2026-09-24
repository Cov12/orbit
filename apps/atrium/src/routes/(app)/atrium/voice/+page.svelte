<script lang="ts">
	import { onMount } from 'svelte';
	import VoiceMode from '$lib/components/atrium/VoiceMode.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import { user } from '$lib/stores';
	import {
		activeDeptId,
		activeDept,
		activeOrg,
		activeOrgId,
		departments
	} from '$lib/stores/atrium';
	import {
		getEmployeeTabs,
		getOrgSubAccounts,
		type EmployeeTab,
		type OrgSubAccount
	} from '$lib/apis/atrium';

	let employeeTabs: EmployeeTab[] = [];
	let selectedEmployee: EmployeeTab | null = null;
	let loadingTabs = false;
	let selectorOpen = false;
	let subAccounts: OrgSubAccount[] = [];
	let activeSubAccountId: string | null = null;

	// Dynamic targets: Chief + departments + employees
	$: targets = [
		{ id: 'chief', name: 'Chief AI', type: 'chief' as const, icon: 'psychology' },
		...$departments.map((d) => ({
			id: d.id,
			name: d.name,
			type: 'department' as const,
			icon: d.icon
		})),
		...employeeTabs.filter((t) => t.is_visible).map((t) => ({
			id: t.id,
			name: t.agent_name,
			type: 'employee' as const,
			icon: t.agent_icon,
			department: t.department,
			tab: t
		}))
	];

	// Which CLIENT (sub-account) the user is scoped to; null = business scope.
	$: activeSubAccountName = subAccounts.find((s) => s.id === activeSubAccountId)?.name ?? null;
	$: scopeDisplayName = activeSubAccountName ?? $activeOrg?.name ?? 'Business';
	$: currentTargetName =
		activeSubAccountName ?? selectedEmployee?.agent_name ?? $activeDept?.name ?? 'Chief AI';

	onMount(async () => {
		await Promise.all([loadEmployeeTabs(), loadSubAccounts()]);
	});

	async function loadSubAccounts() {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		if (!authToken || !$activeOrgId) return;

		try {
			const response = await getOrgSubAccounts(authToken, $activeOrgId);
			subAccounts = response.subAccounts;
			activeSubAccountId = response.activeSubAccountId;
		} catch (error) {
			console.error('Failed to load sub-accounts', error);
		}
	}

	async function loadEmployeeTabs() {
		const authToken = (($user as { token?: string } | undefined)?.token ?? localStorage.token) as string | undefined;
		const userId = $user?.id;
		if (!authToken || !userId || !$activeOrgId) return;

		loadingTabs = true;
		try {
			const response = await getEmployeeTabs(authToken, $activeOrgId, userId, true);
			employeeTabs = response.tabs;
		} catch (error) {
			console.error('Failed to load employee tabs', error);
		} finally {
			loadingTabs = false;
		}
	}

	function selectTarget(target: typeof targets[0]) {
		if (target.type === 'employee' && 'tab' in target) {
			selectedEmployee = target.tab as EmployeeTab;
			// Also set the department context for routing
			$activeDeptId = target.department ?? 'chief';
		} else {
			selectedEmployee = null;
			$activeDeptId = target.id;
		}
		selectorOpen = false;
	}

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<!-- Target Selector (floating at top) -->
<div class="fixed top-4 left-1/2 -translate-x-1/2 z-[60]">
	<div class="relative">
		<button
			class="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1c1c21]/90 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all shadow-lg"
			on:click={() => (selectorOpen = !selectorOpen)}
		>
			<span class="text-sm text-white/60">Talking to:</span>
			<span class="text-sm font-medium text-white">{currentTargetName}</span>
			<MaterialIcon icon={selectorOpen ? 'expand_less' : 'expand_more'} size={18} class="text-white/50" />
		</button>

		{#if selectorOpen}
			<div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl bg-[#1c1c21]/95 backdrop-blur-md border border-white/10 shadow-2xl">
				{#if loadingTabs}
					<div class="flex items-center justify-center py-6">
						<div class="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
					</div>
				{:else}
					<!-- Chief & Departments -->
					<div class="p-2 border-b border-white/5">
						<p class="px-2 py-1 text-[10px] font-bold text-white/40 uppercase tracking-wider">Departments</p>
						{#each targets.filter((t) => t.type === 'chief' || t.type === 'department') as target}
							<button
								class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
									{($activeDeptId === target.id && !selectedEmployee) ? 'bg-[#6961ff]/20 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}"
								on:click={() => selectTarget(target)}
							>
								<div class="w-8 h-8 rounded-lg bg-[#6961ff]/20 flex items-center justify-center">
									<MaterialIcon icon={target.icon} size={18} class="text-[#6961ff]" />
								</div>
								<span class="text-sm font-medium">{target.name}</span>
								{#if $activeDeptId === target.id && !selectedEmployee}
									<MaterialIcon icon="check" size={16} class="ml-auto text-[#6961ff]" />
								{/if}
							</button>
						{/each}
					</div>

					<!-- Employees -->
					{#if targets.some((t) => t.type === 'employee')}
						<div class="p-2">
							<p class="px-2 py-1 text-[10px] font-bold text-white/40 uppercase tracking-wider">Team Members</p>
							{#each targets.filter((t) => t.type === 'employee') as target}
								<button
									class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
										{selectedEmployee?.id === target.id ? 'bg-[#20B2AA]/20 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}"
									on:click={() => selectTarget(target)}
								>
									<div class="w-8 h-8 rounded-lg bg-[#20B2AA]/20 flex items-center justify-center text-xs font-bold text-[#20B2AA]">
										{#if target.icon}
											<span class="text-base">{target.icon}</span>
										{:else}
											{getInitials(target.name)}
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<span class="text-sm font-medium block truncate">{target.name}</span>
										{#if 'department' in target && target.department}
											<span class="text-xs text-white/40 capitalize">{target.department}</span>
										{/if}
									</div>
									{#if selectedEmployee?.id === target.id}
										<MaterialIcon icon="check" size={16} class="text-[#20B2AA]" />
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Click outside to close selector -->
{#if selectorOpen}
	<button
		class="fixed inset-0 z-[55]"
		on:click={() => (selectorOpen = false)}
		aria-label="Close selector"
	></button>
{/if}

<VoiceMode {selectedEmployee} subAccountName={scopeDisplayName} />
