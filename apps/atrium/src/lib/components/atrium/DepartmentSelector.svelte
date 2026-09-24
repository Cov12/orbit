<script lang="ts">
	import { onMount } from 'svelte';
	import { activeDeptId } from '$lib/stores/atrium';

	// #45 collapse: Atrium is a thin front door to the single Orbit Assistant
	// (Conductor bridge). There is no longer a department picker — every chat turn
	// flows to the one assistant via the `chief` route. This component is now a
	// static brand identity rather than a selector. The `departments` store is
	// untouched and still backs the dashboards (DeptConfig / ControlCenter / Home).
	onMount(() => {
		$activeDeptId = 'chief';
	});
</script>

<div
	class="flex items-center gap-2 sm:gap-2.5 rounded-xl px-3 sm:px-3.5 md:px-4 py-2.5 md:py-3 text-sm md:text-base font-medium select-none"
>
	<span class="text-lg md:text-xl">🧠</span>
	<span class="truncate text-white">Orbit Assistant</span>
</div>
