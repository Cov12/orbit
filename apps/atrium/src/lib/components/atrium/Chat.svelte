<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import {
		activeDeptId,
		activeDept,
		proposals,
		type Proposal,
		activeOrg,
		activeOrgId
	} from '$lib/stores/atrium';
	import { chats as openWebUIChats, user } from '$lib/stores';
	import {
		sendChiefChat,
		sendDepartmentChat,
		getEmployeeTabs,
		getOrgSubAccounts,
		selectOrgSubAccount,
		NEW_SUBACCOUNT_ID_PARAM,
		SUBACCOUNT_CREATED_PARAM,
		type Proposal as ApiProposal,
		type EmployeeTab,
		type OrgSubAccount
	} from '$lib/apis/atrium';
	import { createNewChat, getChatById, getChatList, updateChatById } from '$lib/apis/chats';
	import {
		createAtriumChatPayload,
		isAtriumChatForScope,
		openWebUIChatToAgencyMessages
	} from '$lib/utils/atriumChatHistory';
	import type {
		AtriumChatMetadata,
		AtriumChatMessage,
		OpenWebUIChatPayload
	} from '$lib/utils/atriumChatHistory';
	import FirstBusinessNudge from '$lib/components/atrium/FirstBusinessNudge.svelte';
	import GlassPanel from '$lib/components/atrium/shared/GlassPanel.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import SubAccountScopeSelector from '$lib/components/atrium/SubAccountScopeSelector.svelte';
	import VoiceMode from '$lib/components/atrium/VoiceMode.svelte';

	let voiceModeOpen = false;

	type ChatMessage = AtriumChatMessage;

	interface PersistedAtriumChat {
		id: string;
		title: string;
		subtitle: string;
		icon: string;
		active: boolean;
		time: string;
		atrium: AtriumChatMetadata;
		chat: OpenWebUIChatPayload;
	}

	interface OpenWebUIChatResponse {
		id: string;
		title: string;
		chat: OpenWebUIChatPayload;
		created_at: number;
		updated_at: number;
		time_range?: string;
	}

	let messageInput = '';
	let sidebarOpen = false;
	let loading = false;
	let messages: ChatMessage[] = [];
	let chatId: string | undefined;
	let employeeTabs: EmployeeTab[] = [];
	let selectedEmployee: EmployeeTab | null = null;
	let loadingTabs = false;
	let subAccounts: OrgSubAccount[] = [];
	let activeSubAccountId: string | null = null;
	let loadingSubAccounts = false;
	let selectingSubAccount = false;
	let lastLoadedOrgId: string | null = null;
	let subAccountsSyncOk = false;
	let subAccountsPublicOrigin: string | null = null;
	let loadingThreads = false;
	let threadsError = '';
	let searchQuery = '';
	let threads: PersistedAtriumChat[] = [];

	// Single concierge front door (#45 collapse): every chat turn flows to the one
	// Orbit Assistant via the chief endpoint → Conductor bridge. Per-department routing
	// was removed when Atrium became a thin transport in front of Conductor. The
	// `departments` store still backs the dashboards (DeptConfig / ControlCenter).
	const personas = [
		{ id: 'chief', label: 'Orbit Assistant', icon: 'smart_toy', type: 'chief' as const }
	];

	$: if (!$activeDeptId) $activeDeptId = 'chief';
	$: filteredThreads = threads.filter((thread) =>
		`${thread.title} ${thread.subtitle}`.toLowerCase().includes(searchQuery.trim().toLowerCase())
	);

	// Return hop from Portal's "create a sub-account" page (Phase 1.4). The auth callback
	// force-synced the mirror and 303'd back here with ?subAccountCreated=1, so the new
	// sub-account is in the list but NOTHING is selected yet. Detected here at init (before
	// any reactive load fires) and consumed by the first load that has an org id.
	let pendingSubAccountReturn: { newSubAccountId: string | null } | null =
		detectSubAccountCreatedReturn();

	function detectSubAccountCreatedReturn() {
		if (typeof window === 'undefined') return null;
		try {
			const params = new URLSearchParams(window.location.search);
			const marker = params.get(SUBACCOUNT_CREATED_PARAM);
			// Same marker semantics as the callback: present and not an explicit falsy string.
			if (marker === null || ['', '0', 'false', 'no', 'off'].includes(marker.trim().toLowerCase()))
				return null;
			return { newSubAccountId: params.get(NEW_SUBACCOUNT_ID_PARAM) };
		} catch (error) {
			console.error('Failed to read sub-account return params', error);
			return null;
		}
	}

	// Load employee tabs + sub-account scope + persisted chats on mount.
	onMount(async () => {
		await Promise.all([loadEmployeeTabs(), loadSubAccounts()]);
		await applySubAccountCreatedReturn();
		await loadAtriumChats();
	});

	// The "New Chat" nav link lands here as /atrium/chat?new=1. afterNavigate fires on the
	// initial load AND on same-route query changes, so tapping it while already on the chat
	// still starts a fresh thread. The param is stripped so a reload doesn't re-trigger it.
	afterNavigate(() => {
		if (typeof window === 'undefined') return;
		if (!new URLSearchParams(window.location.search).get('new')) return;
		startNewChat();
		try {
			const url = new URL(window.location.href);
			url.searchParams.delete('new');
			history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
		} catch (error) {
			console.error('Failed to clear new-chat param', error);
		}
	});

	$: if ($activeOrgId && $activeOrgId !== lastLoadedOrgId) {
		lastLoadedOrgId = $activeOrgId;
		loadEmployeeTabs();
		loadSubAccounts().then(applySubAccountCreatedReturn).finally(loadAtriumChats);
	}

	async function loadEmployeeTabs() {
		const authToken = getAuthToken();
		const userId = $user?.id;
		if (!authToken || !userId || !$activeOrgId) return;

		loadingTabs = true;
		try {
			const response = await getEmployeeTabs(authToken, $activeOrgId, userId, true);
			employeeTabs = response.tabs;
		} catch (error) {
			console.error('Failed to load employee tabs', error);
		} finally {
			loadingTabs = false;
		}
	}

	async function loadSubAccounts() {
		const authToken = getAuthToken();
		if (!authToken || !$activeOrgId) {
			subAccounts = [];
			activeSubAccountId = null;
			subAccountsSyncOk = false;
			return;
		}

		loadingSubAccounts = true;
		try {
			const response = await getOrgSubAccounts(authToken, $activeOrgId);
			subAccounts = response.subAccounts;
			activeSubAccountId = response.activeSubAccountId;
			subAccountsSyncOk = response.syncOk === true;
			subAccountsPublicOrigin = response.publicOrigin ?? null;
		} catch (error) {
			subAccounts = [];
			activeSubAccountId = null;
			// An empty list from a FAILED fetch must never look like "this org has none" —
			// clearing syncOk keeps the onboarding nudge silent on this path.
			subAccountsSyncOk = false;
			console.error('Failed to load sub-account scope', error);
		} finally {
			loadingSubAccounts = false;
		}
	}

	/**
	 * Select the sub-account the user just created in Portal, then clean the URL.
	 *
	 * Entirely best-effort: any failure leaves the user in business scope rather than
	 * throwing, and the marker params are stripped either way so a refresh does not re-run it.
	 */
	async function applySubAccountCreatedReturn() {
		const pending = pendingSubAccountReturn;
		if (!pending || !$activeOrgId) return;
		pendingSubAccountReturn = null;

		const authToken = getAuthToken();
		if (!authToken) {
			stripSubAccountReturnParams();
			return;
		}

		try {
			// Re-fetch rather than trusting the list already in hand: the callback's force-sync
			// is what put the new sub-account in the mirror, and this component may have loaded
			// before that landed.
			const response = await getOrgSubAccounts(authToken, $activeOrgId);
			subAccounts = response.subAccounts;
			activeSubAccountId = response.activeSubAccountId;
			subAccountsSyncOk = response.syncOk === true;
			subAccountsPublicOrigin = response.publicOrigin ?? null;

			// Prefer the id the return path carried. Otherwise a single sub-account is
			// unambiguously the new one; with several and no id we cannot know which, so we
			// leave the choice to the user instead of guessing a scope.
			const target =
				subAccounts.find((subAccount) => subAccount.id === pending.newSubAccountId)?.id ??
				(subAccounts.length === 1 ? subAccounts[0].id : null);
			if (!target || target === activeSubAccountId) return;

			const selection = await selectOrgSubAccount(authToken, $activeOrgId, target);
			activeSubAccountId = selection.selected;
			startNewChat();
			await loadAtriumChats();
		} catch (error) {
			console.error('Failed to select newly created sub-account', error);
		} finally {
			stripSubAccountReturnParams();
		}
	}

	function stripSubAccountReturnParams() {
		if (typeof window === 'undefined' || typeof history === 'undefined') return;
		try {
			const url = new URL(window.location.href);
			url.searchParams.delete(SUBACCOUNT_CREATED_PARAM);
			url.searchParams.delete(NEW_SUBACCOUNT_ID_PARAM);
			history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
		} catch (error) {
			console.error('Failed to clear sub-account return params', error);
		}
	}

	async function handleSubAccountSelect(event: CustomEvent<{ subAccountId: string | null }>) {
		const authToken = getAuthToken();
		if (!authToken || !$activeOrgId || selectingSubAccount) return;

		selectingSubAccount = true;
		try {
			const response = await selectOrgSubAccount(
				authToken,
				$activeOrgId,
				event.detail.subAccountId
			);
			activeSubAccountId = response.selected;
			startNewChat();
			await loadAtriumChats();
		} catch (error) {
			console.error('Failed to update sub-account scope', error);
		} finally {
			selectingSubAccount = false;
		}
	}

	async function loadAtriumChats() {
		const authToken = getAuthToken();
		if (!authToken || !$activeOrgId) return;

		loadingThreads = true;
		threadsError = '';
		try {
			const chatList = await getChatList(authToken, 1, false, false);
			openWebUIChats.set(chatList);
			const detailedChats = await Promise.all(
				(chatList as Array<{ id: string }>).map(async (item) => {
					try {
						return (await getChatById(authToken, item.id)) as OpenWebUIChatResponse | null;
					} catch (error) {
						console.error('Failed to load chat details', item.id, error);
						return null;
					}
				})
			);
			const scope = { org_id: $activeOrgId, sub_account_id: currentSubAccountId() };
			threads = detailedChats
				.filter((chat): chat is OpenWebUIChatResponse => Boolean(chat?.chat))
				.filter((chat) => isAtriumChatForScope(chat.chat, scope))
				.map(chatResponseToThread);
		} catch (error) {
			threadsError = 'Unable to load recent Atrium chats.';
			console.error('Failed to load Atrium chats', error);
		} finally {
			loadingThreads = false;
		}
	}

	function startNewChat() {
		messages = [];
		chatId = undefined;
		threads = threads.map((item) => ({ ...item, active: false }));
	}

	function selectEmployee(tab: EmployeeTab) {
		selectedEmployee = tab;
		startNewChat();
	}

	function clearEmployeeSelection() {
		selectedEmployee = null;
	}

	async function selectThread(thread: PersistedAtriumChat) {
		const authToken = getAuthToken();
		if (!authToken) return;

		loadingThreads = true;
		threadsError = '';
		try {
			const response = (await getChatById(authToken, thread.id)) as OpenWebUIChatResponse;
			if (!response?.chat?.atrium) throw new Error('Selected chat is missing Atrium metadata');
			const scope = { org_id: $activeOrgId, sub_account_id: currentSubAccountId() };
			if (!isAtriumChatForScope(response.chat, scope))
				throw new Error('Selected chat is outside the active Atrium scope');

			chatId = response.id;
			messages = openWebUIChatToAgencyMessages(response.chat);
			rehydrateContext(response.chat.atrium);
			threads = threads.map((item) => ({ ...item, active: item.id === response.id }));
			sidebarOpen = false;
		} catch (error) {
			threadsError = 'Unable to open that Atrium chat.';
			console.error('Failed to open Atrium chat', error);
		} finally {
			loadingThreads = false;
		}
	}

	// Derived chat target info. `chatTargetName` is the AGENT identity — it is what
	// gets persisted as the message persona / metadata agent_name, so it must not
	// pick up the sub-account name.
	$: chatTargetName = selectedEmployee?.agent_name ?? $activeDept?.name ?? 'Orbit Assistant';
	// Which CLIENT (sub-account) the user is scoped to. Null = business scope, in
	// which case we show the business/org name.
	$: activeSubAccountName = subAccounts.find((s) => s.id === activeSubAccountId)?.name ?? null;
	$: scopeDisplayName = activeSubAccountName ?? $activeOrg?.name ?? 'Business';
	// Header / target label prefers the client we are scoped to over the agent name.
	$: chatTargetDisplayName = activeSubAccountName ?? chatTargetName;
	$: chatTargetIcon =
		selectedEmployee?.agent_icon ??
		(personas.find((p) => p.id === $activeDeptId)?.icon || 'psychology');

	function getAuthToken() {
		return (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
	}

	function currentSubAccountId(): string | null {
		// The sub-account scope selector is the active tenant source on atrium-prod.
		// Do not fall back to org settings here; those can lag after a scope switch.
		return activeSubAccountId;
	}

	function buildAtriumMetadata(
		source: AtriumChatMetadata['source'] = 'atrium'
	): AtriumChatMetadata {
		const targetDept = selectedEmployee?.department ?? $activeDeptId ?? 'chief';
		const targetType = selectedEmployee
			? 'employee'
			: targetDept === 'chief'
				? 'chief'
				: 'department';
		return {
			atrium: true,
			source,
			org_id: $activeOrgId,
			sub_account_id: currentSubAccountId(),
			department_slug: targetDept,
			target_type: targetType,
			target_id: selectedEmployee?.agent_id ?? targetDept,
			employee_tab_id: selectedEmployee?.id ?? null,
			agent_id: selectedEmployee?.agent_id ?? null,
			agent_name: selectedEmployee?.agent_name ?? chatTargetName
		};
	}

	function chatResponseToThread(response: OpenWebUIChatResponse): PersistedAtriumChat {
		const agencyMessages = openWebUIChatToAgencyMessages(response.chat);
		const lastMessage = agencyMessages.at(-1);
		const metadata = response.chat.atrium;
		return {
			id: response.id,
			title: response.title || response.chat.title || 'Atrium Chat',
			subtitle: lastMessage?.content || 'No messages yet',
			icon: metadata.target_type === 'employee' ? 'person' : 'smart_toy',
			active: response.id === chatId,
			time: response.time_range ?? '',
			atrium: metadata,
			chat: response.chat
		};
	}

	function rehydrateContext(metadata: AtriumChatMetadata) {
		$activeDeptId = metadata.department_slug ?? 'chief';
		if (metadata.target_type === 'employee') {
			selectedEmployee =
				employeeTabs.find(
					(tab) => tab.id === metadata.employee_tab_id || tab.agent_id === metadata.agent_id
				) ?? null;
		} else {
			selectedEmployee = null;
		}
	}

	function formatTime() {
		return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	}

	function mapApiProposal(apiProposal: ApiProposal): Proposal {
		const mappedStatus: Proposal['status'] =
			apiProposal.status === 'pending' ||
			apiProposal.status === 'approved' ||
			apiProposal.status === 'rejected'
				? apiProposal.status
				: 'rejected';

		return {
			id: apiProposal.id,
			title: apiProposal.title,
			dept: apiProposal.department_id || 'chief',
			description: apiProposal.description,
			status: mappedStatus,
			createdAt: 'Just now',
			priority: apiProposal.risk_level,
			actions: [
				{ label: 'Approve', type: 'primary' },
				{ label: 'Reject', type: 'danger' },
				{ label: 'View Details', type: 'secondary' }
			] as Proposal['actions']
		};
	}

	async function ensurePersistedChat(
		authToken: string,
		nextMessages: ChatMessage[],
		metadata: AtriumChatMetadata
	) {
		if (chatId) return chatId;

		const initialPayload = createAtriumChatPayload(nextMessages, metadata);
		const createdChat = (await createNewChat(
			authToken,
			initialPayload,
			null
		)) as OpenWebUIChatResponse | null;
		if (!createdChat?.id) throw new Error('Open WebUI did not return a chat id');
		chatId = createdChat.id;
		return createdChat.id;
	}

	async function persistChat(
		authToken: string,
		nextMessages: ChatMessage[],
		metadata: AtriumChatMetadata
	) {
		if (!chatId) return;
		await updateChatById(authToken, chatId, createAtriumChatPayload(nextMessages, metadata));
		await loadAtriumChats();
	}

	async function ensureVoiceChat(): Promise<string | null> {
		const authToken = getAuthToken();
		if (!authToken || !$activeOrgId) return null;
		return ensurePersistedChat(authToken, messages, buildAtriumMetadata('atrium_voice'));
	}

	async function persistVoiceTurn(turn: {
		transcription: string;
		response: string;
		department?: string;
	}) {
		const authToken = getAuthToken();
		if (!authToken || !$activeOrgId) return;

		const metadata = buildAtriumMetadata('atrium_voice');
		const nextMessages: ChatMessage[] = [
			...messages,
			{
				id: crypto.randomUUID(),
				role: 'user',
				content: turn.transcription,
				time: formatTime()
			},
			{
				id: crypto.randomUUID(),
				role: 'ai',
				persona: turn.department ?? chatTargetName,
				content: turn.response,
				time: formatTime()
			}
		];

		messages = nextMessages;
		await ensurePersistedChat(authToken, nextMessages, metadata);
		await persistChat(authToken, nextMessages, metadata);
	}

	async function sendMessage() {
		const trimmed = messageInput.trim();
		if (!trimmed || loading) return;

		const authToken = getAuthToken();
		const currentUserId = $user?.id ?? 'anonymous';
		if (!authToken || !$activeOrgId) return;

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: trimmed,
			time: formatTime()
		};

		const messagesWithUser = [...messages, userMessage];
		const metadata = buildAtriumMetadata();
		messages = messagesWithUser;
		messageInput = '';
		loading = true;

		try {
			const persistedChatId = await ensurePersistedChat(authToken, messagesWithUser, metadata);
			const conversation_history = messagesWithUser
				.slice(-10)
				.map((msg) => ({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content }));

			const payload = {
				message: trimmed,
				user_id: currentUserId,
				chat_id: persistedChatId,
				conversation_history
			};

			const targetDept = selectedEmployee?.department ?? $activeDeptId;

			const response =
				targetDept === 'chief' || !targetDept
					? await sendChiefChat(authToken, $activeOrgId, payload)
					: await sendDepartmentChat(authToken, $activeOrgId, targetDept, payload);

			const messagesWithAssistant = [
				...messagesWithUser,
				{
					id: crypto.randomUUID(),
					role: 'ai' as const,
					persona: chatTargetName,
					content: response.content,
					time: formatTime()
				}
			];
			messages = messagesWithAssistant;
			await persistChat(authToken, messagesWithAssistant, metadata);

			if (response.proposals?.length) {
				const mapped = response.proposals.map(mapApiProposal);
				proposals.update((existing) => {
					const existingById = new Map(existing.map((item) => [item.id, item]));
					for (const item of mapped) existingById.set(item.id, item);
					return Array.from(existingById.values());
				});
			}
		} catch (error) {
			const failedMessages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'ai' as const,
					persona: chatTargetName,
					content: 'Sorry — I hit an error sending that message. Please try again.',
					time: formatTime()
				}
			];
			messages = failedMessages;
			if (chatId) {
				try {
					await persistChat(authToken, failedMessages, metadata);
				} catch (persistError) {
					console.error('Failed to persist failed Atrium chat turn', persistError);
				}
			}
			console.error(error);
		} finally {
			loading = false;
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		sendMessage();
	}

	$: currentPersonaLabel = chatTargetDisplayName;
	// Composer placeholder names the ASSISTANT you're messaging, not the client
	// scope — "Message <client>" reads like messaging the contact in a CRM.
	$: placeholder = loading
		? `Waiting for ${chatTargetName}...`
		: `Message ${chatTargetName}...`;

	// Department colors for avatar backgrounds
	const DEPT_COLORS: Record<string, string> = {
		ceo: '#6961ff',
		chief: '#6961ff',
		employee: '#20B2AA',
		manager: '#FFB347',
		sales: '#4F46E5',
		customer: '#10B981',
		backoffice: '#F59E0B',
		default: '#888'
	};

	function getDeptColor(role: string): string {
		return DEPT_COLORS[role?.toLowerCase()] || DEPT_COLORS.default;
	}

	function getInitials(name: string): string {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}
</script>

<div
	data-testid="atrium-chat-page"
	class="w-full h-full flex bg-gradient-to-br from-[#2d2b42] to-[#0f0f13] relative overflow-hidden"
>
	<!-- Background Decor -->
	<div class="absolute inset-0 pointer-events-none overflow-hidden">
		<div
			class="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-[#6961ff]/20 rounded-full blur-[120px] mix-blend-screen opacity-40"
		></div>
		<div
			class="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-[#20B2AA]/10 rounded-full blur-[100px] mix-blend-screen opacity-30"
		></div>
	</div>

	<!-- Mobile sidebar overlay -->
	{#if sidebarOpen}
		<button
			class="fixed inset-0 bg-black/50 z-30 md:hidden"
			on:click={() => (sidebarOpen = false)}
			aria-label="Close sidebar"
		></button>
	{/if}

	<!-- Thread Sidebar -->
	<aside
		data-testid="atrium-thread-sidebar"
		class="fixed md:relative w-[280px] lg:w-[320px] flex-shrink-0 flex flex-col h-full z-40 md:z-20 transition-transform duration-200 md:translate-x-0"
		class:translate-x-0={sidebarOpen}
		class:-translate-x-full={!sidebarOpen}
		style="background: rgba(15, 15, 20, 0.95); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-right: 1px solid rgba(255, 255, 255, 0.08);"
	>
		<div class="h-14 flex items-center px-4 gap-3 border-b border-white/[0.08]">
			<div class="flex gap-2">
				<div class="w-3 h-3 rounded-full bg-[#FF5F57]"></div>
				<div class="w-3 h-3 rounded-full bg-[#FEBC2E]"></div>
				<div class="w-3 h-3 rounded-full bg-[#28C840]"></div>
			</div>
			<div class="text-xs font-semibold tracking-wide text-white/50 ml-2 uppercase">Atrium</div>
			<button
				class="ml-auto md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-white/50"
				on:click={() => (sidebarOpen = false)}
			>
				<MaterialIcon icon="close" size={20} />
			</button>
		</div>

		<div class="px-3 py-3">
			<div class="relative">
				<span
					class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[18px]"
					>search</span
				>
				<input
					data-testid="atrium-thread-search"
					bind:value={searchQuery}
					class="w-full bg-white/5 border border-white/5 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#6961ff]/50 focus:bg-white/10 transition-all"
					placeholder="Search threads..."
				/>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
			<!-- Team / Employees Section -->
			{#if employeeTabs.length > 0 || loadingTabs}
				<div
					class="px-3 py-2 text-xs font-medium text-white/40 uppercase tracking-wider mb-1 flex items-center gap-2"
				>
					<MaterialIcon icon="groups" size={14} />
					Team
					{#if employeeTabs.length > 0}
						<span class="text-white/30">({employeeTabs.length})</span>
					{/if}
				</div>
				{#if loadingTabs}
					<div class="flex items-center justify-center py-4">
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"
						></div>
					</div>
				{:else}
					{#each employeeTabs.filter((t) => t.is_visible) as tab}
						<button
							class="w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-left group transition-all
								{selectedEmployee?.id === tab.id
								? 'bg-[#6961ff]/20 border border-[#6961ff]/20'
								: 'hover:bg-white/5 border border-transparent'}"
							on:click={() => selectEmployee(tab)}
						>
							<div
								class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
								style="background-color: {getDeptColor(tab.department)}20; color: {getDeptColor(
									tab.department
								)}"
							>
								{#if tab.agent_icon}
									<span>{tab.agent_icon}</span>
								{:else}
									{getInitials(tab.agent_name)}
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-1">
									<h4
										class="text-sm font-medium text-white{selectedEmployee?.id === tab.id
											? ''
											: '/90'} truncate"
									>
										{tab.agent_name}
									</h4>
									{#if tab.is_pinned}
										<MaterialIcon icon="push_pin" size={12} class="text-[#6961ff] shrink-0" />
									{/if}
								</div>
								<p class="text-xs text-white/40 truncate capitalize">{tab.department}</p>
							</div>
							{#if (tab.message_count ?? 0) > 0}
								<span
									class="w-5 h-5 rounded-full bg-[#6961ff] text-[10px] text-white flex items-center justify-center flex-shrink-0"
								>
									{tab.message_count}
								</span>
							{/if}
						</button>
					{/each}
				{/if}
				<div class="border-b border-white/5 my-3"></div>
			{/if}

			<!-- Recent Threads -->
			<div class="px-3 py-2 text-xs font-medium text-white/40 uppercase tracking-wider mb-1">
				Recent
			</div>
			{#if loadingThreads}
				<div class="flex items-center justify-center py-4">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"
					></div>
				</div>
			{:else if threadsError}
				<div
					class="px-3 py-3 text-xs text-red-300/80 bg-red-500/10 rounded-lg border border-red-500/20"
				>
					{threadsError}
				</div>
			{:else if filteredThreads.length === 0}
				<div class="px-3 py-4 text-sm text-white/40">
					{searchQuery.trim() ? 'No matching Atrium chats.' : 'No recent Atrium chats yet.'}
				</div>
			{:else}
				{#each filteredThreads as thread}
					<button
						data-testid="atrium-recent-chat"
						data-chat-id={thread.id}
						class="w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-left group transition-all {thread.active
							? 'bg-[#6961ff]/20 border border-[#6961ff]/20'
							: 'hover:bg-white/5 border border-transparent'}"
						on:click={() => selectThread(thread)}
					>
						<div
							class="w-8 h-8 rounded-full {thread.active
								? 'bg-gradient-to-br from-indigo-500 to-purple-600'
								: 'bg-white/10'} flex items-center justify-center flex-shrink-0"
						>
							<MaterialIcon
								icon={thread.icon}
								size={16}
								class="text-white{thread.active ? '' : '/70'}"
							/>
						</div>
						<div class="flex-1 min-w-0">
							<h4 class="text-sm font-medium text-white{thread.active ? '' : '/90'} truncate">
								{thread.title}
							</h4>
							<p class="text-xs {thread.active ? 'text-[#6961ff]/80' : 'text-white/40'} truncate">
								{thread.subtitle}
							</p>
						</div>
						{#if thread.time}
							<span class="text-[10px] text-white/30 whitespace-nowrap flex-shrink-0"
								>{thread.time}</span
							>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	</aside>

	<!-- Main Chat Area -->
	<main class="flex-1 flex flex-col relative z-10 min-w-0">
		<!-- Top bar with hamburger + scope selector + persona switcher -->
		<div
			class="absolute top-0 left-0 right-0 z-20 flex flex-col items-center gap-2 py-3 px-3 sm:px-6 bg-gradient-to-b from-[rgba(20,20,25,0.9)] to-transparent min-h-20 sm:min-h-24 pointer-events-none"
		>
			<!-- Mobile hamburger -->
			<button
				class="pointer-events-auto absolute left-3 top-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all md:hidden"
				on:click={() => (sidebarOpen = true)}
			>
				<MaterialIcon icon="menu" size={24} />
			</button>

			<SubAccountScopeSelector
				{subAccounts}
				{activeSubAccountId}
				loading={loadingSubAccounts}
				disabled={loading || selectingSubAccount}
				publicOrigin={subAccountsPublicOrigin}
				on:select={handleSubAccountSelect}
			/>

			<FirstBusinessNudge
				orgId={$activeOrgId}
				{subAccounts}
				syncOk={subAccountsSyncOk}
				publicOrigin={subAccountsPublicOrigin}
			/>

			<div
				class="bg-[#1c1c21]/80 backdrop-blur-md rounded-xl p-1 inline-flex shadow-lg ring-1 ring-white/10 pointer-events-auto overflow-x-auto max-w-[calc(100vw-6rem)] sm:max-w-none scrollbar-hide"
			>
				{#if selectedEmployee}
					<!-- Show selected employee with back button -->
					<button
						class="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px] text-white/60 hover:text-white"
						on:click={clearEmployeeSelection}
					>
						<MaterialIcon icon="arrow_back" size={18} />
						<span class="hidden sm:inline">Back</span>
					</button>
					<div
						class="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-[#6961ff] text-white shadow-sm flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px]"
					>
						{#if selectedEmployee.agent_icon}
							<span class="text-lg">{selectedEmployee.agent_icon}</span>
						{:else}
							<MaterialIcon icon="person" size={18} />
						{/if}
						<span>{selectedEmployee.agent_name}</span>
						<span class="text-white/60 text-xs capitalize hidden sm:inline"
							>({selectedEmployee.department})</span
						>
					</div>
				{:else}
					<!-- Normal persona switcher -->
					{#each personas as persona}
						<button
							class="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[40px]
								{$activeDeptId === persona.id && !selectedEmployee
								? 'bg-[#6961ff] text-white shadow-sm'
								: 'text-white/60 hover:text-white'}"
							on:click={() => {
								$activeDeptId = persona.id;
								clearEmployeeSelection();
							}}
						>
							<MaterialIcon icon={persona.icon} size={18} />
							<span class="hidden sm:inline">{persona.label}</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Messages -->
		<div
			data-testid="atrium-chat-messages"
			class="flex-1 overflow-y-auto px-3 sm:px-6 md:px-12 pt-24 sm:pt-28 pb-28 sm:pb-32 flex flex-col gap-4 sm:gap-6"
		>
			<div class="flex justify-center">
				<span class="text-xs font-medium text-white/30 bg-white/5 px-3 py-1 rounded-full"
					>Today, 10:23 AM</span
				>
			</div>

			{#each messages as msg}
				{#if msg.role === 'ai'}
					<div
						data-testid="atrium-chat-message"
						data-role="ai"
						class="flex gap-2.5 sm:gap-4 items-start max-w-[95%] sm:max-w-[85%]"
					>
						<div
							class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg border border-white/10"
						>
							<MaterialIcon icon="smart_toy" size={18} class="text-white" />
						</div>
						<div class="flex flex-col gap-1 min-w-0">
							<span class="text-xs text-white/50 ml-1 font-medium">{msg.persona}</span>
							<div
								class="bg-[#2a2a35] text-slate-200 p-3 sm:p-4 rounded-2xl rounded-tl-none shadow-md border border-white/5 leading-relaxed text-sm sm:text-[15px] break-words"
							>
								<p>{msg.content}</p>
								{#if msg.dataCard}
									<div class="bg-black/20 rounded-xl p-3 border border-white/5 mt-3 mb-2">
										<div class="flex justify-between items-end mb-2 gap-2">
											<div class="text-xs text-white/60 truncate">{msg.dataCard.label}</div>
											<div
												class="text-base sm:text-lg font-bold text-[#20B2AA] flex items-center gap-1 flex-shrink-0"
											>
												{msg.dataCard.value}
												<MaterialIcon icon="arrow_upward" size={16} />
											</div>
										</div>
										<div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
											<div
												class="h-full bg-[#20B2AA] rounded-full"
												style="width: {msg.dataCard.progress}%"
											></div>
										</div>
										<div class="flex justify-between text-[10px] text-white/40 mt-1">
											{#each msg.dataCard.months as month}
												<span>{month}</span>
											{/each}
										</div>
									</div>
								{/if}
							</div>
							{#if msg.actions}
								<div class="flex flex-wrap gap-2 mt-1 ml-1">
									{#each msg.actions as action}
										<button
											class="px-3 py-2 min-h-[44px] rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-white/70 transition-colors"
										>
											{action}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<div
						data-testid="atrium-chat-message"
						data-role="user"
						class="flex gap-2.5 sm:gap-4 items-end justify-end max-w-[95%] sm:max-w-[85%] self-end"
					>
						<div class="flex flex-col gap-1 items-end min-w-0">
							<div
								class="bg-[#6961ff] text-white p-3 sm:p-4 rounded-2xl rounded-tr-none shadow-lg shadow-[#6961ff]/20 leading-relaxed text-sm sm:text-[15px] break-words"
							>
								{msg.content}
							</div>
							<span class="text-xs text-white/30 mr-1">Read {msg.time}</span>
						</div>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Input Area -->
		<div
			class="absolute bottom-0 left-0 right-0 px-3 sm:px-6 md:px-12 pb-4 sm:pb-6 pt-2 flex justify-center bg-gradient-to-t from-[#0f0f13] via-[#0f0f13]/80 to-transparent"
		>
			<form class="w-full max-w-3xl" on:submit={handleSubmit}>
				<GlassPanel
					opacity={0.7}
					blur={12}
					borderOpacity={0.1}
					class="w-full p-2 shadow-2xl flex items-end gap-1.5 sm:gap-2 ring-1 ring-white/10"
				>
					<button
						type="button"
						data-testid="atrium-new-chat"
						class="h-11 w-11 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all mb-0.5 flex-shrink-0"
						on:click={startNewChat}
					>
						<MaterialIcon icon="add_circle" />
					</button>
					<textarea
						data-testid="atrium-chat-input"
						bind:value={messageInput}
						class="flex-1 bg-transparent border-0 text-white placeholder-white/40 focus:ring-0 resize-none py-3 max-h-32 text-sm sm:text-base leading-normal min-w-0"
						{placeholder}
						rows="1"
						disabled={loading}
						on:keydown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								sendMessage();
							}
						}}
					></textarea>
					<div class="flex items-center gap-1.5 sm:gap-2 mb-0.5 flex-shrink-0">
						<button
							type="button"
							data-testid="atrium-voice-button"
							class="relative h-11 w-11 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all"
							on:click={() => (voiceModeOpen = true)}
						>
							<MaterialIcon icon="mic" class="text-[#20B2AA]" />
						</button>
						<button
							type="submit"
							data-testid="atrium-chat-send"
							disabled={loading || !messageInput.trim()}
							class="h-11 w-11 flex items-center justify-center rounded-xl bg-[#6961ff] hover:bg-[#5851d8] text-white transition-all shadow-lg shadow-[#6961ff]/20 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<MaterialIcon icon={loading ? 'hourglass_top' : 'arrow_upward'} size={20} />
						</button>
					</div>
				</GlassPanel>
			</form>
		</div>
	</main>
</div>

{#if voiceModeOpen}
	<VoiceMode
		onDismiss={() => (voiceModeOpen = false)}
		{selectedEmployee}
		subAccountName={scopeDisplayName}
		{chatId}
		ensureChat={ensureVoiceChat}
		onPersistTurn={persistVoiceTurn}
	/>
{/if}

<style>
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
