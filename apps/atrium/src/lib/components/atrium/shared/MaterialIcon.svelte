<!--
	MaterialIcon — Convenience wrapper for Material Symbols Outlined.
-->
<script lang="ts">
	/** Icon name from Material Symbols */
	export let icon: string;
	/** Icon size in px */
	export let size = 24;

	let className = '';
	export { className as class };
</script>

<span
	class="material-symbols-outlined {className}"
	style="font-size: {size}px;"
	{...$$restProps}
>{icon}</span>
