<script lang="ts">
	import type { ConductorRun } from '$lib/apis/atrium';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';

	export let data: ConductorRun[] | null = null;

	$: runs = data ?? [];

	// Map Conductor run statuses onto StatusBadge's fixed Tailwind color set.
	const STATUS_COLORS: Record<string, string> = {
		completed: 'green',
		succeeded: 'green',
		success: 'green',
		running: 'blue',
		in_progress: 'blue',
		pending: 'yellow',
		queued: 'yellow',
		failed: 'red',
		error: 'red',
		cancelled: 'orange',
		canceled: 'orange'
	};

	function statusColor(status?: string | null) {
		return STATUS_COLORS[(status ?? '').toLowerCase()] ?? 'purple';
	}

	function relativeTime(value?: string | null) {
		if (!value) return 'Unknown time';
		const ms = new Date(value).getTime();
		if (Number.isNaN(ms)) return value;
		const diff = Date.now() - ms;
		if (diff < 0) return 'just now';
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		if (days < 30) return `${days}d ago`;
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(ms);
	}
</script>

{#if runs.length > 0}
	<div class="flex flex-col gap-3">
		<p class="text-sm text-slate-400">Latest Conductor runs in the active scope</p>
		<ul class="flex flex-col gap-2">
			{#each runs as run (run.id)}
				<li class="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-sm font-medium text-white truncate">
								{run.agentName ?? run.agentId ?? 'Conductor agent'}
							</p>
							<p class="text-[11px] text-slate-500 whitespace-nowrap">{relativeTime(run.createdAt)}</p>
						</div>
						<StatusBadge
							label={run.status ?? 'unknown'}
							color={statusColor(run.status)}
							class="capitalize shrink-0"
						/>
					</div>
				</li>
			{/each}
		</ul>
	</div>
{:else}
	<p class="text-sm text-slate-500">No recent Conductor activity for this scope.</p>
{/if}
