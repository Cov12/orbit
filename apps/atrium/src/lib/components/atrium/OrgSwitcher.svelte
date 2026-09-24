<!--
	OrgSwitcher — deliberate switching of the ACTIVE ORGANIZATION for multi-org users.

	Distinct from SubAccountScopeSelector, which scopes within one org. The active org
	governs the whole Atrium shell (dashboard, departments, analytics, chat), so this
	lives in the layout top bar rather than any single page's chrome.

	Renders nothing for single-org users — the overwhelmingly common case — and nothing
	until the membership-scoped org list has loaded.
-->
<script lang="ts">
	import {
		listOrganizations,
		persistActiveOrgId,
		shouldShowOrgSwitcher,
		sortOrgsForSwitcher,
		type Organization
	} from '$lib/apis/atrium';
	import { activeOrg } from '$lib/stores/atrium';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';

	/** Session token; the layout resolves Portal-token-first and passes the winner down. */
	export let token: string | undefined | null = null;

	let orgs: Organization[] = [];
	let open = false;
	let switching = false;
	/** Guards the reactive fetch: the layout assigns `token` after its own onMount. */
	let loadedToken: string | null = null;

	$: if (typeof window !== 'undefined' && token && token !== loadedToken) {
		loadedToken = token;
		void loadOrgs(token);
	}

	async function loadOrgs(authToken: string) {
		try {
			// Membership-scoped server-side, so every entry here is one the user may act as.
			orgs = sortOrgsForSwitcher(await listOrganizations(authToken));
		} catch (error) {
			// A failed list is not worth surfacing: without it we simply render nothing.
			console.error('Failed to load organizations for the switcher', error);
			orgs = [];
		}
	}

	$: visible = shouldShowOrgSwitcher(orgs);
	$: currentId = $activeOrg?.id ?? '';
	$: currentLabel = $activeOrg?.name ?? 'Select organization';

	/**
	 * Persist first, then hard reload. Only Chat re-fetches on an $activeOrgId change; the
	 * dashboard, departments, analytics, approvals and settings views all load org-scoped
	 * data in onMount, so a store-only switch would leave the previous org's data on screen.
	 * The reload is lossless — getOrganizationForUser reads the id we just stored.
	 */
	function select(org: Organization) {
		open = false;
		if (switching || org.id === currentId) return;
		switching = true;
		persistActiveOrgId(org.id);
		activeOrg.set(org);
		if (typeof window !== 'undefined') {
			window.location.reload();
		}
	}
</script>

<svelte:window on:keydown={(event) => { if (event.key === 'Escape') open = false; }} />

{#if visible}
	<div class="relative">
		<button
			type="button"
			class="px-2 py-1.5 rounded-lg transition-all flex items-center gap-1.5 max-w-[14rem] {open
				? 'bg-white/10 text-white'
				: 'text-slate-400 hover:bg-white/10 hover:text-white'}"
			aria-haspopup="true"
			aria-expanded={open}
			aria-label="Switch organization"
			disabled={switching}
			on:click={() => (open = !open)}
		>
			<MaterialIcon icon="corporate_fare" size={18} class="text-[#6961ff] shrink-0" />
			<span class="text-sm truncate">{currentLabel}</span>
			<MaterialIcon icon={open ? 'expand_less' : 'expand_more'} size={18} class="text-white/50 shrink-0" />
		</button>

		{#if open}
			<button
				class="fixed inset-0 z-30 cursor-default"
				on:click={() => (open = false)}
				aria-label="Close organization switcher"
			></button>
			<div
				class="absolute right-0 mt-2 w-72 z-40 rounded-xl bg-[#15151b] border border-white/10 shadow-xl py-1 overflow-hidden"
			>
				<div class="px-3 py-2 text-[11px] uppercase tracking-wide text-white/40">Organization</div>
				{#each orgs as org (org.id)}
					<button
						type="button"
						class="w-full px-3 py-2.5 text-left hover:bg-white/5 transition flex items-center justify-between gap-3"
						on:click={() => select(org)}
					>
						<span class="min-w-0">
							<span class="block text-sm text-white truncate">{org.name || org.slug}</span>
							{#if org.slug}
								<span class="block text-[11px] text-white/40 truncate">{org.slug}</span>
							{/if}
						</span>
						{#if org.id === currentId}
							<MaterialIcon icon="check" size={16} class="text-[#6961ff] shrink-0" />
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
