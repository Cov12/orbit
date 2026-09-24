<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import {
		WEBUI_NAME,
		showSidebar,
		user,
		mobile
	} from '$lib/stores';
	import { getOrganizationForUser, createOrganization, ACTIVE_ORG_PARAM } from '$lib/apis/atrium';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import AgencyNav from '$lib/components/atrium/shared/AgencyNav.svelte';
	import { agencyNavCollapsed, agencyNavMobile, activeOrg, unreadCount } from '$lib/stores/atrium';
	import NotificationCenter from '$lib/components/atrium/NotificationCenter.svelte';
	import OrgSwitcher from '$lib/components/atrium/OrgSwitcher.svelte';

	let notificationPanelOpen = false;
	/** Resolved session token, hoisted out of onMount so the org switcher can reuse it. */
	let authToken: string | undefined;

	const i18n = getContext('i18n');

	let loaded = false;
	let orgLoading = true;
	let authChecking = true;

	// Orbit Portal URL — users are redirected here to authenticate
	const PORTAL_URL = 'https://portal.orbit.example';
	// Fallback for dev/staging
	const PORTAL_LOGIN_URL = `${PORTAL_URL}/sign-in`;

	// Sync mobile state from parent app
	$: agencyNavMobile.set($mobile);

	// On mobile, collapse nav by default
	$: if ($mobile) agencyNavCollapsed.set(true);

	function toggleNav() {
		agencyNavCollapsed.update((v) => !v);
	}

	/**
	 * Check for Portal JWT in URL params (returned from Portal after login)
	 * or in localStorage. If neither exists, redirect to Portal.
	 */
	function checkPortalAuth(): string | null {
		// Check URL for portal_token (Portal redirects back with this)
		const urlParams = new URLSearchParams(window.location.search);
		const portalToken = urlParams.get('portal_token');
		if (portalToken) {
			localStorage.setItem('portal_token', portalToken);
			// Clean URL
			urlParams.delete('portal_token');
			const cleanUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
			window.history.replaceState({}, '', cleanUrl);
			return portalToken;
		}

		// Check localStorage
		return localStorage.getItem('portal_token');
	}

	/**
	 * The login callback appends ?activeOrgId=<internal org uuid> when this login resolved
	 * a launch org (#79). Read it from window.location rather than the page store: it is a
	 * one-shot signal we strip immediately after use, and checkPortalAuth() above may have
	 * already rewritten the URL via replaceState, which the page store does not observe.
	 */
	function readLaunchOrgId(): string | null {
		if (typeof window === 'undefined') return null;
		try {
			return new URLSearchParams(window.location.search).get(ACTIVE_ORG_PARAM);
		} catch (error) {
			console.error('Failed to read launch organization param', error);
			return null;
		}
	}

	/** Drop the one-shot launch signal so a refresh cannot re-apply a now-stale choice. */
	function stripLaunchOrgParam() {
		if (typeof window === 'undefined' || typeof history === 'undefined') return;
		try {
			const url = new URL(window.location.href);
			if (!url.searchParams.has(ACTIVE_ORG_PARAM)) return;
			url.searchParams.delete(ACTIVE_ORG_PARAM);
			history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
		} catch (error) {
			console.error('Failed to clear launch organization param', error);
		}
	}

	function redirectToPortal() {
		const returnUrl = encodeURIComponent(window.location.href);
		window.location.href = `${PORTAL_LOGIN_URL}?redirect=${returnUrl}`;
	}

	onMount(async () => {
		// Hide OpenWebUI's default sidebar on Atrium routes
		showSidebar.set(false);

		// Check for Portal token (future: portal.orbit.example handles auth)
		const portalToken = checkPortalAuth();

		// TODO: Re-enable portal redirect once portal.orbit.example is live with Clerk
		// For now, accept any valid session (Portal token OR OpenWebUI token)
		authChecking = false;
		loaded = true;

		// Use Portal token first, fall back to OpenWebUI token
		const token = portalToken || (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
		authToken = token;

		if (!token) {
			orgLoading = false;
			return;
		}

		// Read the launch signal BEFORE resolving, strip it after — order matters: the
		// resolver needs the param, and stripping first would lose it on a slow fetch.
		const launchOrgId = readLaunchOrgId();

		try {
			const organization = await getOrganizationForUser(token, launchOrgId);
			if (organization) {
				activeOrg.set(organization);
			} else {
				// No org exists — create a default one
				try {
					const created = await createOrganization(token, {
						name: 'My Organization',
						slug: 'default'
					});
					activeOrg.set(created.organization);
				} catch (createError) {
					console.error('Failed to create default organization', createError);
				}
			}
		} catch (error) {
			console.error('Failed to resolve organization context', error);
		} finally {
			stripLaunchOrgParam();
			orgLoading = false;
		}
	});

	// Pages that use full-screen overlays (no nav chrome)
	$: isOverlay = $page.url.pathname.includes('/voice') || $page.url.pathname.includes('/onboarding');
</script>

<svelte:head>
	<title>
		{$WEBUI_NAME}
	</title>
</svelte:head>

{#if authChecking}
	<!-- Redirecting to Portal for authentication -->
	<div class="flex items-center justify-center w-full h-screen bg-[#0f0f13]">
		<div class="text-center">
			<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6961ff] mx-auto mb-4"></div>
			<p class="text-white/60 text-sm">Redirecting to login...</p>
		</div>
	</div>
{:else if loaded}
	<div
		class="relative flex w-full h-screen max-h-[100dvh] transition-all duration-200 ease-in-out {$showSidebar
			? 'md:max-w-[calc(100%-var(--sidebar-width))]'
			: ''} max-w-full bg-[#0f0f13]"
	>
		<!-- Mobile Nav Overlay (must be BEFORE nav so nav renders on top) -->
		{#if $mobile && !$agencyNavCollapsed && !isOverlay}
			<button
				class="fixed inset-0 bg-black/50 z-40"
				on:click={() => agencyNavCollapsed.set(true)}
				aria-label="Close navigation"
			></button>
		{/if}

		<!-- Atrium Sidebar Nav (hidden on overlay pages) -->
		{#if !isOverlay}
			<div class="{$mobile ? 'fixed inset-y-0 left-0 z-50' : ''}">
				<AgencyNav collapsed={$agencyNavCollapsed} onToggle={toggleNav} onNavigate={() => { if ($mobile) agencyNavCollapsed.set(true); }} />
			</div>
		{/if}

		<!-- Main Content Area -->
		<div class="flex-1 flex flex-col min-w-0 h-full">
			<!-- Top Bar -->
			{#if !isOverlay}
				<nav class="px-4 pt-2 pb-1 flex items-center gap-2 shrink-0 border-b border-white/5">
					<!-- Atrium nav toggle (when collapsed or mobile) -->
					{#if $agencyNavCollapsed}
						<button
							class="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
							on:click={toggleNav}
						>
							<span class="material-symbols-outlined text-[20px]">menu</span>
						</button>
					{/if}

					<!-- Breadcrumb / Page title -->
					<div class="flex items-center gap-2 text-sm">
						<a href="/atrium" class="text-slate-500 hover:text-white transition">Atrium</a>
						{#if $page.url.pathname !== '/atrium'}
							<span class="text-slate-600">/</span>
							<span class="text-slate-300 capitalize">
								{$page.url.pathname.split('/').pop()}
							</span>
						{/if}
					</div>

					<div class="ml-auto flex items-center gap-2">
						<!-- Multi-org users only; hides itself otherwise. -->
						<OrgSwitcher token={authToken} />
						<button
							class="relative p-2 rounded-lg transition-all {notificationPanelOpen ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}"
							on:click={() => (notificationPanelOpen = !notificationPanelOpen)}
						>
							<span class="material-symbols-outlined text-[20px]">notifications</span>
							{#if $unreadCount > 0}
								<span class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
									{$unreadCount}
								</span>
							{/if}
						</button>
					</div>
				</nav>
			{/if}

			<!-- Notification Slide-out Panel -->
			{#if notificationPanelOpen}
				<button
					class="fixed inset-0 z-30 bg-black/30"
					on:click={() => (notificationPanelOpen = false)}
					aria-label="Close notifications"
				></button>
				<div class="fixed top-0 right-0 z-40 h-full w-full max-w-md shadow-2xl shadow-black/50 border-l border-white/5 bg-[#0f0f13] overflow-y-auto">
					<NotificationCenter on:close={() => (notificationPanelOpen = false)} />
				</div>
			{/if}

			<!-- Page Content -->
			<div
				class="flex-1 overflow-y-auto {isOverlay ? '' : 'p-4 md:p-6'}"
				id="atrium-container"
			>
				{#if orgLoading}
					<div class="h-full min-h-[240px] flex items-center justify-center text-slate-400">
						<div class="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white mr-3"></div>
						Resolving organization context...
					</div>
				{:else}
					<slot />
				{/if}
			</div>
		</div>


	</div>
{/if}
