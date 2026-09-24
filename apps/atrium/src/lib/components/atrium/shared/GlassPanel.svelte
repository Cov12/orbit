<!--
	GlassPanel — Reusable glassmorphism container for Atrium.
	Replaces duplicated .glass-panel CSS across 6+ components.
-->
<script lang="ts">
	/** Backdrop blur in px */
	export let blur = 20;
	/** Background rgba opacity (0–1) */
	export let opacity = 0.65;
	/** Border white opacity (0–1) */
	export let borderOpacity = 0.08;
	/** Tailwind border-radius class */
	export let rounded = 'rounded-2xl';
	/** Additional CSS classes */
	let className = '';
	export { className as class };
</script>

<div
	class="{rounded} {className}"
	style="background: rgba(20, 20, 35, {opacity}); backdrop-filter: blur({blur}px); -webkit-backdrop-filter: blur({blur}px); border: 1px solid rgba(255, 255, 255, {borderOpacity});"
	{...$$restProps}
>
	<slot />
</div>
