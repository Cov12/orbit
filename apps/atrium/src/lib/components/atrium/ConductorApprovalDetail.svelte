<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ConductorApproval } from '$lib/apis/atrium';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';

	export let approval: ConductorApproval;
	export let submitting = false;

	const dispatch = createEventDispatcher<{
		approve: { id: string; note?: string };
		reject: { id: string; note?: string };
		close: void;
	}>();

	let decisionNote = '';

	const STATUS_COLORS: Record<string, string> = {
		pending: 'yellow',
		approved: 'green',
		rejected: 'red',
		revision_requested: 'orange'
	};

	const TYPE_LABELS: Record<string, string> = {
		hire_agent: 'Hire Agent',
		custom: 'Custom Approval'
	};

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString();
	}

	function getAgentName(): string {
		if (approval.type === 'hire_agent' && approval.payload?.name) {
			return String(approval.payload.name);
		}
		return approval.requested_by_agent_name || 'Unknown';
	}

	function getAgentTitle(): string {
		if (approval.type === 'hire_agent' && approval.payload?.title) {
			return String(approval.payload.title);
		}
		return '';
	}

	function getAdapterType(): string {
		if (approval.payload?.adapterType) {
			return String(approval.payload.adapterType).replace('_', ' ');
		}
		return '';
	}

	function getDescription(): string {
		if (approval.payload?.description) {
			return String(approval.payload.description);
		}
		return '';
	}

	$: isPending = approval.status === 'pending';
</script>

<div class="rounded-xl bg-[#1a1a1f] border border-white/10 overflow-hidden">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-white/5 px-5 py-4">
		<div class="flex items-center gap-3">
			<div class="h-12 w-12 rounded-lg bg-[#6961ff]/20 flex items-center justify-center">
				<MaterialIcon
					icon={approval.type === 'hire_agent' ? 'person_add' : 'approval'}
					size={24}
					class="text-[#6961ff]"
				/>
			</div>
			<div>
				<h3 class="text-lg font-semibold text-white">{getAgentName()}</h3>
				{#if getAgentTitle()}
					<p class="text-sm text-slate-400">{getAgentTitle()}</p>
				{/if}
			</div>
		</div>
		<button
			on:click={() => dispatch('close')}
			class="p-2 rounded-lg hover:bg-white/5 transition-colors"
		>
			<MaterialIcon icon="close" size={20} class="text-slate-400" />
		</button>
	</div>

	<!-- Content -->
	<div class="px-5 py-4 space-y-4">
		<!-- Status & Type -->
		<div class="flex items-center gap-2 flex-wrap">
			<StatusBadge label={TYPE_LABELS[approval.type]} color="blue" />
			<StatusBadge
				label={approval.status.replace('_', ' ')}
				color={STATUS_COLORS[approval.status]}
			/>
		</div>

		<!-- Details -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{#if getAdapterType()}
				<div>
					<p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Adapter</p>
					<p class="text-sm text-white capitalize">{getAdapterType()}</p>
				</div>
			{/if}

			{#if approval.requested_by_agent_name}
				<div>
					<p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Requested By</p>
					<p class="text-sm text-white">{approval.requested_by_agent_name}</p>
				</div>
			{/if}

			<div>
				<p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Created</p>
				<p class="text-sm text-white">{formatDate(approval.created_at)}</p>
			</div>

			<div>
				<p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Last Updated</p>
				<p class="text-sm text-white">{formatDate(approval.updated_at)}</p>
			</div>
		</div>

		<!-- Description -->
		{#if getDescription()}
			<div>
				<p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Description</p>
				<p class="text-sm text-slate-300">{getDescription()}</p>
			</div>
		{/if}

		<!-- Payload Preview (for hire_agent) -->
		{#if approval.type === 'hire_agent'}
			<div class="rounded-lg bg-white/5 border border-white/10 p-4">
				<p class="text-xs text-slate-500 uppercase tracking-wide mb-2">Agent Configuration</p>
				<div class="space-y-2 text-sm">
					{#if approval.payload?.role}
						<div class="flex justify-between">
							<span class="text-slate-400">Role</span>
							<span class="text-white capitalize">{approval.payload.role}</span>
						</div>
					{/if}
					{#if approval.payload?.managerId}
						<div class="flex justify-between">
							<span class="text-slate-400">Reports To</span>
							<span class="text-white">{approval.payload.managerId}</span>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Decision Note (if already decided) -->
		{#if approval.decision_note}
			<div class="rounded-lg bg-white/5 border border-white/10 p-4">
				<p class="text-xs text-slate-500 uppercase tracking-wide mb-2">Decision Note</p>
				<p class="text-sm text-slate-300">{approval.decision_note}</p>
				{#if approval.decided_by_user_id}
					<p class="text-xs text-slate-500 mt-2">
						Decided by {approval.decided_by_user_id}
						{#if approval.decided_at}
							on {formatDate(approval.decided_at)}
						{/if}
					</p>
				{/if}
			</div>
		{/if}

		<!-- Decision Input (if pending) -->
		{#if isPending}
			<div>
				<label for="decision-note" class="block text-xs text-slate-500 uppercase tracking-wide mb-1">
					Decision Note (Optional)
				</label>
				<textarea
					id="decision-note"
					bind:value={decisionNote}
					placeholder="Add a note about your decision..."
					rows="3"
					class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-0 focus:border-[#6961ff] resize-none"
				></textarea>
			</div>
		{/if}
	</div>

	<!-- Footer Actions -->
	{#if isPending}
		<div class="flex items-center justify-end gap-3 border-t border-white/5 px-5 py-4">
			<button
				on:click={() => dispatch('close')}
				class="px-4 py-2 rounded-lg bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors"
			>
				Cancel
			</button>
			<button
				on:click={() => dispatch('reject', { id: approval.id, note: decisionNote })}
				disabled={submitting}
				class="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
			>
				{#if submitting}
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-red-400/20 border-t-red-400"></div>
				{:else}
					<MaterialIcon icon="close" size={16} />
				{/if}
				Reject
			</button>
			<button
				on:click={() => dispatch('approve', { id: approval.id, note: decisionNote })}
				disabled={submitting}
				class="px-4 py-2 rounded-lg bg-[#6961ff] text-white text-sm font-medium hover:bg-[#5a52e8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
			>
				{#if submitting}
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
				{:else}
					<MaterialIcon icon="check" size={16} />
				{/if}
				Approve
			</button>
		</div>
	{:else}
		<div class="flex items-center justify-end border-t border-white/5 px-5 py-4">
			<button
				on:click={() => dispatch('close')}
				class="px-4 py-2 rounded-lg bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors"
			>
				Close
			</button>
		</div>
	{/if}
</div>
