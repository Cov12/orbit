<script lang="ts">
	import { fade } from 'svelte/transition';
	import { buildAddSubAccountUrl, type OrgSubAccount } from '$lib/apis/atrium';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';

	export let orgId = '';
	export let subAccounts: OrgSubAccount[] = [];
	// True only once a Portal sub-account pull has actually succeeded for this org. The
	// nudge is gated on it so a fetch failure — which also leaves subAccounts empty —
	// can never tell an existing customer they have no businesses.
	export let syncOk = false;
	export let publicOrigin: string | null = null;

	const DISMISS_KEY_PREFIX = 'atrium:firstBusinessNudgeDismissed:';

	let dismissed = false;
	let dismissCheckedOrgId: string | null = null;

	// Per-device suppression, keyed by org. This only stops re-nagging someone who skipped
	// and still has zero businesses — the subAccounts.length === 0 gate is what makes the
	// nudge disappear for good, on every device, once one actually exists.
	function readDismissed(id: string): boolean {
		if (typeof localStorage === 'undefined') return false;
		try {
			return localStorage.getItem(DISMISS_KEY_PREFIX + id) === '1';
		} catch (error) {
			console.error('Failed to read first-business nudge dismissal', error);
			return false;
		}
	}

	$: if (orgId && orgId !== dismissCheckedOrgId) {
		dismissCheckedOrgId = orgId;
		dismissed = readDismissed(orgId);
	}

	$: show = syncOk === true && subAccounts.length === 0 && !dismissed;

	function dismiss() {
		dismissed = true;
		if (!orgId || typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(DISMISS_KEY_PREFIX + orgId, '1');
		} catch (error) {
			console.error('Failed to persist first-business nudge dismissal', error);
		}
	}

	// Same tab: the return hop re-authenticates through /atrium/auth/callback, which sets
	// the session cookie on a 303 before landing back here.
	function addBusiness() {
		if (typeof window === 'undefined') return;
		window.location.assign(buildAddSubAccountUrl(publicOrigin));
	}
</script>

{#if show}
	<div
		class="pointer-events-auto w-full max-w-2xl bg-[#1c1c21]/80 backdrop-blur-md rounded-xl px-3 py-2.5 shadow-lg ring-1 ring-white/10 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
		transition:fade={{ duration: 200 }}
	>
		<MaterialIcon icon="add_business" size={20} class="text-[#6961ff] shrink-0" />

		<div class="min-w-0 flex-1">
			<h3 class="text-sm font-medium text-white">Set up your first business to get started</h3>
			<p class="text-[11px] text-white/50">
				Add a business and the assistant can work with its contacts, deals and invoices.
			</p>
		</div>

		<div class="flex items-center gap-2 shrink-0">
			<button
				type="button"
				class="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-[#6961ff] hover:bg-[#7a73ff] text-white shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap min-h-[40px]"
				on:click={addBusiness}
			>
				<MaterialIcon icon="add" size={18} />
				<span>Add a business</span>
			</button>
			<button
				type="button"
				class="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap min-h-[40px]"
				on:click={dismiss}
			>
				Not now
			</button>
		</div>
	</div>
{/if}
