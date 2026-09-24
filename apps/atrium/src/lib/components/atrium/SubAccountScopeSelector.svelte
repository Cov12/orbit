<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { buildAddSubAccountUrl, type OrgSubAccount } from '$lib/apis/atrium';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';

	export let subAccounts: OrgSubAccount[] = [];
	export let activeSubAccountId: string | null = null;
	export let loading = false;
	export let disabled = false;
	// Server-stated canonical origin for the Portal return hop. Optional: when a host does
	// not pass it we still render the CTA and fall back to window.location.origin, which is
	// best-effort — Portal's redirect allowlist matches the registered origin exactly.
	export let publicOrigin: string | null = null;

	const dispatch = createEventDispatcher<{ select: { subAccountId: string | null } }>();

	let open = false;

	$: activeLabel =
		activeSubAccountId == null
			? 'Business'
			: subAccounts.find((subAccount) => subAccount.id === activeSubAccountId)?.name ?? 'Sub-account';

	function select(subAccountId: string | null) {
		open = false;
		dispatch('select', { subAccountId });
	}

	// Same tab on purpose: the return hop re-authenticates through /atrium/auth/callback,
	// which sets the session cookie on a 303. A new tab would strand the opener on a stale
	// session with no sub-account selected.
	function addFirstSubAccount() {
		if (typeof window === 'undefined') return;
		window.location.assign(buildAddSubAccountUrl(publicOrigin));
	}
</script>

{#if loading}
	<div class="bg-[#1c1c21]/80 backdrop-blur-md rounded-xl px-3 py-2 inline-flex items-center gap-2 shadow-lg ring-1 ring-white/10 text-white/60 text-xs sm:text-sm min-h-[40px]">
		<div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
		Loading scope...
	</div>
{:else if subAccounts.length > 0}
	<div class="relative pointer-events-auto">
		<button
			type="button"
			class="bg-[#1c1c21]/80 backdrop-blur-md rounded-xl p-1 inline-flex items-center shadow-lg ring-1 ring-white/10"
			on:click={() => (open = !open)}
			disabled={disabled}
		>
			<span class="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px] text-white/80 hover:text-white disabled:opacity-50">
				<MaterialIcon icon="workspaces" size={18} class="text-[#6961ff]" />
				<span>Scope:</span>
				<span class="text-white max-w-[12rem] truncate">{activeLabel}</span>
				<MaterialIcon icon={open ? 'expand_less' : 'expand_more'} size={18} class="text-white/50" />
			</span>
		</button>

		{#if open}
			<div class="absolute left-0 right-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-72 z-40 rounded-xl bg-[#15151b] border border-white/10 shadow-xl py-1 overflow-hidden">
				<button
					type="button"
					class="w-full px-3 py-2.5 text-left hover:bg-white/5 transition flex items-center justify-between gap-3"
					on:click={() => select(null)}
				>
					<span class="min-w-0">
						<span class="block text-sm text-white truncate">Business</span>
						<span class="block text-[11px] text-white/40">Management and oversight across the org</span>
					</span>
					{#if activeSubAccountId == null}
						<MaterialIcon icon="check" size={16} class="text-[#6961ff] shrink-0" />
					{/if}
				</button>
				<div class="my-1 border-t border-white/5"></div>
				{#each subAccounts as subAccount}
					<button
						type="button"
						class="w-full px-3 py-2.5 text-left hover:bg-white/5 transition flex items-center justify-between gap-3"
						on:click={() => select(subAccount.id)}
					>
						<span class="min-w-0">
							<span class="block text-sm text-white truncate">{subAccount.name ?? 'Untitled sub-account'}</span>
							{#if subAccount.slug}
								<span class="block text-[11px] text-white/40 truncate">{subAccount.slug}</span>
							{/if}
						</span>
						{#if activeSubAccountId === subAccount.id}
							<MaterialIcon icon="check" size={16} class="text-[#6961ff] shrink-0" />
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<!-- Zero sub-accounts: the scope picker has nothing to pick, so offer the first one. -->
	<div class="relative pointer-events-auto">
		<button
			type="button"
			class="bg-[#1c1c21]/80 backdrop-blur-md rounded-xl p-1 inline-flex items-center shadow-lg ring-1 ring-white/10"
			on:click={addFirstSubAccount}
			disabled={disabled}
		>
			<span class="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px] text-white/80 hover:text-white disabled:opacity-50">
				<MaterialIcon icon="add_business" size={18} class="text-[#6961ff]" />
				<span>Add your first business</span>
			</span>
		</button>
	</div>
{/if}
