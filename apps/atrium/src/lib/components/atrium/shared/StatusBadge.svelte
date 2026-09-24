<!--
	StatusBadge — Small colored pill/tag for status indicators.
-->
<script lang="ts">
	/** Badge text */
	export let label: string;
	/** Tailwind color name: green, orange, red, blue, purple, etc. */
	export let color = 'green';
	/** Size variant */
	export let size: 'sm' | 'md' = 'sm';

	let className = '';
	export { className as class };

	// Pre-defined color map (Tailwind can't purge dynamic classes)
	const colorMap: Record<string, string> = {
		green:  'bg-green-500/10 text-green-400 border-green-500/20',
		orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
		red:    'bg-red-500/10 text-red-400 border-red-500/20',
		blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
		purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
		pink:   'bg-pink-500/10 text-pink-400 border-pink-500/20',
		yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
		cyan:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
	};

	$: colorClasses = colorMap[color] ?? colorMap.green;
	$: sizeClasses = size === 'sm'
		? 'px-1.5 py-0.5 text-[10px]'
		: 'px-2.5 py-1 text-xs';
</script>

<span
	class="inline-flex items-center gap-1 rounded-md font-medium border {colorClasses} {sizeClasses} {className}"
	{...$$restProps}
>
	{label}
</span>
