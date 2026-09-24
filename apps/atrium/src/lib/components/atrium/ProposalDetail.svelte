<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Proposal } from '$lib/stores/atrium';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';

	const dispatch = createEventDispatcher();

	export let proposal: Proposal;

	let reviewNote = '';
	export let submitting = false;

	const PRIORITY_COLORS: Record<string, string> = {
		low: 'green', medium: 'yellow', high: 'orange', critical: 'red',
	};

	function handleApprove() {
		dispatch('approve', { id: proposal.id, note: reviewNote });
	}

	function handleReject() {
		dispatch('reject', { id: proposal.id, note: reviewNote });
	}

	$: isPending = proposal.status === 'pending';
</script>

<div class="overflow-hidden rounded-xl md:rounded-2xl border border-white/10 shadow-xl mx-2 sm:mx-0"
	style="background: rgba(20, 20, 30, 0.95); backdrop-filter: blur(20px);"
>
	<!-- Header -->
	<div class="flex items-start justify-between border-b border-white/10 px-4 sm:px-6 md:px-7 lg:px-8 py-4 sm:py-5 gap-3 md:gap-4">
		<div class="flex-1 min-w-0">
			<h2 class="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-white break-words">{proposal.title}</h2>
			<div class="mt-1 flex items-center gap-2 text-xs sm:text-sm md:text-base text-slate-400 flex-wrap">
				<span class="truncate">{proposal.dept}</span>
				<span>·</span>
				<span class="whitespace-nowrap">{proposal.createdAt}</span>
			</div>
		</div>
		<button
			class="rounded-lg p-2.5 md:p-3 transition-colors hover:bg-white/10 text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
			on:click={() => dispatch('close')}
			aria-label="Close"
		>
			<MaterialIcon icon="close" size={20} />
		</button>
	</div>

	<div class="max-h-[60vh] md:max-h-[65vh] overflow-y-auto px-4 sm:px-6 md:px-7 lg:px-8 py-4 sm:py-5 md:py-6">
		<!-- Priority -->
		<div class="mb-4 md:mb-5 rounded-lg border border-white/10 p-3 sm:p-4 md:p-5 bg-white/5">
			<StatusBadge
				label="{proposal.priority.charAt(0).toUpperCase() + proposal.priority.slice(1)} Priority"
				color={PRIORITY_COLORS[proposal.priority]}
				size="md"
			/>
		</div>

		<!-- Description -->
		<div class="mb-4 md:mb-5">
			<h3 class="mb-1 md:mb-2 text-sm md:text-base font-medium text-slate-400">Description</h3>
			<p class="text-sm md:text-base leading-relaxed text-slate-200 break-words">{proposal.description}</p>
		</div>

		<!-- Review Note -->
		{#if isPending}
			<div class="mt-4 md:mt-5">
				<label for="review-note" class="mb-1 md:mb-2 block text-sm md:text-base font-medium text-slate-400">
					Review Note (optional)
				</label>
				<textarea
					id="review-note"
					bind:value={reviewNote}
					placeholder="Add a note about your decision..."
					rows="3"
					class="w-full rounded-lg border border-white/10 bg-white/5 px-3 md:px-4 py-3 text-sm md:text-base text-white
						focus:border-[#6961ff] focus:outline-none focus:ring-0 placeholder-slate-500 min-h-[44px]"
				></textarea>
			</div>
		{/if}
	</div>

	<!-- Actions -->
	{#if isPending}
		<div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2 md:gap-3 border-t border-white/10 px-4 sm:px-6 md:px-7 lg:px-8 py-4 sm:py-5">
			<button
				class="rounded-lg px-4 md:px-5 py-3 sm:py-2.5 md:py-3 text-sm md:text-base font-medium text-red-400 transition-colors hover:bg-red-500/10 min-h-[44px]"
				disabled={submitting}
				on:click={handleReject}
			>
				Reject
			</button>
			<button
				class="rounded-lg bg-[#6961ff] px-4 md:px-5 py-3 sm:py-2.5 md:py-3 text-sm md:text-base font-medium text-white transition-colors hover:bg-[#5851d8] disabled:opacity-50 shadow-lg shadow-[#6961ff]/20 min-h-[44px]"
				disabled={submitting}
				on:click={handleApprove}
			>
				{#if submitting}
					<span class="inline-flex items-center justify-center gap-2">
						<div class="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
						Processing...
					</span>
				{:else}
					Approve
				{/if}
			</button>
		</div>
	{/if}
</div>
