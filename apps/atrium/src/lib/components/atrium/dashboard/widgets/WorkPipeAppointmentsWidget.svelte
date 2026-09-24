<script lang="ts">
	import type { WorkPipeAppointmentsData } from '$lib/apis/atrium';

	type EmptyState = { emptyState: string };
	export let data: WorkPipeAppointmentsData | EmptyState | null = null;

	function isEmpty(v: WorkPipeAppointmentsData | EmptyState | null): v is EmptyState {
		return !!v && typeof v === 'object' && 'emptyState' in v;
	}

	function fmt(iso: string, allDay?: boolean): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			...(allDay ? {} : { hour: 'numeric', minute: '2-digit' })
		}).format(d);
	}

	$: appts = isEmpty(data) ? null : data;
</script>

{#if isEmpty(data)}
	<p class="text-sm text-slate-500">{data.emptyState}</p>
{:else if appts && appts.upcoming.length > 0}
	<div class="flex flex-col gap-2">
		{#each appts.upcoming as ev (ev.id)}
			<div class="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2">
				<span class="truncate text-sm text-slate-200">{ev.title}</span>
				<span class="shrink-0 text-xs text-slate-500">{fmt(ev.start, ev.allDay)}</span>
			</div>
		{/each}
	</div>
	{#if appts.upcomingCount > appts.upcoming.length}
		<p class="text-[11px] text-slate-500">{appts.upcomingCount} upcoming in total.</p>
	{/if}
{:else}
	<p class="text-sm text-slate-500">No upcoming appointments.</p>
{/if}
