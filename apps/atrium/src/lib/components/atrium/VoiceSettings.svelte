<script lang="ts">
	import { onMount } from 'svelte';
	import MaterialIcon from './shared/MaterialIcon.svelte';
	import { voiceConfig, saveVoiceConfig, loadVoiceConfig } from '$lib/stores/voice';
	import { departments } from '$lib/stores/atrium';

	const voiceOptions = ['Default', 'Nova', 'Shimmer', 'Echo', 'Onyx', 'Fable', 'Alloy'];

	let isReadyToSave = false;
	let isTestingMic = false;
	let micTestStatus = 'Record 3s Test';

	onMount(() => {
		loadVoiceConfig();
		isReadyToSave = true;
	});

	$: if (isReadyToSave) {
		saveVoiceConfig();
	}

	function setPushToTalk(value: boolean) {
		voiceConfig.update((cfg) => ({ ...cfg, pushToTalk: value }));
	}

	function setSilenceTimeoutSeconds(value: number) {
		voiceConfig.update((cfg) => ({ ...cfg, silenceTimeout: value * 1000 }));
	}

	function setSelectedVoice(value: string) {
		voiceConfig.update((cfg) => ({ ...cfg, selectedVoice: value }));
	}

	function setAutoPlay(value: boolean) {
		voiceConfig.update((cfg) => ({ ...cfg, autoPlayResponse: value }));
	}

	function setShowTranscription(value: boolean) {
		voiceConfig.update((cfg) => ({ ...cfg, showTranscription: value }));
	}

	function setDefaultDepartment(value: string) {
		voiceConfig.update((cfg) => ({
			...cfg,
			defaultDepartmentId: value
		} as typeof cfg & { defaultDepartmentId: string }));
	}

	$: silenceTimeoutSeconds = Math.max(1, Math.min(10, Math.round(($voiceConfig.silenceTimeout || 1000) / 1000)));
	$: selectedDept = (($voiceConfig as typeof $voiceConfig & { defaultDepartmentId?: string }).defaultDepartmentId ?? '');

	async function runMicrophoneTest() {
		if (isTestingMic) return;

		isTestingMic = true;
		micTestStatus = 'Requesting microphone...';

		let stream: MediaStream | null = null;
		let recorder: MediaRecorder | null = null;
		const chunks: Blob[] = [];

		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error('Microphone is not supported in this browser.');
			}

			stream = await navigator.mediaDevices.getUserMedia({ audio: true });

			const mimeType =
				typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
					? 'audio/webm;codecs=opus'
					: 'audio/webm';

			recorder = new MediaRecorder(stream, { mimeType });
			recorder.ondataavailable = (event: BlobEvent) => {
				if (event.data.size > 0) chunks.push(event.data);
			};

			micTestStatus = 'Recording...';
			recorder.start();

			await new Promise<void>((resolve) => {
				setTimeout(() => resolve(), 3000);
			});

			recorder.stop();

			await new Promise<void>((resolve) => {
				if (!recorder) {
					resolve();
					return;
				}
				recorder.onstop = () => resolve();
			});

			const blob = new Blob(chunks, { type: mimeType });
			const url = URL.createObjectURL(blob);
			const audio = new Audio(url);

			micTestStatus = 'Playing back...';
			await audio.play();

			await new Promise<void>((resolve) => {
				audio.onended = () => resolve();
				audio.onerror = () => resolve();
			});

			URL.revokeObjectURL(url);
			micTestStatus = 'Record 3s Test';
		} catch (error) {
			micTestStatus = error instanceof Error ? error.message : 'Microphone test failed';
		} finally {
			stream?.getTracks().forEach((track) => track.stop());
			isTestingMic = false;
		}
	}
</script>

<div class="w-full bg-[rgba(28,28,33,0.7)] backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 md:p-8">
	<div class="flex items-center gap-3 mb-6 md:mb-8">
		<div class="w-10 h-10 rounded-xl bg-[#20B2AA]/20 border border-[#20B2AA]/35 flex items-center justify-center">
			<MaterialIcon icon="settings" class="text-[#20B2AA]" />
		</div>
		<div>
			<h2 class="text-lg sm:text-xl md:text-2xl font-bold text-white">Voice Settings</h2>
			<p class="text-xs sm:text-sm text-white/60">Configure speech input/output behavior for Atrium.</p>
		</div>
	</div>

	<div class="space-y-5 sm:space-y-6 md:space-y-8">
		<section class="bg-white/[0.03] border border-white/10 rounded-xl p-4 sm:p-5 md:p-6">
			<div class="flex items-center gap-2 mb-4">
				<MaterialIcon icon="mic" class="text-[#20B2AA]" />
				<h3 class="text-sm sm:text-base font-semibold text-white">Voice Input</h3>
			</div>

			<div class="space-y-4 md:space-y-5">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<div>
						<p class="text-sm text-white font-medium">Push-to-talk mode</p>
						<p class="text-xs text-white/60">Choose hold-to-talk or tap-to-toggle behavior.</p>
					</div>
					<button
						type="button"
						class="w-44 h-10 rounded-lg border transition-colors text-sm font-medium bg-[#20B2AA]/15 border-[#20B2AA]/40 text-white hover:bg-[#20B2AA]/25"
						on:click={() => setPushToTalk(!$voiceConfig.pushToTalk)}
					>
						{$voiceConfig.pushToTalk ? 'Hold to Talk' : 'Tap to Toggle'}
					</button>
				</div>

				<div>
					<div class="flex items-center justify-between mb-2">
						<label for="silence-timeout" class="text-sm text-white font-medium">Silence timeout</label>
						<span class="text-xs text-[#20B2AA] font-semibold">{silenceTimeoutSeconds}s</span>
					</div>
					<input
						id="silence-timeout"
						type="range"
						min="1"
						max="10"
						value={silenceTimeoutSeconds}
						on:change={(e) => setSilenceTimeoutSeconds(Number((e.currentTarget as HTMLInputElement).value))}
						class="w-full accent-[#20B2AA]"
					/>
					<p class="text-xs text-white/60 mt-1">Automatically stop listening after this much silence.</p>
				</div>

				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<div>
						<p class="text-sm text-white font-medium">Microphone test</p>
						<p class="text-xs text-white/60">Records 3 seconds and immediately plays it back.</p>
					</div>
					<button
						type="button"
						class="h-10 px-4 rounded-lg border border-[#20B2AA]/40 bg-[#20B2AA]/15 hover:bg-[#20B2AA]/25 transition-colors text-sm font-medium text-white disabled:opacity-60"
						on:click={runMicrophoneTest}
						disabled={isTestingMic}
					>
						{isTestingMic ? 'Testing…' : micTestStatus}
					</button>
				</div>
			</div>
		</section>

		<section class="bg-white/[0.03] border border-white/10 rounded-xl p-4 sm:p-5 md:p-6">
			<div class="flex items-center gap-2 mb-4">
				<MaterialIcon icon="volume_up" class="text-[#20B2AA]" />
				<h3 class="text-sm sm:text-base font-semibold text-white">Voice Output</h3>
			</div>

			<div class="space-y-4 md:space-y-5">
				<div>
					<label for="voice-select" class="text-sm text-white font-medium block mb-2">Voice</label>
					<select
						id="voice-select"
						value={$voiceConfig.selectedVoice || 'Default'}
						on:change={(e) => setSelectedVoice((e.currentTarget as HTMLSelectElement).value)}
						class="w-full bg-[#1c1c21] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/50"
					>
						{#each voiceOptions as voice}
							<option value={voice}>{voice}</option>
						{/each}
					</select>
				</div>

				<label class="flex items-center justify-between gap-3">
					<div>
						<p class="text-sm text-white font-medium">Auto-play response</p>
						<p class="text-xs text-white/60">Automatically play generated TTS responses.</p>
					</div>
					<input
						type="checkbox"
						checked={$voiceConfig.autoPlayResponse}
						on:change={(e) => setAutoPlay((e.currentTarget as HTMLInputElement).checked)}
						class="h-5 w-5 accent-[#20B2AA]"
					/>
				</label>

				<label class="flex items-center justify-between gap-3">
					<div>
						<p class="text-sm text-white font-medium">Show transcription</p>
						<p class="text-xs text-white/60">Toggle live transcription panel visibility.</p>
					</div>
					<input
						type="checkbox"
						checked={$voiceConfig.showTranscription}
						on:change={(e) => setShowTranscription((e.currentTarget as HTMLInputElement).checked)}
						class="h-5 w-5 accent-[#20B2AA]"
					/>
				</label>
			</div>
		</section>

		<section class="bg-white/[0.03] border border-white/10 rounded-xl p-4 sm:p-5 md:p-6">
			<div class="flex items-center gap-2 mb-4">
				<MaterialIcon icon="hub" class="text-[#20B2AA]" />
				<h3 class="text-sm sm:text-base font-semibold text-white">Department Voice Defaults</h3>
			</div>

			<div>
				<label for="department-default" class="text-sm text-white font-medium block mb-2">Default department</label>
				<select
					id="department-default"
					value={selectedDept}
					on:change={(e) => setDefaultDepartment((e.currentTarget as HTMLSelectElement).value)}
					class="w-full bg-[#1c1c21] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20B2AA]/50"
				>
					<option value="">Select department</option>
					{#each $departments as dept}
						<option value={dept.id}>{dept.name}</option>
					{/each}
				</select>
				<p class="text-xs text-white/60 mt-2">Voice mode will connect here by default when no department is selected.</p>
			</div>
		</section>
	</div>
</div>
