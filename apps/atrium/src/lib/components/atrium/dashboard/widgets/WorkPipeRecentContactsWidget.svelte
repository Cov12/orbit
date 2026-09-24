<script lang="ts">
	import type { WorkPipeContactsData, WorkPipeContact } from '$lib/apis/atrium';

	type WorkPipeWidgetEmptyState = {
		emptyState: string;
	};

	export let data: WorkPipeContactsData | WorkPipeWidgetEmptyState | null = null;

	function hasEmptyState(value: WorkPipeContactsData | WorkPipeWidgetEmptyState | null): value is WorkPipeWidgetEmptyState {
		return !!value && typeof value === 'object' && 'emptyState' in value;
	}

	$: contactsData = hasEmptyState(data) ? null : data;
	$: contacts = contactsData?.contacts ?? [];

	function formatDate(value?: string | null) {
		if (!value) return 'Unknown date';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric'
		}).format(date);
	}

	function secondary(contact: WorkPipeContact) {
		return contact.email || contact.phone || 'No email or phone';
	}
</script>

{#if hasEmptyState(data)}
	<p class="text-sm text-slate-500">{data.emptyState}</p>
{:else if contacts.length > 0}
	<div class="flex flex-col gap-3">
		<div class="flex items-baseline justify-between gap-3">
			<p class="text-sm text-slate-400">Newest contacts in the active WorkPipe scope</p>
			<p class="text-[11px] text-slate-500 whitespace-nowrap">{contactsData?.total ?? contacts.length} total</p>
		</div>
		<ul class="flex flex-col gap-2">
			{#each contacts as contact}
				<li class="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-sm font-medium text-white truncate">{contact.name ?? 'Unnamed contact'}</p>
							<p class="text-xs text-slate-400 truncate">{secondary(contact)}</p>
						</div>
						<span class="text-[11px] text-slate-500 whitespace-nowrap">{formatDate(contact.createdAt)}</span>
					</div>
				</li>
			{/each}
		</ul>
	</div>
{:else}
	<p class="text-sm text-slate-500">No recent contacts for this scope.</p>
{/if}
