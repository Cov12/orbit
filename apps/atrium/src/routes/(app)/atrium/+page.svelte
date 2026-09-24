<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores';
	import { activeOrgId, onboardingComplete } from '$lib/stores/atrium';
	import { getOnboardingState } from '$lib/apis/atrium';
	import CrossEcosystemDashboard from '$lib/components/atrium/CrossEcosystemDashboard.svelte';

	// First-open onboarding gate. The wizard lives at /atrium/onboarding/step1..step4; this
	// landing page is its entry point, routing an un-onboarded org into it. It replaces the
	// LockScreen component (which held the same redirect but was never mounted, so the wizard
	// had no way to trigger). Completion is the server-side truth in org.settings.onboarding,
	// so a returning customer is never sent back through the wizard.
	let checkedOrgId = '';
	let decided = false; // gate resolved (org is onboarded, or we can't tell) → show dashboard
	let redirecting = false; // heading to the wizard → render nothing

	function authToken(): string | undefined {
		return (($user as { token?: string } | undefined)?.token ??
			(typeof localStorage !== 'undefined' ? localStorage.token : undefined)) as
			| string
			| undefined;
	}

	async function gate(orgId: string) {
		const token = authToken();
		// No token yet: the layout is still resolving auth. Don't block — fall through to app.
		if (!token) {
			decided = true;
			return;
		}
		try {
			const state = await getOnboardingState(token, orgId);
			const completed = Boolean(state?.completed);
			onboardingComplete.set(completed);
			if (!completed) {
				redirecting = true;
				await goto('/atrium/onboarding/step1');
				return;
			}
		} catch (error) {
			// Resilience over correctness, matching the old LockScreen gate: a network blip must
			// never hard-block a customer out of their own workspace. An un-onboarded user who
			// slips through can still re-enter the wizard; the app just starts cold.
			console.error('Failed to read onboarding state', error);
		}
		decided = true;
	}

	// The org id arrives asynchronously from the /atrium layout, so this is reactive rather
	// than an onMount one-shot — otherwise the check would fire with an empty id.
	$: if ($activeOrgId && $activeOrgId !== checkedOrgId) {
		checkedOrgId = $activeOrgId;
		gate($activeOrgId);
	}

	// Safety net: if no org ever resolves (a hard failure in the layout resolver), don't leave
	// the workspace blank forever — reveal the dashboard after a short grace period.
	onMount(() => {
		const timer = setTimeout(() => {
			if (!redirecting) decided = true;
		}, 4000);
		return () => clearTimeout(timer);
	});
</script>

{#if decided && !redirecting}
	<CrossEcosystemDashboard />
{/if}
