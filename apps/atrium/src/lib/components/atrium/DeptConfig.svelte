<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { departments, activeDeptId, activeDept, activeOrgId } from '$lib/stores/atrium';
	import { user } from '$lib/stores';
	import { getDepartments, getDepartment } from '$lib/apis/atrium';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';

	let sidebarOpen = false;
	let activeTab = 'overview';
	let autoPropose = 85;
	let requireApproval = 60;
	let temperature = 70;
	let selectedModel = 'GPT-4o (Default)';
	let systemPrompt = `You are the lead AI Agent for the Sales & Admin department. Your core directive is to optimize response times for inbound leads while maintaining a 100% professional tone. You have access to the company pricing guide and CRM. When dealing with quotes above $50k, always defer to the department head for final approval.`;
	let isLoading = false;
	let detailLoadedFor: string | null = null;

	const tabs = ['Overview', 'Knowledge Base', 'Tools & Permissions', 'Delegation Rules', 'AI Config'];

	const ACTIVE_STATUS_MAP: Record<string, string> = {
		active: 'animate-pulse',
		setup: 'opacity-40',
	};

	const DEPT_ICON_MAP: Record<string, string> = {
		sales: 'trending_up',
		customer: 'support_agent',
		backoffice: 'business_center'
	};

	const DEPT_GRADIENT_MAP: Record<string, string> = {
		sales: 'from-blue-500 to-indigo-600',
		customer: 'from-green-400 to-emerald-600',
		backoffice: 'from-orange-400 to-red-500'
	};

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	function toUiDepartment(dept: { id: string; slug: string; name: string; description: string; model_tier: string }) {
		const key = dept.slug || dept.id;
		return {
			id: dept.id,
			name: dept.name,
			icon: DEPT_ICON_MAP[key] || 'domain',
			gradient: DEPT_GRADIENT_MAP[key] || 'from-purple-500 to-pink-600',
			description: dept.description,
			status: 'active' as const,
			agentCount: 1,
			role: '',
			model: dept.model_tier
		};
	}

	async function loadDepartmentsAndSelection() {
		const token = ($user as { token?: string } | undefined)?.token;
		if (!token) return;

		isLoading = true;
		try {
			const response = await getDepartments(token, $activeOrgId);
			departments.set(response.departments.map(toUiDepartment));

			if (!get(activeDeptId) && response.departments.length > 0) {
				activeDeptId.set(response.departments[0].id);
			}
		} catch (error) {
			console.error('Failed to load departments for config:', error);
		} finally {
			isLoading = false;
		}
	}

	async function loadActiveDepartmentDetails(departmentId: string | null) {
		const token = ($user as { token?: string } | undefined)?.token;
		if (!token || !departmentId || detailLoadedFor === departmentId) return;

		try {
			const department = await getDepartment(token, departmentId, $activeOrgId);
			systemPrompt = department.system_prompt || systemPrompt;
			detailLoadedFor = departmentId;
		} catch (error) {
			console.error('Failed to load department details:', error);
		}
	}

	onMount(() => {
		loadDepartmentsAndSelection();
	});

	$: currentDeptName = $activeDept?.name ?? 'Select Department';
	$: loadActiveDepartmentDetails($activeDeptId);
</script>

<div class="w-full h-full flex overflow-hidden relative"
	style="background: rgba(28, 28, 33, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05);"
>
	<!-- Mobile Overlay -->
	{#if sidebarOpen}
		<button class="fixed inset-0 bg-black/50 z-30 lg:hidden" on:click={toggleSidebar} aria-label="Close sidebar"></button>
	{/if}

	<!-- Sidebar -->
	<aside
		class="w-72 border-r border-white/5 flex flex-col bg-black/20 shrink-0"
		class:fixed={sidebarOpen}
		class:inset-y-0={sidebarOpen}
		class:left-0={sidebarOpen}
		class:z-40={sidebarOpen}
		class:hidden={!sidebarOpen}
		class:lg:flex={!sidebarOpen}
	>
		<div class="p-4 md:p-6 flex items-center gap-3">
			<div class="w-10 h-10 rounded-xl bg-[#6961ff] flex items-center justify-center shrink-0">
				<MaterialIcon icon="deployed_code" class="text-white" />
			</div>
			<div class="min-w-0">
				<h1 class="font-bold text-lg tracking-tight text-white truncate">Atrium</h1>
				<p class="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Organization OS</p>
			</div>
		</div>

		<nav class="flex-1 px-3 md:px-4 py-2 space-y-1 overflow-y-auto">
			<p class="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Departments</p>
			{#each $departments as dept}
				<button
					class="flex items-center justify-between px-3 py-3 rounded-lg w-full transition-all min-h-[44px] {dept.id === $activeDeptId ? 'bg-[#6961ff]/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}"
					style="border: 1px solid {dept.id === $activeDeptId ? 'rgba(105, 97, 255, 0.2)' : 'transparent'};"
					on:click={() => { $activeDeptId = dept.id; sidebarOpen = false; }}
				>
					<div class="flex items-center gap-3 min-w-0">
						<MaterialIcon icon={dept.icon} class={dept.id === $activeDeptId ? 'text-[#6961ff]' : 'text-slate-500'} size={20} />
						<span class="text-sm font-medium truncate">{dept.name}</span>
					</div>
					<div class="w-2 h-2 rounded-full bg-[#20B2AA] shrink-0 {ACTIVE_STATUS_MAP[dept.status] ?? 'opacity-40'}"></div>
				</button>
			{/each}
		</nav>

		<div class="p-4 border-t border-white/5">
			<button class="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all text-sm min-h-[44px]">
				<MaterialIcon icon="add_circle" size={16} />
				New Department
			</button>
		</div>
	</aside>

	<!-- Main -->
	<main class="flex-1 flex flex-col min-w-0">
		<header class="h-16 md:h-20 border-b border-white/5 flex items-center justify-between px-3 sm:px-4 md:px-8 bg-black/10 shrink-0">
			<div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
				<button on:click={toggleSidebar} class="lg:hidden p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Open sidebar">
					<MaterialIcon icon="menu" />
				</button>
				<div class="min-w-0">
					<h2 class="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight truncate">{currentDeptName}</h2>
					<p class="text-xs md:text-sm text-slate-400 truncate">{isLoading ? 'Loading department configuration...' : 'Configure agents and knowledge'}</p>
				</div>
			</div>
			<div class="flex items-center gap-2 md:gap-4 shrink-0">
				<button class="hidden sm:flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm border border-white/5 min-h-[44px]">
					<MaterialIcon icon="play_circle" size={20} />
					Test Agent
				</button>
				<button class="flex items-center gap-2 px-3 md:px-5 py-2.5 rounded-xl bg-[#6961ff] hover:bg-[#6961ff]/90 text-white font-bold text-sm shadow-lg shadow-[#6961ff]/20 min-h-[44px]">
					<MaterialIcon icon="save" size={20} />
					<span class="hidden sm:inline">Save Changes</span>
				</button>
			</div>
		</header>

		<!-- Tabs -->
		<div class="px-3 sm:px-4 md:px-8 border-b border-white/5 bg-black/5 overflow-x-auto shrink-0 scrollbar-hide">
			<div class="flex gap-1 sm:gap-4 md:gap-8 min-w-max">
				{#each tabs as tab}
					{@const tabId = tab.toLowerCase().replace(/ & | /g, '-')}
					<button
						class="py-3 sm:py-4 px-2 sm:px-1 text-xs sm:text-sm font-semibold transition-colors border-b-2 whitespace-nowrap min-h-[44px]"
						class:text-[#6961ff]={activeTab === tabId}
						class:border-[#6961ff]={activeTab === tabId}
						class:font-bold={activeTab === tabId}
						class:text-slate-400={activeTab !== tabId}
						class:hover:text-slate-200={activeTab !== tabId}
						class:border-transparent={activeTab !== tabId}
						on:click={() => (activeTab = tabId)}
					>
						{tab}
					</button>
				{/each}
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 space-y-5 sm:space-y-6 md:space-y-8">
			<!-- Agent Card -->
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
				<div class="lg:col-span-7 p-4 md:p-6 rounded-2xl bg-white/5 border border-white/5 flex flex-col sm:flex-row items-start gap-4 md:gap-6">
					<div class="relative shrink-0">
						<div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#6961ff] to-purple-600 flex items-center justify-center">
							<MaterialIcon icon="smart_toy" size={36} class="text-white" />
						</div>
						<div class="absolute -bottom-2 -right-2">
							<StatusBadge label={$activeDept?.status === 'active' ? 'Active' : 'Setup'} color={$activeDept?.status === 'active' ? 'green' : 'yellow'} size="md" />
						</div>
					</div>
					<div class="flex-1 min-w-0">
						<h3 class="text-lg sm:text-xl font-bold text-white truncate">Agent Smith</h3>
						<p class="text-slate-400 text-sm truncate">Department Head Agent • Lead Negotiator</p>
						<div class="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-4">
							<div class="px-3 py-1.5 rounded-lg bg-black/30 border border-white/5 flex items-center gap-2">
								<MaterialIcon icon="bolt" size={16} class="text-[#6961ff]" />
								<span class="text-xs font-medium text-white whitespace-nowrap">94% Efficiency</span>
							</div>
							<div class="px-3 py-1.5 rounded-lg bg-black/30 border border-white/5 flex items-center gap-2">
								<MaterialIcon icon="check_circle" size={16} class="text-[#20B2AA]" />
								<span class="text-xs font-medium text-white whitespace-nowrap">1,284 Tasks</span>
							</div>
						</div>
					</div>
				</div>

				<div class="lg:col-span-5 grid grid-cols-2 gap-3 sm:gap-4">
					<div class="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between">
						<span class="text-slate-500 text-xs font-bold uppercase tracking-wider">Uptime</span>
						<div class="mt-2">
							<span class="text-xl sm:text-2xl font-black text-white">99.9%</span>
							<p class="text-[10px] text-[#20B2AA] font-medium mt-1">Status: Stable</p>
						</div>
					</div>
					<div class="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between">
						<span class="text-slate-500 text-xs font-bold uppercase tracking-wider">Avg Response</span>
						<div class="mt-2">
							<span class="text-xl sm:text-2xl font-black text-white">1.4s</span>
							<p class="text-[10px] text-[#6961ff] font-medium mt-1">Fast Processing</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Delegation -->
			<div class="space-y-3 sm:space-y-4">
				<h3 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
					<MaterialIcon icon="rule" class="text-[#6961ff]" />
					Delegation Thresholds
				</h3>
				<div class="p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/5 space-y-6 sm:space-y-8">
					<div class="space-y-3 sm:space-y-4">
						<div class="flex flex-wrap justify-between items-center gap-2">
							<label class="text-sm font-semibold text-slate-200">Auto-propose Threshold</label>
							<span class="text-sm font-bold text-[#6961ff] bg-[#6961ff]/10 px-3 py-1 rounded-full whitespace-nowrap">{autoPropose}% Confidence</span>
						</div>
						<input type="range" bind:value={autoPropose} class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#6961ff]" />
					</div>
					<div class="space-y-3 sm:space-y-4">
						<div class="flex flex-wrap justify-between items-center gap-2">
							<label class="text-sm font-semibold text-slate-200">Require Approval</label>
							<span class="text-sm font-bold text-[#6961ff] bg-[#6961ff]/10 px-3 py-1 rounded-full whitespace-nowrap">{requireApproval}% Confidence</span>
						</div>
						<input type="range" bind:value={requireApproval} class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#6961ff]" />
					</div>
				</div>
			</div>

			<!-- AI Config -->
			<div class="space-y-3 sm:space-y-4">
				<h3 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
					<MaterialIcon icon="psychology" class="text-[#6961ff]" />
					AI Engine Configuration
				</h3>
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
					<div class="lg:col-span-1 space-y-4">
						<div>
							<label class="block text-xs font-bold text-slate-500 uppercase mb-2">Model Selection</label>
							<select bind:value={selectedModel} class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#6961ff] focus:ring-0 text-white min-h-[44px]">
								<option>GPT-4o (Default)</option>
								<option>Claude 3.5 Sonnet</option>
								<option>Llama 3 (Experimental)</option>
							</select>
						</div>
						<div>
							<div class="flex justify-between mb-2">
								<label class="text-xs font-bold text-slate-500 uppercase">Temperature</label>
								<span class="text-xs font-bold text-[#6961ff]">{(temperature / 100).toFixed(1)}</span>
							</div>
							<input type="range" bind:value={temperature} min="0" max="100" class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#6961ff]" />
						</div>
					</div>
					<div class="lg:col-span-2">
						<label class="block text-xs font-bold text-slate-500 uppercase mb-2">System Prompt Preview</label>
						<textarea
							bind:value={systemPrompt}
							class="w-full bg-[#6961ff]/5 border border-white/10 rounded-xl p-4 text-xs font-mono text-slate-400 h-32 focus:ring-0 resize-none leading-relaxed focus:border-[#6961ff]/50"
							spellcheck="false"
						></textarea>
					</div>
				</div>
			</div>
		</div>

		<footer class="h-10 border-t border-white/5 bg-black/20 flex items-center justify-between px-3 sm:px-6 shrink-0">
			<div class="flex items-center gap-4 text-[10px] font-medium text-slate-500">
				<div class="flex items-center gap-1.5">
					<div class="w-1.5 h-1.5 rounded-full bg-[#20B2AA]"></div>
					<span class="hidden sm:inline">Engine: Synchronized</span>
					<span class="sm:hidden">Synced</span>
				</div>
			</div>
			<div class="text-[10px] font-medium text-slate-600">Atrium v2.4.1</div>
		</footer>
	</main>
</div>

<style>
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
