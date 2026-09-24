<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores';
	import { activeOrgId, onboardingComplete } from '$lib/stores/atrium';
	import { getOnboardingState } from '$lib/apis/atrium';
	import GlassPanel from '$lib/components/atrium/shared/GlassPanel.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';

	let currentTime = '';
	let currentDate = '';
	let unlocking = false;

	/** In-flight (or settled) backend gate check, resolving to `completed`. The old gate read
	 * the ephemeral `$onboardingComplete` store, which was false on every reload — so a
	 * returning customer was sent back through the wizard forever. The truth now lives in
	 * org.settings.onboarding, read once per org. */
	let gateCheck: Promise<boolean> | null = null;
	let checkedOrgId = '';

	function authToken(): string | undefined {
		return (($user as { token?: string } | undefined)?.token ??
			(typeof localStorage !== 'undefined' ? localStorage.token : undefined)) as
			| string
			| undefined;
	}

	async function fetchGate(orgId: string): Promise<boolean> {
		const token = authToken();
		// No token yet: the layout is still resolving auth. Treat as "can't tell" → app.
		if (!token) return true;
		try {
			const state = await getOnboardingState(token, orgId);
			const completed = Boolean(state?.completed);
			onboardingComplete.set(completed);
			return completed;
		} catch (error) {
			// Resilience over correctness here, deliberately: we must never hard-block. A
			// network blip should not lock a returning customer out of their own workspace,
			// and an un-onboarded user who slips through can still re-enter the wizard (the
			// app works without onboarding — the assistant just starts cold).
			console.error('Failed to read onboarding state', error);
			return true;
		}
	}

	// The org id arrives asynchronously from the /atrium layout, so this is reactive
	// rather than an onMount one-shot — otherwise the check would fire with an empty id.
	$: if ($activeOrgId && $activeOrgId !== checkedOrgId) {
		checkedOrgId = $activeOrgId;
		gateCheck = fetchGate($activeOrgId);
	}

	function updateTime() {
		const now = new Date();
		currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
		currentDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	}

	async function unlock() {
		if (unlocking) return;
		unlocking = true;
		try {
			// Awaiting the in-flight promise means an eager tap doesn't race the check; if no
			// org resolved at all there is nothing to gate on, so fall through to the app.
			const completed = gateCheck ? await gateCheck : true;
			await goto(completed ? '/atrium' : '/atrium/onboarding/step1');
		} finally {
			unlocking = false;
		}
	}

	updateTime();
	const interval = setInterval(updateTime, 1000);
	onDestroy(() => clearInterval(interval));
</script>

<div class="relative z-10 flex h-full w-full flex-col justify-between p-4 sm:p-6 md:p-10">
	<!-- Aurora Background -->
	<div class="aurora-bg"></div>

	<!-- Header -->
	<header class="flex w-full items-center justify-between relative z-10">
		<div class="flex items-center gap-2 text-white/60 text-sm font-medium tracking-wide">
			<MaterialIcon icon="signal_cellular_alt" size={18} />
			<span class="hidden sm:inline">Atrium Network</span>
			<span class="sm:hidden">Atrium</span>
		</div>
		<div class="flex items-center gap-4">
			<div class="hidden md:flex gap-3">
				<GlassPanel class="flex h-8 items-center justify-center rounded-full px-3 text-white/80 gap-2" opacity={0.3} blur={12} rounded="rounded-full">
					<MaterialIcon icon="wifi" size={16} />
					<span class="text-xs font-semibold">Wi-Fi 6E</span>
				</GlassPanel>
				<GlassPanel class="flex h-8 items-center justify-center rounded-full px-3 text-white/80 gap-2" opacity={0.3} blur={12} rounded="rounded-full">
					<MaterialIcon icon="memory" size={16} />
					<span class="text-xs font-semibold">AI Core Online</span>
				</GlassPanel>
			</div>
		</div>
	</header>

	<!-- Center Clock -->
	<main class="flex flex-1 flex-col items-center justify-center text-center relative z-10 px-2">
		<h2 class="mb-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#6961ff]/80">{currentDate}</h2>
		<h1 class="clock-text text-[5rem] sm:text-[8rem] md:text-[10rem] lg:text-[12rem] leading-none font-thin tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-2xl">
			{currentTime}
		</h1>
		<div class="mt-6 sm:mt-8 flex flex-col items-center gap-3">
			<GlassPanel class="flex items-center gap-3 px-5 sm:px-6 py-3 shadow-lg" opacity={0.03} blur={10} borderOpacity={0.05}>
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6961ff] to-purple-600 shadow-inner shrink-0">
					<MaterialIcon icon="dataset" size={20} class="text-white" />
				</div>
				<div class="flex flex-col text-left">
					<span class="text-base sm:text-lg font-bold leading-tight tracking-tight text-white">Atrium</span>
					<span class="text-[10px] font-medium uppercase tracking-wider text-white/50">Neural Workspace</span>
				</div>
			</GlassPanel>
		</div>
	</main>

	<!-- Unlock -->
	<footer class="mb-4 sm:mb-8 flex flex-col items-center gap-4 sm:gap-6 relative z-10">
		<button class="relative group cursor-pointer disabled:cursor-wait" on:click={unlock} disabled={unlocking} aria-label="Unlock">
			<div class="absolute -inset-1 rounded-full bg-[#6961ff]/20 blur-lg opacity-50 group-hover:opacity-100 transition duration-500 animate-pulse"></div>
			<div class="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:scale-105 active:scale-95 border border-white/10 ring-1 ring-white/20">
				<MaterialIcon icon="fingerprint" size={32} />
			</div>
		</button>
		<button class="group flex items-center gap-2 rounded-full px-5 sm:px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/10 bg-white/5 backdrop-blur-md border border-white/5 min-h-[44px]" on:click={unlock} disabled={unlocking}>
			<span class="group-hover:text-[#6961ff] transition-colors">{unlocking ? 'Entering…' : 'Tap to Enter'}</span>
			<MaterialIcon icon="arrow_forward" size={16} class="text-white/50 group-hover:translate-x-1 group-hover:text-white transition-all" />
		</button>
	</footer>
</div>

<style>
	.aurora-bg {
		background:
			radial-gradient(circle at 15% 50%, rgba(105, 97, 255, 0.25) 0%, transparent 25%),
			radial-gradient(circle at 85% 30%, rgba(56, 189, 248, 0.15) 0%, transparent 25%),
			radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.1) 0%, transparent 50%);
		background-color: #0f0e17;
		position: absolute;
		inset: 0;
		z-index: 0;
	}
</style>
