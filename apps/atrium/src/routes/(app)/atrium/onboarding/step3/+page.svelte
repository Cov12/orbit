<script lang="ts">
	// Step 3 — department selection + assisted "help me decide" interview. This replaces the
	// removed "Connect Your Workflow" mock. DeptSetup was orphaned when P1 swapped step 2 from
	// DeptSetup to ContextSetup and never re-homed it; re-mounting it here re-activates the
	// explicit (P2) and assisted (P3) agent-provisioning paths the wizard was built around.
	import DeptSetup from '$lib/components/atrium/onboarding/DeptSetup.svelte';
</script>

<DeptSetup step={3} />
