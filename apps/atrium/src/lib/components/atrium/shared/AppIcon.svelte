<!--
	AppIcon — Home screen grid icon with optional badge.
-->
<script lang="ts">
	import { goto } from '$app/navigation';

	/** Display label below icon */
	export let label: string;
	/** Material Symbols icon name */
	export let icon: string;
	/** Tailwind gradient classes, e.g. 'from-green-400 to-emerald-600' */
	export let gradient: string;
	/** Navigation target */
	export let href: string;
	/** Optional notification badge count */
	export let badge: number | undefined = undefined;
</script>

<button
	class="group flex flex-col items-center gap-3 cursor-pointer"
	on:click={() => goto(href)}
>
	<div
		class="relative w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br {gradient} rounded-[1.4rem] flex items-center justify-center text-white shadow-[0_10px_25px_-5px_rgba(0,0,0,0.4)] transform transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-2"
	>
		<span class="material-symbols-outlined text-[40px] md:text-[48px]">{icon}</span>
		{#if badge}
			<div class="absolute -top-1 -right-1 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center border-2 border-[#0f0f13] shadow-lg z-10">
				<span class="text-xs font-bold text-white">{badge}</span>
			</div>
		{/if}
	</div>
	<span class="text-sm font-medium text-white/90 drop-shadow-md tracking-wide">{label}</span>
</button>
