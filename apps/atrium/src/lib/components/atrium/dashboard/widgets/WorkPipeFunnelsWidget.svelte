<script lang="ts">
	import type { WorkPipeFunnelsData } from '$lib/apis/atrium';

	type EmptyState = { emptyState: string };
	export let data: WorkPipeFunnelsData | EmptyState | null = null;

	function isEmpty(v: WorkPipeFunnelsData | EmptyState | null): v is EmptyState {
		return !!v && typeof v === 'object' && 'emptyState' in v;
	}

	function num(n: number): string {
		return new Intl.NumberFormat('en-US').format(n ?? 0);
	}

	$: fn = isEmpty(data) ? null : data;
</script>

{#if isEmpty(data)}
	<p class="text-sm text-slate-500">{data.emptyState}</p>
{:else if fn}
	<div class="grid grid-cols-3 gap-3">
		<div class="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
			<p class="text-[11px] uppercase tracking-[0.12em] text-slate-500">funnels</p>
			<p class="mt-2 text-lg font-semibold text-violet-300">{fn.count}</p>
		</div>
		<div class="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
			<p class="text-[11px] uppercase tracking-[0.12em] text-slate-500">published</p>
			<p class="mt-2 text-lg font-semibold text-emerald-300">{fn.publishedCount}</p>
		</div>
		<div class="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
			<p class="text-[11px] uppercase tracking-[0.12em] text-slate-500">visits</p>
			<p class="mt-2 text-lg font-semibold text-cyan-300">{num(fn.totalVisits)}</p>
		</div>
	</div>
	{#if fn.recent.length > 0}
		<div>
			<p class="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">Recent</p>
			<ul class="space-y-1.5">
				{#each fn.recent as f (f.id)}
					<li class="flex items-center justify-between gap-3 text-sm">
						<span class="truncate text-slate-200">{f.name}{f.published ? '' : ' (draft)'}</span>
						<span class="shrink-0 text-xs text-slate-500">{num(f.visits)} visits</span>
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<p class="text-sm text-slate-500">No funnels yet.</p>
	{/if}
{:else}
	<p class="text-sm text-slate-500">No funnel data.</p>
{/if}
