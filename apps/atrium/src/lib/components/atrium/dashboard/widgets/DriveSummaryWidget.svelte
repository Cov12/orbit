<script lang="ts">
	import type { DriveSummary } from '$lib/apis/atrium';

	export let data: DriveSummary | null = null;

	function fmtBytes(bytesStr: string | number | undefined): string {
		const n = Number(bytesStr ?? 0);
		if (!Number.isFinite(n) || n <= 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let v = n;
		let i = 0;
		while (v >= 1024 && i < units.length - 1) {
			v /= 1024;
			i++;
		}
		return `${v.toFixed(i === 0 || v >= 10 ? 0 : 1)} ${units[i]}`;
	}

	$: used = Number(data?.quota?.usedBytes ?? 0);
	$: total = Number(data?.quota?.quotaBytes ?? 0);
	$: pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
</script>

{#if data}
	<div class="space-y-4">
		<div>
			<div class="flex items-baseline justify-between">
				<p class="text-[11px] uppercase tracking-[0.12em] text-slate-500">Storage</p>
				<p class="text-xs text-slate-400">
					{fmtBytes(data.quota?.usedBytes)} / {fmtBytes(data.quota?.quotaBytes)}
				</p>
			</div>
			<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
				<div class="h-full rounded-full bg-cyan-400/80" style={`width: ${pct}%`}></div>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div class="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
				<p class="text-[11px] uppercase tracking-[0.12em] text-slate-500">files</p>
				<p class="mt-2 text-lg font-semibold text-cyan-300">{data.fileCount}</p>
			</div>
			<div class="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
				<p class="text-[11px] uppercase tracking-[0.12em] text-slate-500">folders</p>
				<p class="mt-2 text-lg font-semibold text-violet-300">{data.folderCount}</p>
			</div>
		</div>

		{#if data.recentFiles?.length}
			<div>
				<p class="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">Recent files</p>
				<ul class="space-y-1.5">
					{#each data.recentFiles as file (file.id)}
						<li class="flex items-center justify-between gap-3 text-sm">
							<span class="truncate text-slate-200">{file.name}</span>
							<span class="shrink-0 text-xs text-slate-500">{fmtBytes(file.size)}</span>
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<p class="text-sm text-slate-500">No files yet.</p>
		{/if}
	</div>
{:else}
	<p class="text-sm text-slate-500">No Drive data.</p>
{/if}
