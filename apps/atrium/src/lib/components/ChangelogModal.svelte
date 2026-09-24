<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { Confetti } from 'svelte-confetti';

	import { WEBUI_NAME, config, settings } from '$lib/stores';
	import { WEBUI_VERSION } from '$lib/constants';

	import Modal from './common/Modal.svelte';
	import { updateUserSettings } from '$lib/apis/users';
	import XMark from '$lib/components/icons/XMark.svelte';

	const i18n = getContext('i18n');

	export let show = false;

	const closeModal = async () => {
		localStorage.version = $config.version;
		await settings.set({ ...$settings, ...{ version: $config.version } });
		await updateUserSettings(localStorage.token, { ui: $settings });
		show = false;
	};

	const features = [
		{
			icon: '🏢',
			title: 'AI-Powered Organization',
			desc: 'Your business gets a full AI org chart — Chief AI, department heads, and specialized agents working together like a Fortune 500 team.'
		},
		{
			icon: '💬',
			title: 'Chat With Your Departments',
			desc: 'Talk to Sales, Customer Support, or Back Office directly. Each department knows its role, has its own knowledge base, and stays in its lane.'
		},
		{
			icon: '🎙️',
			title: 'Voice Mode',
			desc: 'Have real-time voice conversations with your AI team — hands-free, on the go. Like calling your best employee.'
		},
		{
			icon: '📋',
			title: 'Delegated Actions',
			desc: 'Your AI proposes actions, you approve them. Nothing happens without your say-so. Full control, zero surprises.'
		},
		{
			icon: '📊',
			title: 'Analytics Dashboard',
			desc: 'See what your AI team is doing, how departments are performing, and where to focus next — all in one view.'
		}
	];
</script>

<Modal bind:show size="xl">
	<div class="px-6 pt-5 text-white">
		<div class="flex justify-between items-start">
			<div class="text-xl font-medium">
				Welcome to Atrium
				<Confetti x={[-1, -0.25]} y={[0, 0.5]} />
			</div>
			<button class="self-center" on:click={closeModal} aria-label={$i18n.t('Close')}>
				<XMark className={'size-5'}>
					<p class="sr-only">{$i18n.t('Close')}</p>
				</XMark>
			</button>
		</div>
		<div class="flex items-center mt-1">
			<div class="text-sm text-gray-400">Your AI Organization Operating System</div>
			<div class="flex self-center w-[1px] h-6 mx-2.5 bg-gray-700" />
			<div class="text-sm text-gray-400">
				v{WEBUI_VERSION}
			</div>
		</div>
	</div>

	<div class="w-full p-4 px-5 text-gray-300">
		<div class="overflow-y-scroll max-h-[30rem] scrollbar-hidden">
			<div class="mb-3 space-y-4">
				<p class="text-sm text-gray-400 leading-relaxed">
					Atrium gives your small business the leverage of a Fortune 500 company — 
					powered by AI departments that think, plan, and execute alongside you.
				</p>

				{#each features as feature}
					<div class="flex gap-3 p-3 rounded-xl" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);">
						<div class="text-2xl flex-shrink-0 mt-0.5">{feature.icon}</div>
						<div>
							<div class="font-semibold text-sm text-white">{feature.title}</div>
							<div class="text-xs text-gray-400 mt-0.5 leading-relaxed">{feature.desc}</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
		<div class="flex justify-end pt-3 text-sm font-medium">
			<button
				on:click={closeModal}
				class="px-4 py-2 text-sm font-medium text-white rounded-full transition"
				style="background: #6961ff; hover: brightness(1.1);"
			>
				<span class="relative">🚀 Let's Build</span>
			</button>
		</div>
	</div>
</Modal>
