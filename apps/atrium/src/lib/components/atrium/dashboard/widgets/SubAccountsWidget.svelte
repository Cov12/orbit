<!--
	SubAccountsWidget — Example Dashboard (D1) widget.
	Read-only count of the org's sub-accounts. Data is supplied by the
	registry `load()` fn (getOrgSubAccounts) and passed in via the `data` prop.
-->
<script lang="ts">
	import type { OrgSubAccount } from '$lib/apis/atrium';

	export let data: { subAccounts: OrgSubAccount[]; activeSubAccountId: string | null } | null = null;

	$: subAccounts = data?.subAccounts ?? [];
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-baseline gap-2">
		<span class="text-3xl font-bold text-white">{subAccounts.length}</span>
		<span class="text-sm text-slate-400">connected sub-account{subAccounts.length === 1 ? '' : 's'}</span>
	</div>
	{#if subAccounts.length > 0}
		<ul class="flex flex-col gap-1.5">
			{#each subAccounts.slice(0, 4) as subAccount}
				<li class="flex items-center gap-2 text-xs text-slate-400">
					<span class="material-symbols-outlined text-[16px] text-[#6961ff]">workspaces</span>
					<span class="truncate">{subAccount.name ?? 'Untitled sub-account'}</span>
				</li>
			{/each}
			{#if subAccounts.length > 4}
				<li class="text-[11px] text-slate-500">+{subAccounts.length - 4} more</li>
			{/if}
		</ul>
	{:else}
		<p class="text-sm text-slate-500">No sub-accounts linked yet.</p>
	{/if}
</div>
