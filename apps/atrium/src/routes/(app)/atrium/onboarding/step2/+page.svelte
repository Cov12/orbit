<script lang="ts">
	// P1: step 2 captures business context (the facts seeded into Engram). Department
	// provisioning is P2 — DeptSetup.svelte is left untouched for that drop, and this step
	// deliberately does not activate or create anything.
	import ContextSetup from '$lib/components/atrium/onboarding/ContextSetup.svelte';
</script>

<ContextSetup step={2} />
