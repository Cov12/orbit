<script lang="ts">
	import type { WorkPipeInvoicesData } from '$lib/apis/atrium';

	type EmptyState = { emptyState: string };
	export let data: WorkPipeInvoicesData | EmptyState | null = null;

	function isEmpty(v: WorkPipeInvoicesData | EmptyState | null): v is EmptyState {
		return !!v && typeof v === 'object' && 'emptyState' in v;
	}

	function money(n: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		}).format(n ?? 0);
	}

	$: inv = isEmpty(data) ? null : data;
</script>

{#if isEmpty(data)}
	<p class="text-sm text-slate-500">{data.emptyState}</p>
{:else if inv}
	<div class="grid grid-cols-2 gap-3">
		<div class="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
			<p class="text-[11px] uppercase tracking-[0.12em] text-slate-500">total due</p>
			<p class="mt-2 text-lg font-semibold text-amber-300">{money(inv.totalDue)}</p>
		</div>
		<div class="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
			<p class="text-[11px] uppercase tracking-[0.12em] text-slate-500">invoices</p>
			<p class="mt-2 text-lg font-semibold text-cyan-300">{inv.count}</p>
		</div>
	</div>
	{#if inv.dueSoonCount > 0}
		<p class="text-[11px] text-amber-400/80">{inv.dueSoonCount} due within 7 days.</p>
	{/if}
	{#if inv.recent.length > 0}
		<div>
			<p class="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">Recent</p>
			<ul class="space-y-1.5">
				{#each inv.recent as r (r.id)}
					<li class="flex items-center justify-between gap-3 text-sm">
						<span class="truncate text-slate-200">{r.name}</span>
						<span class="shrink-0 text-xs text-slate-500">{money(r.totalDue)}</span>
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<p class="text-sm text-slate-500">No invoices yet.</p>
	{/if}
{:else}
	<p class="text-sm text-slate-500">No invoice data.</p>
{/if}
