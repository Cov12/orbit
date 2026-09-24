<script lang="ts">
	import { notifications, unreadCount, type Notification, activeOrgId } from '$lib/stores/atrium';
	import { user } from '$lib/stores';
	import { getProposals, type Proposal } from '$lib/apis/atrium';
	import { createEventDispatcher, onMount } from 'svelte';
	import GlassPanel from '$lib/components/atrium/shared/GlassPanel.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import StatusBadge from '$lib/components/atrium/shared/StatusBadge.svelte';

	/** Hide the ✕ when the panel is a full page rather than a dismissible drawer. */
	export let showClose = true;

	const dispatch = createEventDispatcher<{ close: void }>();

	let isLoading = false;

	const ICON_STYLES: Record<string, { bg: string; color: string }> = {
		smart_toy: { bg: 'bg-indigo-500/20', color: 'text-indigo-400' },
		attach_money: { bg: 'bg-emerald-500/20', color: 'text-emerald-400' },
		database: { bg: 'bg-blue-500/20', color: 'text-blue-400' },
		calendar_month: { bg: 'bg-purple-500/20', color: 'text-purple-400' },
		image: { bg: 'bg-pink-500/20', color: 'text-pink-400' },
	};

	function getIconStyle(icon: string) {
		return ICON_STYLES[icon] ?? { bg: 'bg-white/10', color: 'text-white/60' };
	}

	function formatTime(timestamp: number) {
		const delta = Date.now() - timestamp * 1000;
		const minutes = Math.max(1, Math.floor(delta / 60000));
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	function mapProposalToNotification(proposal: Proposal): Notification {
		const isAlert = proposal.risk_level === 'critical' || proposal.risk_level === 'high';
		const type: Notification['type'] = proposal.status === 'pending' ? 'action' : isAlert ? 'alert' : 'info';
		return {
			id: proposal.id,
			title: proposal.title,
			dept: proposal.department_id,
			body: proposal.description,
			icon: isAlert ? 'attach_money' : 'smart_toy',
			time: formatTime(proposal.created_at),
			read: proposal.status !== 'pending',
			type
		};
	}

	async function loadNotifications() {
		const token = ($user as { token?: string } | undefined)?.token;
		if (!token) return;

		isLoading = true;
		try {
			// TODO: Replace with dedicated notifications endpoint when available.
			const response = await getProposals(token, $activeOrgId, { limit: 10 });
			notifications.set(response.proposals.map(mapProposalToNotification));
		} catch (error) {
			console.error('Failed to load notifications from proposals:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadNotifications();
	});

	function markAllRead() {
		notifications.update((n) => n.map((x) => ({ ...x, read: true })));
	}

	function markRead(id: string) {
		notifications.update((n) => n.map((x) => x.id === id ? { ...x, read: true } : x));
	}

	$: actionRequired = $notifications.filter((n) => n.type !== 'info' && !n.read);
	$: earlier = $notifications.filter((n) => n.type === 'info' || n.read);
</script>

<div class="w-full h-full flex justify-end">
	<div class="w-full max-w-[420px] md:max-w-[500px] lg:max-w-[560px] flex flex-col border-l border-white/[0.08] h-full"
		style="background: rgba(16, 15, 35, 0.7); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); box-shadow: -10px 0 40px rgba(0,0,0,0.5);"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-white/[0.08] px-4 sm:px-6 md:px-7 lg:px-8 py-4 sm:py-5 md:py-6 shrink-0">
			<div class="flex items-center gap-2 sm:gap-3 md:gap-4">
				<MaterialIcon icon="notifications_active" size={24} class="text-[#6961ff]" />
				<h2 class="text-lg sm:text-xl md:text-2xl lg:text-[1.7rem] font-bold tracking-tight text-white">Notifications</h2>
				{#if $unreadCount > 0}
					<span class="flex h-5 w-5 items-center justify-center rounded-full bg-[#6961ff] text-[10px] font-bold text-white">
						{$unreadCount}
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
				<button
					class="group flex items-center gap-1 sm:gap-1.5 md:gap-2 rounded-lg md:rounded-xl px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 md:py-2 text-xs md:text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
					on:click={markAllRead}
					disabled={isLoading}
				>
					<MaterialIcon icon="check_circle" size={14} />
					<span>Clear All</span>
				</button>
				{#if showClose}
					<button
						type="button"
						data-testid="notification-center-close"
						aria-label="Close notifications"
						title="Close notifications"
						class="flex h-10 w-10 min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-lg md:rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white"
						on:click={() => dispatch('close')}
					>
						<MaterialIcon icon="close" size={20} />
					</button>
				{/if}
			</div>
		</div>

		<!-- Scrollable Content -->
		<div class="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 lg:p-6 space-y-4 sm:space-y-6 md:space-y-7 lg:space-y-8">
			<!-- Action Required -->
			{#if actionRequired.length > 0}
				<div class="space-y-2 sm:space-y-3 md:space-y-4">
					<h3 class="px-1 sm:px-2 md:px-3 text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-slate-400">Action Required</h3>
					{#each actionRequired as notif}
						<div
							class="group relative overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl border border-white/[0.08] bg-[#1b1b28]/80 hover:bg-[#232334] transition-colors p-3 sm:p-4 md:p-5 lg:p-6 shadow-lg cursor-pointer"
							on:click={() => markRead(notif.id)}
							on:keydown={(e) => e.key === 'Enter' && markRead(notif.id)}
							role="button"
							tabindex="0"
						>
							<div class="absolute left-0 top-0 bottom-0 w-1 {notif.type === 'alert' ? 'bg-red-500' : 'bg-yellow-500'}"></div>
							<div class="flex items-start gap-2.5 sm:gap-3 md:gap-4">
								<div class="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg {getIconStyle(notif.icon).bg}">
									<MaterialIcon icon={notif.icon} size={22} class={getIconStyle(notif.icon).color} />
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center justify-between mb-1">
										<p class="text-xs sm:text-sm md:text-base font-bold text-white">{notif.title}</p>
										<span class="text-[10px] text-slate-400">{notif.time}</span>
									</div>
									<p class="text-xs sm:text-sm md:text-base text-slate-300 leading-relaxed mb-2 sm:mb-3 md:mb-4">{notif.body}</p>
									<StatusBadge
										label={notif.type === 'alert' ? 'High Risk' : 'Medium Risk'}
										color={notif.type === 'alert' ? 'red' : 'yellow'}
									/>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Earlier -->
			{#if earlier.length > 0}
				<div class="space-y-2 sm:space-y-3 md:space-y-4">
					<h3 class="px-1 sm:px-2 md:px-3 text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-slate-400">Earlier Today</h3>
					{#each earlier as notif}
						<div class="group relative overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl border border-white/[0.08] bg-[#1b1b28]/60 hover:bg-[#232334] transition-colors p-2.5 sm:p-3 md:p-4 lg:p-5 shadow-sm">
							<div class="flex items-start gap-2.5 sm:gap-3 md:gap-4">
								<div class="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg {getIconStyle(notif.icon).bg}">
									<MaterialIcon icon={notif.icon} size={18} class={getIconStyle(notif.icon).color} />
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center justify-between mb-0.5">
										<p class="text-xs sm:text-sm md:text-base font-semibold text-slate-200">{notif.title}</p>
										<span class="text-[10px] text-slate-500">{notif.time}</span>
									</div>
									<p class="text-[11px] sm:text-xs text-slate-400 mb-2">{notif.body}</p>
									{#if notif.type === 'info' && notif.read}
										<StatusBadge label="Complete" color="green" />
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<div class="mt-4 pb-8 text-center">
				<p class="text-[10px] text-slate-600">Atrium • All systems operational</p>
			</div>
		</div>
	</div>
</div>
