<!--
	OrganizationWidget — Example Dashboard (D1) widget.
	Read-only summary of the active organization. Data is supplied by the
	registry `load()` fn (getOrganization) and passed in via the `data` prop.
-->
<script lang="ts">
	import type { Organization } from '$lib/apis/atrium';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';

	export let data: Organization | null = null;
</script>

{#if data}
	<div class="flex flex-col gap-3">
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				<p class="text-lg font-semibold text-white truncate">{data.name}</p>
				<p class="text-xs text-slate-500 truncate">{data.slug}</p>
			</div>
			{#if data.plan}
				<StatusBadge label={data.plan} color="purple" size="md" class="capitalize shrink-0" />
			{/if}
		</div>
		<div class="flex items-center gap-2 text-xs text-slate-400">
			<span class="material-symbols-outlined text-[16px] text-[#6961ff]">badge</span>
			<span class="font-mono truncate">{data.id}</span>
		</div>
	</div>
{:else}
	<p class="text-sm text-slate-500">No organization data.</p>
{/if}
