<script lang="ts">
	import type { WorkPipeTrendsData, WorkPipeTrendPoint } from '$lib/apis/atrium';

	type EmptyState = { emptyState: string };
	export let data: WorkPipeTrendsData | EmptyState | null = null;

	function isEmpty(v: WorkPipeTrendsData | EmptyState | null): v is EmptyState {
		return !!v && typeof v === 'object' && 'emptyState' in v;
	}

	// Categorical palette — validated via the dataviz skill (dark surface): CVD-safe,
	// in-band, >=3:1 contrast. Fixed order, never cycled.
	const SERIES = [
		{ key: 'contacts' as const, label: 'contacts', color: '#3987e5' },
		{ key: 'deals' as const, label: 'deals', color: '#d95926' },
		{ key: 'invoices' as const, label: 'invoices', color: '#199e70' }
	];

	// Chart geometry (viewBox units; scales to container width).
	const W = 640;
	const H = 200;
	const padL = 6;
	const padR = 6;
	const padT = 10;
	const padB = 8;
	const plotW = W - padL - padR;
	const plotH = H - padT - padB;

	$: trends = isEmpty(data) ? null : data;
	$: points = (trends?.series ?? []) as WorkPipeTrendPoint[];
	$: totals = trends?.totals ?? { contacts: 0, deals: 0, invoices: 0 };
	$: maxY = Math.max(
		1,
		...points.map((p) => Math.max(p.contacts, p.deals, p.invoices))
	);

	const x = (i: number, n: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
	const y = (v: number) => padT + (1 - v / maxY) * plotH;

	function pathFor(key: 'contacts' | 'deals' | 'invoices'): string {
		const n = points.length;
		if (n === 0) return '';
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i, n).toFixed(1)} ${y(p[key]).toFixed(1)}`)
			.join(' ');
	}

	function fmtDate(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
	}

	// Hover state
	let hoverIndex: number | null = null;
	function onMove(e: MouseEvent) {
		const n = points.length;
		if (n === 0) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		hoverIndex = Math.round(frac * (n - 1));
	}
	function onLeave() {
		hoverIndex = null;
	}
	$: hovered = hoverIndex != null ? points[hoverIndex] : null;
	$: tooltipLeftPct = hoverIndex != null && points.length > 1 ? (hoverIndex / (points.length - 1)) * 100 : 0;
</script>

{#if isEmpty(data)}
	<p class="text-sm text-slate-500">{data.emptyState}</p>
{:else if trends && points.length > 0}
	<div class="flex flex-col gap-3">
		<!-- Legend (always present for >= 2 series) with window totals -->
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
			{#each SERIES as s}
				<div class="flex items-center gap-1.5">
					<span class="inline-block h-2 w-2 rounded-full" style={`background:${s.color}`}></span>
					<span class="text-xs text-slate-400">{s.label}</span>
					<span class="text-xs font-semibold text-slate-200">{totals[s.key] ?? 0}</span>
				</div>
			{/each}
			<span class="ml-auto text-[11px] text-slate-500">last {trends.days} days</span>
		</div>

		<!-- Chart -->
		<div
			class="relative"
			role="img"
			aria-label={`New per day over ${trends.days} days — contacts ${totals.contacts}, deals ${totals.deals}, invoices ${totals.invoices} total.`}
			on:mousemove={onMove}
			on:mouseleave={onLeave}
		>
			<svg viewBox={`0 0 ${W} ${H}`} class="w-full" style="height:auto" preserveAspectRatio="none">
				<!-- baseline -->
				<line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="#ffffff" stroke-opacity="0.08" stroke-width="1" vector-effect="non-scaling-stroke" />
				{#each SERIES as s}
					<path d={pathFor(s.key)} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
				{/each}
				{#if hoverIndex != null}
					<line x1={x(hoverIndex, points.length)} y1={padT} x2={x(hoverIndex, points.length)} y2={padT + plotH} stroke="#ffffff" stroke-opacity="0.18" stroke-width="1" vector-effect="non-scaling-stroke" />
					{#each SERIES as s}
						<circle cx={x(hoverIndex, points.length)} cy={y((hovered?.[s.key]) ?? 0)} r="3.5" fill={s.color} stroke="#11131a" stroke-width="1.5" vector-effect="non-scaling-stroke" />
					{/each}
				{/if}
			</svg>

			<!-- x-axis end labels -->
			<div class="mt-1 flex justify-between text-[10px] text-slate-500">
				<span>{fmtDate(points[0].date)}</span>
				<span>{fmtDate(points[points.length - 1].date)}</span>
			</div>

			<!-- hover tooltip -->
			{#if hovered}
				<div
					class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-white/10 bg-[#11131a]/95 px-2.5 py-2 text-xs shadow-lg"
					style={`left:clamp(60px, ${tooltipLeftPct}%, calc(100% - 60px))`}
				>
					<p class="mb-1 text-[11px] text-slate-400">{fmtDate(hovered.date)}</p>
					{#each SERIES as s}
						<div class="flex items-center gap-1.5">
							<span class="inline-block h-1.5 w-1.5 rounded-full" style={`background:${s.color}`}></span>
							<span class="text-slate-400">{s.label}</span>
							<span class="ml-auto font-semibold text-slate-200">{hovered[s.key]}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<p class="text-sm text-slate-500">No activity in this window.</p>
{/if}
