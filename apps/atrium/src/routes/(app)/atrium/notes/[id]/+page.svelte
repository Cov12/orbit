<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { config, user, WEBUI_NAME } from '$lib/stores';
	import NoteEditor from '$lib/components/notes/NoteEditor.svelte';

	const i18n = getContext('i18n');
	let loaded = false;
	let checked = false;

	const notesEnabled = () => {
		const features = ($config?.features ?? {}) as Record<string, unknown>;
		return (
			(features.enable_notes ?? false) &&
			($user?.role === 'admin' || ($user?.permissions?.features?.notes ?? true))
		);
	};

	onMount(() => {
		const interval = window.setInterval(() => {
			if (checked || $config === undefined || $user === undefined) return;
			checked = true;
			window.clearInterval(interval);

			if (!notesEnabled()) {
				goto('/atrium');
				return;
			}

			loaded = true;
		}, 25);

		return () => window.clearInterval(interval);
	});
</script>

<svelte:head>
	<title>{$i18n.t('Notes')} • {$WEBUI_NAME}</title>
</svelte:head>

{#if loaded}
	<div id="note-container" class="h-full min-h-[calc(100vh-7rem)]">
		<NoteEditor id={$page.params.id} basePath="/atrium/notes" variant="atrium" />
	</div>
{/if}
