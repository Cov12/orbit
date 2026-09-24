<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { user } from '$lib/stores';
	import { activeDeptId, activeDept, activeOrgId } from '$lib/stores/atrium';
	import {
		voiceState as voiceStateStore,
		voiceSessionId,
		addVoiceTurn,
		voiceConfig
	} from '$lib/stores/voice';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';

	export let onDismiss: (() => void) | undefined = undefined;
	export let selectedEmployee: {
		id: string;
		agent_name: string;
		department: string;
		agent_icon?: string;
	} | null = null;
	/**
	 * Display name of the sub-account (client) the user is currently scoped to.
	 * Null means business scope, in which case we fall back to the employee /
	 * department / Chief AI name as before.
	 */
	export let subAccountName: string | null = null;
	export let chatId: string | undefined = undefined;
	export let ensureChat: (() => Promise<string | null>) | undefined = undefined;
	export let onPersistTurn:
		| ((turn: { transcription: string; response: string; department?: string }) => Promise<void>)
		| undefined = undefined;

	type ConnectionState = 'connected' | 'connecting' | 'disconnected';
	type VoiceErrorKind = 'tts' | 'stt' | 'connection' | 'mic' | 'auth' | 'generic';

	interface VoiceTurn {
		role: 'user' | 'ai';
		text: string;
		timestamp: number;
	}

	let mediaRecorder: MediaRecorder | null = null;
	let currentAudio: HTMLAudioElement | null = null;
	let conversationHistory: VoiceTurn[] = [];
	let ws: WebSocket | null = null;
	let reconnectAttempts = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let manualDisconnect = false;
	let connectionState: ConnectionState = 'disconnected';

	let lastTranscription = '';
	let lastResponse = '';
	let errorMessage = '';
	let errorKind: VoiceErrorKind = 'generic';
	let abortProcessing = false;
	let micFailed = false;
	let textInput = '';
	let pendingTranscription = '';

	const MAX_RECONNECT_ATTEMPTS = 3;

	/**
	 * Friendly error copy. Raw backend text (URLs, HTTP status codes, stack traces)
	 * never reaches the UI — it only goes to console.error for debugging.
	 */
	const VOICE_ERROR_COPY: Record<VoiceErrorKind, string> = {
		tts: "Voice reply couldn't be played. The text answer is still shown above.",
		stt: "Couldn't hear that clearly — please try again.",
		connection: 'Voice connection lost. Please try again.',
		mic: 'Microphone access is blocked. Enable mic permissions, or type your message below.',
		auth: 'Your session expired. Please sign in again to use voice.',
		generic: 'Something went wrong with voice. Please try again.'
	};

	function classifyVoiceError(raw: string): VoiceErrorKind {
		const text = raw.toLowerCase();

		// STT markers are checked before TTS because "speech-to-text" / "speech
		// recognition" also contain the substring "speech".
		if (
			text.includes('transcri') ||
			text.includes('stt') ||
			text.includes('whisper') ||
			text.includes('speech-to-text') ||
			text.includes('speech_to_text') ||
			text.includes('speech recognition')
		)
			return 'stt';

		if (
			text.includes('tts') ||
			text.includes('speech') ||
			text.includes('audio/speech') ||
			text.includes('audio playback')
		)
			return 'tts';

		if (
			text.includes('websocket') ||
			text.includes('connection') ||
			text.includes('connect') ||
			text.includes('disconnect') ||
			text.includes('network') ||
			text.includes('offline')
		)
			return 'connection';

		if (text.includes('microphone') || text.includes('getusermedia') || text.includes('notallowed'))
			return 'mic';

		if (
			text.includes('auth token') ||
			text.includes('unauthorized') ||
			text.includes('sign in') ||
			text.includes('organization context')
		)
			return 'auth';

		return 'generic';
	}

	/**
	 * Classify a raw error, surface friendly copy, and keep the raw text in the
	 * console only. Returns the classification so callers can decide whether the
	 * failure is fatal (a TTS-only failure is not — the text reply still stands).
	 */
	function reportVoiceError(rawError: unknown, context = 'Voice error'): VoiceErrorKind {
		console.error(context, rawError);
		const raw = rawError instanceof Error ? rawError.message : String(rawError ?? '');
		errorKind = classifyVoiceError(raw);
		errorMessage = VOICE_ERROR_COPY[errorKind];
		return errorKind;
	}

	function setFriendlyError(kind: VoiceErrorKind) {
		errorKind = kind;
		errorMessage = VOICE_ERROR_COPY[kind];
	}

	function clearVoiceError() {
		errorMessage = '';
		errorKind = 'generic';
	}

	const stateTitles: Record<string, string> = {
		idle: 'Tap to speak',
		connecting: 'Connecting...',
		listening: 'Listening...',
		processing: 'Thinking...',
		speaking: 'Speaking...',
		error: 'Voice unavailable'
	};

	// Who is answering: selected employee, else department, else Chief AI. Used for
	// transcript speaker labels, where the sub-account name would be wrong.
	$: agentName = selectedEmployee?.agent_name ?? $activeDept?.name ?? 'Chief AI';
	// Header label: which CLIENT (sub-account) the user is scoped to, when known.
	$: targetName = subAccountName ?? agentName;
	$: statusText = stateTitles[$voiceStateStore] ?? 'Tap to speak';
	$: subtitle = selectedEmployee
		? `${selectedEmployee.agent_name} (${selectedEmployee.department})`
		: `Connected to ${targetName}`;
	$: recentTurns = conversationHistory.slice(-4).reverse();

	function getAuthToken() {
		return (($user as { token?: string } | undefined)?.token ?? localStorage.token) as
			| string
			| undefined;
	}

	function setVoiceState(
		state: 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error'
	) {
		voiceStateStore.set(state);
	}

	function buildWsUrl() {
		const token = getAuthToken();
		const orgId = $activeOrgId;
		const deptSlug = $activeDeptId === 'chief' ? 'chief' : ($activeDeptId ?? 'chief');

		if (!token) throw new Error('Missing auth token. Please sign in again.');
		if (!orgId) throw new Error('Missing organization context.');

		const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
		const params = new URLSearchParams({
			token,
			org_id: orgId,
			department_slug: deptSlug ?? 'chief'
		});
		if (chatId) params.set('chat_id', chatId);
		return `${protocol}://${location.host}/api/atrium/voice/ws?${params.toString()}`;
	}

	function connectWebSocket() {
		if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

		try {
			connectionState = 'connecting';
			if ($voiceStateStore === 'idle' || $voiceStateStore === 'error') setVoiceState('connecting');

			ws = new WebSocket(buildWsUrl());

			ws.onopen = () => {
				reconnectAttempts = 0;
				connectionState = 'connected';
				if ($voiceStateStore === 'connecting' || $voiceStateStore === 'error')
					setVoiceState('idle');
			};

			ws.onmessage = async (event: MessageEvent) => {
				try {
					const payload = JSON.parse(event.data);
					handleWsMessage(payload);
				} catch (error) {
					console.error('Invalid WS message', error);
				}
			};

			ws.onclose = () => {
				connectionState = 'disconnected';
				ws = null;

				if (!manualDisconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
					reconnectAttempts += 1;
					const delay = reconnectAttempts * 1000;
					if (reconnectTimer) clearTimeout(reconnectTimer);
					reconnectTimer = setTimeout(() => {
						connectWebSocket();
					}, delay);
				} else if (!manualDisconnect) {
					setFriendlyError('connection');
					setVoiceState('error');
				}
			};

			ws.onerror = () => {
				connectionState = 'disconnected';
			};
		} catch (error) {
			reportVoiceError(error, 'Failed to open voice channel');
			connectionState = 'disconnected';
			setVoiceState('error');
		}
	}

	function disconnectWebSocket() {
		manualDisconnect = true;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		if (ws) {
			ws.close();
			ws = null;
		}
		connectionState = 'disconnected';
	}

	async function resolveChatId() {
		if (chatId) return chatId;
		if (!ensureChat) return null;
		const resolvedChatId = await ensureChat();
		if (resolvedChatId) chatId = resolvedChatId;
		return resolvedChatId;
	}

	function sendWsMessage(payload: Record<string, unknown>) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			setFriendlyError('connection');
			return false;
		}
		ws.send(JSON.stringify(payload));
		return true;
	}

	function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				const result = String(reader.result ?? '');
				const base64 = result.includes(',') ? result.split(',')[1] : result;
				resolve(base64);
			};
			reader.onerror = () => reject(new Error('Audio chunk conversion failed.'));
			reader.readAsDataURL(blob);
		});
	}

	function base64ToBlob(base64: string, mimeType = 'audio/mpeg') {
		const normalized = base64.includes(',') ? base64.split(',')[1] : base64;
		const binary = atob(normalized);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
		return new Blob([bytes], { type: mimeType });
	}

	async function startListening() {
		if ($voiceStateStore === 'processing' || $voiceStateStore === 'connecting') return;

		stopSpeaking();
		clearVoiceError();
		lastTranscription = '';
		abortProcessing = false;

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			connectWebSocket();
			errorMessage = 'Reconnecting…';
			errorKind = 'connection';
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = getRecorderMimeType();
			mediaRecorder = mimeType
				? new MediaRecorder(stream, { mimeType })
				: new MediaRecorder(stream);
			micFailed = false;

			mediaRecorder.ondataavailable = async (event: BlobEvent) => {
				if (event.data.size <= 0 || abortProcessing) return;
				const base64chunk = await blobToBase64(event.data);
				sendWsMessage({ type: 'audio_chunk', data: base64chunk });
			};

			mediaRecorder.onstop = () => {
				mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
				mediaRecorder = null;

				if (!abortProcessing) {
					setVoiceState('processing');
					resolveChatId()
						.then((resolvedChatId) => {
							sendWsMessage({
								type: 'end_audio',
								...(resolvedChatId ? { chat_id: resolvedChatId } : {})
							});
						})
						.catch((error) => {
							reportVoiceError(error, 'Failed to prepare voice chat');
							setVoiceState('error');
						});
				} else {
					setVoiceState('idle');
					abortProcessing = false;
				}
			};

			mediaRecorder.start(300);
			setVoiceState('listening');
		} catch (error) {
			micFailed = true;
			console.error('Microphone unavailable', error);
			setFriendlyError('mic');
			setVoiceState('idle');
		}
	}

	function getRecorderMimeType() {
		if (typeof MediaRecorder === 'undefined') return '';
		if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
		if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
		if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
		return '';
	}

	function stopListening() {
		if ($voiceStateStore !== 'listening') return;
		mediaRecorder?.stop();
	}

	function interruptListening() {
		if ($voiceStateStore !== 'listening') return;
		abortProcessing = true;
		mediaRecorder?.stop();
	}

	function stopSpeaking() {
		if (currentAudio) {
			currentAudio.pause();
			currentAudio.currentTime = 0;
			if (currentAudio.src.startsWith('blob:')) URL.revokeObjectURL(currentAudio.src);
			currentAudio = null;
		}
		if ($voiceStateStore === 'speaking') setVoiceState('idle');
	}

	function interruptVoiceMode() {
		if ($voiceStateStore === 'listening') {
			interruptListening();
			return;
		}

		if ($voiceStateStore === 'speaking') {
			stopSpeaking();
			return;
		}
	}

	async function playResponseAudio(base64Audio: string, mimeType?: string) {
		stopSpeaking();
		setVoiceState('speaking');

		const audioBlob = base64ToBlob(base64Audio, mimeType ?? 'audio/mpeg');
		const audioUrl = URL.createObjectURL(audioBlob);
		const audio = new Audio(audioUrl);

		audio.onended = () => {
			URL.revokeObjectURL(audioUrl);
			if (currentAudio === audio) currentAudio = null;
			setVoiceState('idle');
		};

		audio.onerror = (event) => {
			URL.revokeObjectURL(audioUrl);
			if (currentAudio === audio) currentAudio = null;
			// Playback failure is TTS-only: the text answer above still stands.
			console.error('Voice audio playback failed', event);
			setFriendlyError('tts');
			setVoiceState('idle');
		};

		currentAudio = audio;
		await audio.play();
	}

	async function handleWsMessage(payload: Record<string, unknown>) {
		const type = String(payload?.type ?? '');

		if (type === 'session' && typeof payload.session_id === 'string') {
			voiceSessionId.set(payload.session_id);
			return;
		}

		if (type === 'transcription') {
			const text = String(payload?.text ?? '').trim();
			if (!text) return;
			lastTranscription = text;
			pendingTranscription = text;
			addVoiceTurn('user', text, agentName);
			conversationHistory = [...conversationHistory, { role: 'user', text, timestamp: Date.now() }];
			return;
		}

		if (type === 'response') {
			const text = String(payload?.text ?? payload?.content ?? '').trim();
			if (!text) return;
			lastResponse = text;
			addVoiceTurn('ai', text, agentName);
			conversationHistory = [...conversationHistory, { role: 'ai', text, timestamp: Date.now() }];
			if (pendingTranscription && onPersistTurn) {
				const transcription = pendingTranscription;
				pendingTranscription = '';
				onPersistTurn({
					transcription,
					response: text,
					...(typeof payload?.department === 'string' ? { department: payload.department } : {})
				}).catch((error) => {
					console.error('Failed to persist voice turn', error);
					errorMessage = 'Voice response was not saved to chat history.';
					errorKind = 'generic';
				});
			}
			if (get(voiceConfig).autoPlayResponse === false) {
				setVoiceState('idle');
			}
			return;
		}

		if (type === 'audio') {
			const data = String(payload?.data ?? '');
			if (!data) return;
			await playResponseAudio(
				data,
				typeof payload?.mime_type === 'string' ? payload.mime_type : undefined
			);
			return;
		}

		if (type === 'error') {
			const kind = reportVoiceError(payload?.message ?? '', 'Voice backend error');
			if (kind === 'tts') {
				// TTS-only failure is non-fatal: keep the transcript and the text reply
				// on screen instead of dropping into the "Voice unavailable" state.
				if ($voiceStateStore !== 'listening') setVoiceState('idle');
			} else {
				setVoiceState('error');
			}
			return;
		}

		if (type === 'pong') {
			connectionState = 'connected';
			if ($voiceStateStore === 'connecting') setVoiceState('idle');
		}
	}

	async function submitTextFallback() {
		const content = textInput.trim();
		if (!content) return;
		clearVoiceError();
		lastTranscription = content;
		pendingTranscription = content;
		setVoiceState('processing');
		try {
			const resolvedChatId = await resolveChatId();
			const sent = sendWsMessage({
				type: 'text',
				content,
				...(resolvedChatId ? { chat_id: resolvedChatId } : {})
			});
			if (!sent) {
				setVoiceState('idle');
				return;
			}
			textInput = '';
		} catch (error) {
			reportVoiceError(error, 'Failed to prepare voice chat');
			setVoiceState('error');
		}
	}

	function dismiss() {
		interruptVoiceMode();
		if (onDismiss) {
			onDismiss();
		} else {
			goto('/atrium');
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') dismiss();
	}

	onMount(() => {
		manualDisconnect = false;
		connectWebSocket();
	});

	onDestroy(() => {
		if ($voiceStateStore === 'listening') {
			abortProcessing = true;
			mediaRecorder?.stop();
		}
		stopSpeaking();
		disconnectWebSocket();
		voiceSessionId.set(null);
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div
	class="absolute inset-0 z-50 flex flex-col items-center justify-start overflow-y-auto bg-black/40 backdrop-blur-xl px-4 py-6 sm:py-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-0"
>
	<!-- `sm:my-auto` keeps the desktop layout vertically centred without clipping the
	     top of the panel when it is taller than the viewport. On mobile everything
	     (transcript, error banner, controls) stacks in normal flow and scrolls. -->
	<div class="flex flex-col items-center justify-center w-full max-w-2xl relative sm:my-auto">
		<div
			class="text-xs sm:text-sm text-[#20B2AA]/90 tracking-wide uppercase mb-4 sm:mb-6 px-3 py-1.5 rounded-full border border-[#20B2AA]/25 bg-[#1c1c21]/70 backdrop-blur-md flex items-center gap-2"
		>
			<span
				class={`inline-block w-2 h-2 rounded-full ${
					connectionState === 'connected'
						? 'bg-emerald-400'
						: connectionState === 'connecting'
							? 'bg-amber-300'
							: 'bg-rose-400'
				}`}
			></span>
			<span>Voice Channel: {targetName}</span>
		</div>

		<!-- Orb -->
		<div
			class="relative flex items-center justify-center w-[200px] h-[200px] sm:w-[260px] sm:h-[260px] md:w-[300px] md:h-[300px] mb-8 sm:mb-10"
		>
			<div class="absolute inset-0 rounded-full bg-[#20B2AA]/20 blur-[80px] animate-pulse"></div>
			{#if $voiceStateStore === 'listening' || $voiceStateStore === 'speaking'}
				<div
					class="absolute w-full h-full rounded-full border border-[#20B2AA]/30 animate-[wave_2s_linear_infinite] opacity-0"
				></div>
				<div
					class="absolute w-full h-full rounded-full border border-[#20B2AA]/20 animate-[wave_2s_linear_infinite] opacity-0"
					style="animation-delay: 0.8s"
				></div>
			{/if}
			<div
				class="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full orb-core backdrop-blur-md flex items-center justify-center border border-white/10 {$voiceStateStore ===
				'listening'
					? 'animate-[orb-breathe_4s_ease-in-out_infinite]'
					: ''}"
			>
				<div
					class="absolute top-4 left-6 w-16 h-16 bg-gradient-to-br from-white/30 to-transparent rounded-full blur-xl transform -rotate-45"
				></div>
				{#if $voiceStateStore === 'processing' || $voiceStateStore === 'connecting'}
					<MaterialIcon
						icon="hourglass_top"
						size={48}
						class="text-white/70 animate-spin sm:text-[64px]"
					/>
				{:else if $voiceStateStore === 'speaking'}
					<MaterialIcon
						icon="volume_up"
						size={48}
						class="text-white/70 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] sm:text-[64px]"
					/>
				{:else}
					<MaterialIcon
						icon="graphic_eq"
						size={48}
						class="text-white/60 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] sm:text-[64px]"
					/>
				{/if}
			</div>
		</div>

		<!-- Status -->
		<div class="flex flex-col items-center gap-2 sm:gap-3 text-center z-10 px-2">
			<h1
				class="text-white text-xl sm:text-2xl md:text-4xl font-semibold tracking-tight drop-shadow-xl break-words"
			>
				{statusText}
			</h1>
			<p
				class="text-slate-300 text-sm sm:text-base md:text-lg font-light tracking-wide max-w-md break-words"
			>
				{subtitle}
			</p>
		</div>

		{#if $voiceStateStore === 'speaking'}
			<!-- Waveform -->
			<div class="h-12 flex items-center gap-1 mt-6 sm:mt-8 opacity-60">
				{#each [3, 6, 4, 8, 4, 6, 3] as h, i}
					<div
						class="w-1 bg-[#20B2AA] rounded-full animate-pulse"
						style="height: {h * 4}px; animation-duration: {0.8 + i * 0.2}s"
					></div>
				{/each}
			</div>
		{/if}

		<div
			class="mt-6 w-full max-w-xl rounded-2xl border border-white/10 bg-[#1c1c21]/70 backdrop-blur-md p-4 sm:p-5 space-y-2"
		>
			{#if lastTranscription}
				<p class="text-xs uppercase tracking-wider text-white/40">Heard</p>
				<p class="text-sm sm:text-base text-white/90">“{lastTranscription}”</p>
			{/if}
			{#if lastResponse}
				<p class="text-xs uppercase tracking-wider text-white/40 pt-1">Response</p>
				<p class="text-sm sm:text-base text-[#20B2AA]/95">{lastResponse}</p>
			{/if}
			{#if !lastTranscription && !lastResponse}
				<p class="text-sm text-white/50">Your voice conversation will appear here.</p>
			{/if}
		</div>

		{#if errorMessage}
			<p
				role="status"
				class="mt-4 w-full max-w-xl text-sm rounded-xl px-3 py-2 text-center border {errorKind ===
				'tts'
					? 'text-amber-200 bg-amber-500/10 border-amber-300/20'
					: 'text-rose-300 bg-rose-500/10 border-rose-300/20'}"
			>
				{errorMessage}
			</p>
		{/if}

		{#if micFailed}
			<div
				class="mt-3 w-full max-w-xl rounded-2xl border border-white/10 bg-[#1c1c21]/70 backdrop-blur-md p-3 sm:p-4 flex items-center gap-2"
			>
				<input
					class="flex-1 bg-transparent border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
					type="text"
					bind:value={textInput}
					placeholder="Type a message instead"
					on:keydown={(e) => e.key === 'Enter' && submitTextFallback()}
				/>
				<button
					class="group flex items-center gap-2 pl-4 pr-4 h-10 min-h-[40px] rounded-full border border-[#20B2AA]/40 bg-[#20B2AA]/15 hover:bg-[#20B2AA]/25 transition-all"
					on:click={submitTextFallback}
				>
					<MaterialIcon icon="send" size={16} class="text-white" />
					<span class="text-white text-xs sm:text-sm font-semibold tracking-wide">Send</span>
				</button>
			</div>
		{/if}

		{#if recentTurns.length}
			<div class="mt-4 w-full max-w-xl space-y-2">
				{#each recentTurns as turn}
					<div
						class="text-xs sm:text-sm rounded-xl px-3 py-2 border border-white/10 bg-white/[0.03] text-white/70"
					>
						<span class="uppercase tracking-wide text-[10px] text-white/40 mr-2"
							>{turn.role === 'user' ? 'You' : agentName}</span
						>
						{turn.text}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Controls -->
	<div
		class="relative mt-6 mb-2 flex items-center gap-3 sm:gap-4 flex-wrap justify-center px-4 sm:absolute sm:bottom-12 sm:mt-0 sm:mb-0"
	>
		{#if $voiceStateStore === 'idle' || $voiceStateStore === 'error'}
			<button
				class="group flex items-center gap-2 sm:gap-3 pl-5 pr-6 h-14 min-h-[56px] rounded-full border border-[#20B2AA]/40 bg-[#20B2AA]/15 hover:bg-[#20B2AA]/25 transition-all shadow-[0_0_30px_rgba(32,178,170,0.2)]"
				on:click={startListening}
			>
				<div class="w-8 h-8 rounded-full bg-[#20B2AA]/30 flex items-center justify-center">
					<MaterialIcon icon="mic" class="text-white" />
				</div>
				<span class="text-white text-sm sm:text-base font-semibold tracking-wide">Tap to talk</span>
			</button>
		{:else if $voiceStateStore === 'listening' || $voiceStateStore === 'speaking'}
			<button
				class="group flex items-center gap-2 pl-4 pr-5 h-12 min-h-[48px] rounded-full hover:bg-rose-500/15 transition-all border border-rose-300/30 hover:border-rose-200/50 bg-rose-500/10 backdrop-blur-md"
				on:click={interruptVoiceMode}
			>
				<div
					class="w-6 h-6 bg-rose-900/70 rounded-full flex items-center justify-center group-hover:bg-rose-800/80 transition-colors"
				>
					<MaterialIcon icon="stop" size={16} class="text-white" />
				</div>
				<span class="text-white text-sm font-semibold tracking-wide">
					{$voiceStateStore === 'listening' ? 'Stop listening' : 'Stop speaking'}
				</span>
			</button>
		{/if}

		{#if $voiceStateStore === 'listening'}
			<button
				class="group flex items-center gap-2 pl-4 pr-5 h-12 min-h-[48px] rounded-full hover:bg-white/10 transition-all border border-white/10 hover:border-white/20 bg-white/5 backdrop-blur-md"
				on:click={stopListening}
			>
				<div
					class="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center group-hover:bg-slate-600 transition-colors"
				>
					<MaterialIcon icon="check" size={16} class="text-white" />
				</div>
				<span class="text-white text-sm font-semibold tracking-wide">Done</span>
			</button>
		{/if}

		<button
			class="group flex items-center gap-2 pl-4 pr-5 h-12 min-h-[48px] rounded-full hover:bg-white/10 transition-all border border-white/10 hover:border-white/20 bg-white/5 backdrop-blur-md"
			on:click={dismiss}
		>
			<div
				class="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-slate-700 transition-colors"
			>
				<MaterialIcon icon="close" size={16} class="text-white" />
			</div>
			<span class="text-white text-sm font-semibold tracking-wide">Dismiss</span>
		</button>

		<div class="absolute -bottom-7 sm:-bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
			<span class="text-white/30 text-xs font-mono hidden sm:inline">Press ESC to close</span>
		</div>
	</div>
</div>

<style>
	.orb-core {
		background: radial-gradient(
			circle at 30% 30%,
			rgba(32, 178, 170, 0.8),
			rgba(32, 178, 170, 0.2)
		);
		box-shadow:
			0 0 60px rgba(32, 178, 170, 0.4),
			inset 0 0 40px rgba(255, 255, 255, 0.2);
	}
	@keyframes orb-breathe {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.8;
		}
		50% {
			transform: scale(1.05);
			opacity: 1;
		}
	}
	@keyframes wave {
		0% {
			transform: scale(1);
			opacity: 0.5;
		}
		100% {
			transform: scale(2);
			opacity: 0;
		}
	}
</style>
