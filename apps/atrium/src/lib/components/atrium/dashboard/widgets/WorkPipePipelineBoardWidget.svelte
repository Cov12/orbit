<script lang="ts">
	import type { WorkPipePipeline, WorkPipeLane, WorkPipeTicket } from '$lib/apis/atrium';

	type PipelineBoardData = {
		pipelines: WorkPipePipeline[];
		count: number;
		ticketsByLane: Record<string, number>;
	};

	type WorkPipeWidgetEmptyState = {
		emptyState: string;
	};

	export let data: PipelineBoardData | WorkPipeWidgetEmptyState | null = null;

	function hasEmptyState(value: PipelineBoardData | WorkPipeWidgetEmptyState | null): value is WorkPipeWidgetEmptyState {
		return !!value && typeof value === 'object' && 'emptyState' in value;
	}

	$: boardData = hasEmptyState(data) ? null : data;
	$: pipelines = boardData?.pipelines ?? [];
	$: visiblePipelines = pipelines.slice(0, 3);

	function lanesFor(pipeline: WorkPipePipeline): WorkPipeLane[] {
		return pipeline.lanes ?? pipeline.Lane ?? [];
	}

	function ticketsFor(lane: WorkPipeLane): WorkPipeTicket[] {
		// WorkPipe's /pipelines embeds tickets under `Tickets` (capital plural), each with a
		// numeric `value`. The earlier `tickets`/`Ticket` keys never matched, so per-lane value
		// summed to $0 — count survived only via the stats byLane fallback.
		return lane.tickets ?? lane.Tickets ?? lane.Ticket ?? [];
	}

	function laneTicketCount(lane: WorkPipeLane): number {
		return boardData?.ticketsByLane?.[lane.id] ?? ticketsFor(lane).length;
	}

	function laneValue(lane: WorkPipeLane): string {
		const total = ticketsFor(lane).reduce((sum, ticket) => sum + Number(ticket.value ?? 0), 0);
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		}).format(total);
	}
</script>

{#if hasEmptyState(data)}
	<p class="text-sm text-slate-500">{data.emptyState}</p>
{:else if visiblePipelines.length > 0}
	<div class="flex flex-col gap-4">
		{#each visiblePipelines as pipeline}
			<div class="rounded-xl border border-white/8 bg-white/[0.03] p-3 sm:p-4">
				<div class="flex items-center justify-between gap-3">
					<h3 class="text-sm font-semibold text-white truncate">{pipeline.name}</h3>
					<span class="text-[11px] text-slate-500 whitespace-nowrap">{lanesFor(pipeline).length} stage{lanesFor(pipeline).length === 1 ? '' : 's'}</span>
				</div>
				<div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
					{#each lanesFor(pipeline).slice(0, 6) as lane}
						<div class="rounded-lg border border-white/6 bg-[#11131a]/80 px-3 py-2.5">
							<p class="text-sm text-white truncate">{lane.name ?? 'Untitled stage'}</p>
							<div class="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400">
								<span>{laneTicketCount(lane)} deal{laneTicketCount(lane) === 1 ? '' : 's'}</span>
								<span>{laneValue(lane)}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
		{#if pipelines.length > visiblePipelines.length}
			<p class="text-[11px] text-slate-500">Showing the first {visiblePipelines.length} pipelines to keep large orgs readable.</p>
		{/if}
	</div>
{:else}
	<p class="text-sm text-slate-500">No pipelines available in this scope.</p>
{/if}
