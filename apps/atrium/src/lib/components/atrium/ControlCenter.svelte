<script lang="ts">
	import { departments, activeDeptId, pendingProposals, notifications, unreadCount } from '$lib/stores/atrium';
	import GlassPanel from '$lib/components/atrium/shared/GlassPanel.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';

	let voiceActive = true;
	let darkMode = true;
	let modelTier: 'local' | 'cloud' | 'premium' = 'premium';
	let speedValue = 75;

	const DEPT_ICONS: Record<string, { icon: string; gradient: string }> = {
		sales:      { icon: 'trending_up',     gradient: 'from-emerald-500 to-teal-600' },
		customer:   { icon: 'support_agent',   gradient: 'from-pink-400 to-pink-600' },
		backoffice: { icon: 'inventory_2',     gradient: 'from-orange-500 to-red-500' },
	};
</script>

<div class="w-full h-full flex items-center justify-center p-3 sm:p-6 md:p-8 lg:p-10 overflow-y-auto">
	<GlassPanel blur={24} class="p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col gap-4 sm:gap-6 md:gap-7 lg:gap-8 w-full max-w-[480px] md:max-w-[560px] lg:max-w-[680px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
		<!-- Header -->
		<div class="flex items-center justify-between px-1 sm:px-2 md:px-3">
			<div class="flex items-center gap-2 sm:gap-3 md:gap-4">
				<div class="h-8 w-8 sm:h-10 sm:w-10 md:h-11 md:w-11 lg:h-12 lg:w-12 rounded-lg sm:rounded-xl md:rounded-2xl bg-[#6961ff] flex items-center justify-center shadow-lg shadow-[#6961ff]/30">
					<MaterialIcon icon="grid_view" size={22} class="text-white" />
				</div>
				<div>
					<h1 class="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold tracking-tight text-white">Control Center</h1>
					<p class="text-[10px] sm:text-xs md:text-sm text-slate-400 font-medium tracking-wide uppercase">Atrium <span class="text-[#6961ff]">v2.4</span></p>
				</div>
			</div>
			<div class="h-8 w-8 sm:h-10 sm:w-10 md:h-11 md:w-11 lg:h-12 lg:w-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors border border-white/5">
				<MaterialIcon icon="settings" size={20} class="text-white" />
			</div>
		</div>

		<!-- Toggles -->
		<div class="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
			<button class="group widget-glass rounded-xl sm:rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col items-start justify-between h-28 sm:h-32 md:h-36 lg:h-40 relative overflow-hidden">
				<div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
				<div class="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-[#6961ff]/20 flex items-center justify-center text-[#6961ff]">
					<MaterialIcon icon="mic" size={22} />
				</div>
				<div>
					<p class="text-[10px] sm:text-xs md:text-sm text-slate-400 font-medium mb-0.5">Input</p>
					<p class="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-white">Voice Mode</p>
					<p class="text-[10px] text-emerald-400 font-medium mt-0.5">Listening...</p>
				</div>
			</button>
			<button class="group bg-slate-800/80 border border-slate-700 rounded-xl sm:rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col items-start justify-between h-28 sm:h-32 md:h-36 lg:h-40 hover:bg-slate-800 transition-colors">
				<div class="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white/10 flex items-center justify-center text-white">
					<MaterialIcon icon="dark_mode" size={22} />
				</div>
				<div>
					<p class="text-[10px] sm:text-xs md:text-sm text-slate-400 font-medium mb-0.5">Theme</p>
					<p class="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-white">Dark Mode</p>
					<p class="text-[10px] text-slate-400 font-medium mt-0.5">On</p>
				</div>
			</button>
		</div>

		<!-- Model Tier -->
		<div class="widget-glass rounded-xl sm:rounded-2xl md:rounded-3xl p-1 sm:p-1.5 md:p-2 lg:p-2.5 flex items-center relative">
			{#each ['local', 'cloud', 'premium'] as tier}
				<label class="flex-1 relative z-10 cursor-pointer text-center">
					<input class="peer sr-only" type="radio" name="model_tier" value={tier} bind:group={modelTier} />
					<span class="block py-2 sm:py-2.5 md:py-3 text-[10px] sm:text-xs md:text-sm font-medium text-slate-400 peer-checked:text-white transition-colors capitalize">{tier}</span>
					<div class="absolute inset-0 rounded-lg sm:rounded-xl {modelTier === tier ? (tier === 'premium' ? 'bg-[#6961ff] shadow-lg shadow-[#6961ff]/25' : 'bg-slate-700/50') : ''} -z-10 transition-all"></div>
				</label>
			{/each}
		</div>

		<!-- Departments (from store) -->
		<div class="flex flex-col gap-2 md:gap-3">
			<p class="px-1 sm:px-2 md:px-3 text-[10px] sm:text-xs md:text-sm font-medium text-slate-400 uppercase tracking-wider">Active Workspace</p>
			<div class="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
				{#each $departments as dept}
					{@const icons = DEPT_ICONS[dept.id] ?? { icon: 'domain', gradient: 'from-slate-500 to-slate-700' }}
					<button
						class="widget-glass rounded-lg sm:rounded-xl md:rounded-2xl p-2.5 sm:p-3 md:p-4 lg:p-5 flex items-center gap-2 sm:gap-3 md:gap-4 border transition-all
							{$activeDeptId === dept.id ? 'border-[#6961ff] bg-[#6961ff]/10' : 'border-transparent opacity-60 hover:opacity-100'}"
						on:click={() => ($activeDeptId = dept.id)}
					>
						<div class="h-7 w-7 sm:h-8 sm:w-8 rounded-md sm:rounded-lg bg-gradient-to-br {icons.gradient} flex items-center justify-center shadow-inner">
							<MaterialIcon icon={icons.icon} size={16} class="text-white" />
						</div>
						<span class="text-xs sm:text-sm md:text-base font-medium text-white">{dept.name}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Stats (from stores) -->
		<div class="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
			<div class="widget-glass rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col gap-1 relative overflow-hidden group">
				<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-[#6961ff]/10 rounded-full blur-2xl group-hover:bg-[#6961ff]/20 transition-colors"></div>
				<div class="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
					<div class="p-1 sm:p-1.5 rounded-md bg-white/5">
						<MaterialIcon icon="pending_actions" size={17} class="text-[#6961ff]" />
					</div>
					<span class="text-[10px] sm:text-xs font-medium text-slate-300">Pending</span>
				</div>
				<div class="flex items-baseline gap-1.5 sm:gap-2">
					<span class="text-xl sm:text-2xl font-bold text-white tracking-tight">{$pendingProposals.length}</span>
					{#if $pendingProposals.filter(p => p.priority === 'high' || p.priority === 'critical').length > 0}
						<span class="text-[9px] sm:text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1 sm:px-1.5 py-0.5 rounded">
							+{$pendingProposals.filter(p => p.priority === 'high' || p.priority === 'critical').length} urgent
						</span>
					{/if}
				</div>
			</div>
			<div class="widget-glass rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col gap-1 relative overflow-hidden group">
				<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
				<div class="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
					<div class="p-1 sm:p-1.5 rounded-md bg-white/5">
						<MaterialIcon icon="notifications" size={17} class="text-blue-400" />
					</div>
					<span class="text-[10px] sm:text-xs font-medium text-slate-300">Unread</span>
				</div>
				<div class="flex items-baseline gap-1.5 sm:gap-2">
					<span class="text-xl sm:text-2xl font-bold text-white tracking-tight">{$unreadCount}</span>
				</div>
			</div>
		</div>

		<!-- Slider -->
		<div class="widget-glass rounded-lg sm:rounded-xl md:rounded-2xl p-2.5 sm:p-3 md:p-4 lg:p-5 flex items-center gap-2 sm:gap-3 md:gap-4">
			<MaterialIcon icon="speed" size={20} class="text-slate-400" />
			<input type="range" min="0" max="100" bind:value={speedValue} class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
		</div>
	</GlassPanel>
</div>

<style>
	.widget-glass {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.05);
		transition: all 0.2s ease;
	}
	.widget-glass:hover {
		background: rgba(255, 255, 255, 0.07);
		transform: translateY(-2px);
	}
</style>
