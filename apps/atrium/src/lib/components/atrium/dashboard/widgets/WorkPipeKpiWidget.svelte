<script lang="ts">
	import type { WorkPipeStats } from '$lib/apis/atrium';

	type WorkPipeWidgetEmptyState = {
		emptyState: string;
	};

	export let data: WorkPipeStats | WorkPipeWidgetEmptyState | null = null;

	function hasEmptyState(value: WorkPipeStats | WorkPipeWidgetEmptyState | null): value is WorkPipeWidgetEmptyState {
		return !!value && typeof value === 'object' && 'emptyState' in value;
	}

	$: stats = hasEmptyState(data) ? null : data;
	$: cards = [
		{ label: 'contacts', value: stats?.contacts.total ?? 0, tone: 'text-cyan-300' },
		{ label: 'new contacts (30d)', value: stats?.contacts.recentCount ?? 0, tone: 'text-emerald-300' },
		{ label: 'tickets', value: stats?.tickets.total ?? 0, tone: 'text-fuchsia-300' },
		{ label: 'pipeline value', value: formatCurrency(stats?.tickets.totalValue ?? 0), tone: 'text-amber-300' },
		{ label: 'pipelines', value: stats?.pipelines.count ?? 0, tone: 'text-violet-300' }
	];

	function formatCurrency(value: number) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		}).format(value);
	}
</script>

{#if hasEmptyState(data)}
	<p class="text-sm text-slate-500">{data.emptyState}</p>
{:else if data}
	<div class="grid grid-cols-2 gap-3">
		{#each cards as card}
			<div class="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
				<p class="text-[11px] uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
				<p class={`mt-2 text-lg font-semibold ${card.tone}`}>{card.value}</p>
			</div>
		{/each}
	</div>
	<p class="text-[11px] text-slate-500">“Pipeline value” reflects total open ticket value from WorkPipe stats — not revenue.</p>
{:else}
	<p class="text-sm text-slate-500">No KPI data.</p>
{/if}
