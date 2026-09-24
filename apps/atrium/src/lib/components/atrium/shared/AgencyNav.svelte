<script lang="ts">
	import { page } from '$app/stores';
	import { navItems, toolItems } from './DesignTokens';

	export let collapsed = false;
	export let onToggle: (() => void) | undefined = undefined;
	export let onNavigate: (() => void) | undefined = undefined;

	$: currentPath = $page.url.pathname;

	// Force Svelte to re-evaluate nav items when path changes
	$: activeHref =
		navItems.find((item) => {
			if (item.href === '/atrium') return currentPath === '/atrium';
			return currentPath.startsWith(item.href);
		})?.href ?? '';

	$: activeToolHref =
		toolItems.find((item) => {
			if (item.href === '/') return currentPath === '/';
			return currentPath.startsWith(item.href);
		})?.href ?? '';
</script>

<aside
	class="agency-nav flex flex-col h-full {collapsed
		? 'w-0 -translate-x-full'
		: 'w-72'} transition-all duration-300 overflow-hidden"
>
	<!-- Logo / Branding -->
	<div class="p-6 flex items-center gap-3 shrink-0">
		<div
			class="w-10 h-10 rounded-xl bg-[#6961ff] flex items-center justify-center shadow-lg shadow-[#6961ff]/20"
		>
			<span class="material-symbols-outlined text-white text-2xl">auto_awesome</span>
		</div>
		<div>
			<h1 class="font-bold text-lg tracking-tight text-white">Atrium</h1>
			<p class="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Neural Workspace</p>
		</div>
		{#if onToggle}
			<button
				class="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-slate-400 lg:hidden"
				on:click={onToggle}
			>
				<span class="material-symbols-outlined">close</span>
			</button>
		{/if}
	</div>

	<!-- Navigation Items -->
	<nav class="flex-1 px-3 py-2 overflow-y-auto">
		<div class="space-y-1">
			{#each navItems as item}
				<a
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group
						{activeHref === item.href
						? 'bg-[#6961ff]/10 text-[#6961ff] border border-[#6961ff]/20'
						: 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}"
					href={item.href}
					on:click={() => onNavigate?.()}
				>
					<span class="material-symbols-outlined text-[20px]">{item.icon}</span>
					<span class="text-sm font-medium">{item.label}</span>
					{#if item.badge}
						<span
							class="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"
						>
							{item.badge}
						</span>
					{/if}
				</a>
			{/each}
		</div>

		<!-- Tools & Features (from OpenWebUI) -->
		<div class="mt-4 pt-4 border-t border-white/5 space-y-1">
			<p class="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tools</p>
			{#each toolItems as item}
				<a
					class="flex items-center gap-3 px-3 py-2 rounded-lg transition-all border
						{activeToolHref === item.href
						? 'bg-[#6961ff]/10 text-[#6961ff] border-[#6961ff]/20'
						: 'text-slate-400 hover:bg-white/5 hover:text-white border-transparent'}"
					href={item.href}
					on:click={() => onNavigate?.()}
				>
					<span class="material-symbols-outlined text-[20px]">{item.icon}</span>
					<span class="text-sm font-medium">{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>

	<!-- User Profile -->
	<div class="p-4 border-t border-white/5 shrink-0">
		<div class="flex items-center gap-3 p-2 rounded-xl bg-white/5">
			<div
				class="size-9 rounded-full bg-gradient-to-tr from-[#6961ff] to-[#20B2AA] flex items-center justify-center font-bold text-xs text-white shrink-0"
			>
				AO
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-semibold truncate text-slate-100">Admin</p>
				<p class="text-xs text-slate-500 truncate">Organization Owner</p>
			</div>
			<span
				class="material-symbols-outlined text-slate-500 cursor-pointer hover:text-white transition-colors text-[20px]"
				>logout</span
			>
		</div>
	</div>
</aside>

<style>
	.agency-nav {
		background: rgba(15, 15, 20, 0.85);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}
</style>
