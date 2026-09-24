<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { config, user, WEBUI_NAME } from '$lib/stores';
	import dayjs from '$lib/dayjs';
	import { createNoteHandler } from '$lib/components/notes/utils';

	const i18n = getContext('i18n');
	let checked = false;

	const notesEnabled = () => {
		const features = ($config?.features ?? {}) as Record<string, unknown>;
		return (
			(features.enable_notes ?? false) &&
			($user?.role === 'admin' || ($user?.permissions?.features?.notes ?? true))
		);
	};

	onMount(async () => {
		await new Promise<void>((resolve) => {
			const interval = window.setInterval(() => {
				if (checked || $config === undefined || $user === undefined) return;
				checked = true;
				window.clearInterval(interval);
				resolve();
			}, 25);
		});

		if (!notesEnabled()) {
			goto('/atrium');
			return;
		}

		const title = $page.url.searchParams.get('title') ?? dayjs().format('YYYY-MM-DD');
		const content = $page.url.searchParams.get('content') ?? '';
		const source = $page.url.searchParams.get('source') ?? 'atrium_notes';
		const assistantName = $page.url.searchParams.get('assistant_name') ?? 'Orbit Assistant';
		const createdBy =
			source.includes('assistant') || source.includes('chat') ? 'assistant' : 'user';

		const res = await createNoteHandler(title, content, undefined, {
			atrium: true,
			created_by: createdBy,
			source,
			assistant_name: createdBy === 'assistant' ? assistantName : undefined
		});

		if (res) {
			goto(`/atrium/notes/${res.id}`);
		} else {
			goto('/atrium/notes');
		}
	});
</script>

<svelte:head>
	<title>{$i18n.t('New Note')} • {$WEBUI_NAME}</title>
</svelte:head>

<div class="flex h-full min-h-[240px] items-center justify-center text-slate-400">
	<div class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
	{$i18n.t('Creating note...')}
</div>
