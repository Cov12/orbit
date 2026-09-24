<script lang="ts">
	import { marked } from 'marked';
	import { toast } from 'svelte-sonner';
	import fileSaver from 'file-saver';

	const { saveAs } = fileSaver;

	import dayjs from '$lib/dayjs';
	import duration from 'dayjs/plugin/duration';
	import relativeTime from 'dayjs/plugin/relativeTime';

	dayjs.extend(duration);
	dayjs.extend(relativeTime);

	async function loadLocale(locales) {
		for (const locale of locales) {
			try {
				dayjs.locale(locale);
				break; // Stop after successfully loading the first available locale
			} catch (error) {
				console.error(`Could not load locale '${locale}':`, error);
			}
		}
	}

	import { onMount, getContext, onDestroy } from 'svelte';

	const i18n = getContext('i18n');
	// Assuming $i18n.languages is an array of language codes
	$: loadLocale($i18n.languages);

	import { goto } from '$app/navigation';
	import { WEBUI_NAME, config, prompts as _prompts, user } from '$lib/stores';
	import { createNewNote, deleteNoteById, getNoteList, searchNotes } from '$lib/apis/notes';
	import { capitalizeFirstLetter, copyToClipboard, getTimeRange } from '$lib/utils';
	import { downloadPdf, createNoteHandler } from './utils';

	import EllipsisHorizontal from '../icons/EllipsisHorizontal.svelte';
	import DeleteConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import Search from '../icons/Search.svelte';
	import Plus from '../icons/Plus.svelte';
	import ChevronRight from '../icons/ChevronRight.svelte';
	import Spinner from '../common/Spinner.svelte';
	import Tooltip from '../common/Tooltip.svelte';
	import NoteMenu from './Notes/NoteMenu.svelte';
	import FilesOverlay from '../chat/MessageInput/FilesOverlay.svelte';
	import XMark from '../icons/XMark.svelte';
	import DropdownOptions from '../common/DropdownOptions.svelte';
	import Loader from '../common/Loader.svelte';

	export let basePath = '/notes';
	export let variant: 'default' | 'atrium' = 'default';

	let loaded = false;

	let importFiles = '';
	let selectedNote = null;
	let showDeleteConfirm = false;

	let notes = {};

	let items = null;
	let total = null;

	let query = '';
	let searchDebounceTimer: ReturnType<typeof setTimeout>;

	let sortKey = null;
	let displayOption = null;
	let viewOption = null;
	let permission = null;

	let page = 1;

	let itemsLoading = false;
	let allItemsLoaded = false;

	$: isAtrium = variant === 'atrium';

	const noteHref = (id: string) => `${basePath}/${id}`;
	const noteShareUrl = (id: string) => `${window.location.origin}${noteHref(id)}`;
	const noteMeta = (note) => note?.meta ?? note?.data?.meta ?? {};
	const isAssistantCreated = (note) =>
		['assistant', 'ai_assistant'].includes(noteMeta(note)?.created_by) ||
		['atrium_chat', 'atrium_voice', 'assistant'].includes(noteMeta(note)?.source);
	const assistantLabel = (note) =>
		noteMeta(note)?.assistant_name || noteMeta(note)?.agent_name || 'Orbit Assistant';
	const notePreview = (note) => note?.data?.content?.md || $i18n.t('No content');

	const downloadHandler = async (type) => {
		if (type === 'txt') {
			const blob = new Blob([selectedNote.data.content.md], { type: 'text/plain' });
			saveAs(blob, `${selectedNote.title}.txt`);
		} else if (type === 'md') {
			const blob = new Blob([selectedNote.data.content.md], { type: 'text/markdown' });
			saveAs(blob, `${selectedNote.title}.md`);
		} else if (type === 'pdf') {
			try {
				await downloadPdf(selectedNote);
			} catch (error) {
				toast.error(`${error}`);
			}
		}
	};

	const deleteNoteHandler = async (id) => {
		const res = await deleteNoteById(localStorage.token, id).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			init();
		}
	};

	const inputFilesHandler = async (inputFiles) => {
		// Check if all the file is a markdown file and extract name and content

		for (const file of inputFiles) {
			if (file.type !== 'text/markdown') {
				toast.error($i18n.t('Only markdown files are allowed'));
				return;
			}

			const reader = new FileReader();
			reader.onload = async (event) => {
				const content = event.target.result;
				let name = file.name.replace(/\.md$/, '');

				if (typeof content !== 'string') {
					toast.error($i18n.t('Invalid file content'));
					return;
				}

				// Create a new note with the content
				const res = await createNewNote(localStorage.token, {
					title: name,
					data: {
						content: {
							json: null,
							html: marked.parse(content ?? ''),
							md: content
						}
					},
					meta: isAtrium
						? { atrium: true, created_by: 'user', source: 'atrium_notes' }
						: null,
					access_grants: []
				}).catch((error) => {
					toast.error(`${error}`);
					return null;
				});

				if (res) {
					init();
				}
			};

			reader.readAsText(file);
		}
	};

	const reset = () => {
		page = 1;
		items = null;
		total = null;
		allItemsLoaded = false;
		itemsLoading = false;
		notes = {};
	};

	const loadMoreItems = async () => {
		if (allItemsLoaded) return;
		page += 1;
		await getItemsPage();
	};

	const init = async () => {
		reset();
		await getItemsPage();
	};

	$: if (query !== undefined) {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			if (loaded) {
				init();
			}
		}, 300);
	}

	$: if (loaded && sortKey !== undefined && permission !== undefined && viewOption !== undefined) {
		init();
	}

	const getItemsPage = async () => {
		itemsLoading = true;

		if (viewOption === 'created') {
			permission = null;
		}

		const res = await searchNotes(
			localStorage.token,
			query,
			viewOption,
			permission,
			sortKey,
			page
		).catch(() => {
			return [];
		});

		if (res) {
			console.log(res);
			total = res.total;
			const pageItems = res.items;

			if ((pageItems ?? []).length === 0) {
				allItemsLoaded = true;
			} else {
				allItemsLoaded = false;
			}

			if (items) {
				items = [...items, ...pageItems];
			} else {
				items = pageItems;
			}
		}

		itemsLoading = false;
		return res;
	};

	const groupNotes = (res) => {
		if (!Array.isArray(res)) {
			return []; // Return empty array for invalid input
		}

		// Build the grouped object while tracking order
		const grouped: Record<string, any[]> = {};
		const orderedKeys: string[] = [];

		for (const note of res) {
			const timeRange = getTimeRange(note.updated_at / 1000000000);
			if (!grouped[timeRange]) {
				grouped[timeRange] = [];
				orderedKeys.push(timeRange);
			}
			grouped[timeRange].push({
				...note,
				timeRange
			});
		}

		// Return as array of [timeRange, notes] to preserve insertion order
		return orderedKeys.map((key) => [key, grouped[key]] as [string, any[]]);
	};

	let dragged = false;

	const onDragOver = (e) => {
		e.preventDefault();

		// Check if a file is being dragged.
		if (e.dataTransfer?.types?.includes('Files')) {
			dragged = true;
		} else {
			dragged = false;
		}
	};

	const onDragLeave = () => {
		dragged = false;
	};

	const onDrop = async (e) => {
		e.preventDefault();
		console.log(e);

		if (e.dataTransfer?.files) {
			const inputFiles = Array.from(e.dataTransfer?.files);
			if (inputFiles && inputFiles.length > 0) {
				console.log(inputFiles);
				inputFilesHandler(inputFiles);
			}
		}

		dragged = false;
	};

	onMount(async () => {
		viewOption = localStorage?.noteViewOption ?? null;
		displayOption = localStorage?.noteDisplayOption ?? null;

		loaded = true;

		const dropzoneElement = document.getElementById('notes-container');
		dropzoneElement?.addEventListener('dragover', onDragOver);
		dropzoneElement?.addEventListener('drop', onDrop);
		dropzoneElement?.addEventListener('dragleave', onDragLeave);
	});

	onDestroy(() => {
		clearTimeout(searchDebounceTimer);
		console.log('destroy');
		const dropzoneElement = document.getElementById('notes-container');

		if (dropzoneElement) {
			dropzoneElement?.removeEventListener('dragover', onDragOver);
			dropzoneElement?.removeEventListener('drop', onDrop);
			dropzoneElement?.removeEventListener('dragleave', onDragLeave);
		}
	});
</script>

<svelte:head>
	<title>
		{$i18n.t('Notes')} • {$WEBUI_NAME}
	</title>
</svelte:head>

<FilesOverlay show={dragged} />

<div
	id="notes-container"
	data-testid={isAtrium ? 'atrium-notes-page' : undefined}
	class={isAtrium
		? 'w-full min-h-full h-full text-slate-100'
		: 'w-full min-h-full h-full px-3 md:px-[18px]'}
>
	{#if loaded}
		<DeleteConfirmDialog
			bind:show={showDeleteConfirm}
			title={$i18n.t('Delete note?')}
			on:confirm={() => {
				deleteNoteHandler(selectedNote.id);
				showDeleteConfirm = false;
			}}
		>
			<div class=" text-sm text-gray-500 truncate">
				{$i18n.t('This will delete')} <span class="  font-semibold">{selectedNote.title}</span>.
			</div>
		</DeleteConfirmDialog>

		<div class={isAtrium ? 'mb-5' : 'flex flex-col gap-1 px-1 mt-1.5 mb-3'}>
			<div
				class={isAtrium
					? 'rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-5 shadow-2xl shadow-black/20'
					: 'flex justify-between items-center'}
			>
				<div
					class={isAtrium
						? 'flex flex-col gap-4 md:flex-row md:items-end md:justify-between'
						: 'contents'}
				>
					<div
						class={isAtrium
							? 'max-w-2xl'
							: 'flex items-center md:self-center text-xl font-medium px-0.5 gap-2 shrink-0'}
					>
						{#if isAtrium}
							<div
								class="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#20B2AA]"
							>
								<span class="material-symbols-outlined text-[16px]">sticky_note_2</span>
								Atrium Notes
							</div>
							<h1 class="text-2xl font-semibold tracking-tight text-white md:text-3xl">
								Operational notes that stay with the work
							</h1>
							<p class="mt-2 max-w-xl text-sm leading-6 text-slate-400">
								Capture plans, client context, and assistant-saved details without leaving the
								Atrium workspace.
							</p>
						{:else}
							<div>
								{$i18n.t('Notes')}
							</div>

							<div class="text-lg font-medium text-gray-500 dark:text-gray-500">
								{total}
							</div>
						{/if}
					</div>

					<div class={isAtrium ? 'flex items-center gap-3' : 'flex w-full justify-end gap-1.5'}>
						{#if isAtrium}
							<div
								class="hidden rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right md:block"
							>
								<div class="text-xs uppercase tracking-wide text-slate-500">Notes</div>
								<div class="text-lg font-semibold text-white">{total ?? '—'}</div>
							</div>
						{/if}
						<button
							data-testid={isAtrium ? 'atrium-new-note' : undefined}
							class={isAtrium
								? 'inline-flex items-center rounded-xl bg-[#6961ff] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6961ff]/25 transition hover:bg-[#5851d8]'
								: ' px-2 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition font-medium text-sm flex items-center'}
							on:click={async () => {
								const res = await createNoteHandler(
									dayjs().format('YYYY-MM-DD'),
									undefined,
									undefined,
									isAtrium
										? { atrium: true, created_by: 'user', source: 'atrium_notes' }
										: null
								);

								if (res) {
									goto(noteHref(res.id));
								}
							}}
						>
							<Plus className="size-3" strokeWidth="2.5" />

							<div class=" ml-1 text-xs">{$i18n.t('New Note')}</div>
						</button>
					</div>
				</div>
			</div>
		</div>

		<div
			data-testid={isAtrium ? 'atrium-notes-surface' : undefined}
			class={isAtrium
				? 'rounded-2xl border border-white/10 bg-[#121217]/90 p-3 shadow-2xl shadow-black/20'
				: 'py-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30'}
		>
			<div class="px-3.5 flex flex-1 items-center w-full space-x-2 py-0.5 pb-2">
				<div class="flex flex-1 items-center">
					<div class=" self-center ml-1 mr-3 {isAtrium ? 'text-slate-500' : ''}">
						<Search className="size-3.5" />
					</div>
					<input
						data-testid={isAtrium ? 'atrium-notes-search' : undefined}
						class={isAtrium
							? 'w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-hidden focus:border-[#6961ff]/60'
							: ' w-full text-sm py-1 rounded-r-xl outline-hidden bg-transparent'}
						bind:value={query}
						placeholder={$i18n.t('Search Notes')}
					/>

					{#if query}
						<div class="self-center pl-1.5 translate-y-[0.5px] rounded-l-xl bg-transparent">
							<button
								class="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition"
								on:click={() => {
									query = '';
								}}
							>
								<XMark className="size-3" strokeWidth="2" />
							</button>
						</div>
					{/if}
				</div>
			</div>

			<div class="px-3 flex justify-between">
				<div
					class="flex w-full bg-transparent overflow-x-auto scrollbar-none"
					on:wheel={(e) => {
						if (e.deltaY !== 0) {
							e.preventDefault();
							e.currentTarget.scrollLeft += e.deltaY;
						}
					}}
				>
					<div
						class="flex gap-3 w-fit text-center text-sm rounded-full bg-transparent px-0.5 whitespace-nowrap"
					>
						<DropdownOptions
							align="start"
							className={isAtrium
								? 'flex w-full items-center gap-2 truncate px-3 py-1.5 text-sm bg-white/5 text-slate-200 rounded-xl placeholder-slate-500 outline-hidden focus:outline-hidden'
								: 'flex w-full items-center gap-2 truncate px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-850 rounded-xl  placeholder-gray-400 outline-hidden focus:outline-hidden'}
							bind:value={viewOption}
							items={[
								{ value: null, label: $i18n.t('All') },
								{ value: 'created', label: $i18n.t('Created by you') },
								{ value: 'shared', label: $i18n.t('Shared with you') }
							]}
							onChange={(value) => {
								if (value) {
									localStorage.noteViewOption = value;
								} else {
									delete localStorage.noteViewOption;
								}
							}}
						/>

						{#if [null, 'shared'].includes(viewOption)}
							<DropdownOptions
								align="start"
								bind:value={permission}
								items={[
									{ value: null, label: $i18n.t('Write') },
									{ value: 'read_only', label: $i18n.t('Read Only') }
								]}
							/>
						{/if}
					</div>
				</div>

				<div>
					<DropdownOptions
						align="start"
						bind:value={displayOption}
						items={[
							{ value: null, label: $i18n.t('List') },
							{ value: 'grid', label: $i18n.t('Grid') }
						]}
						onChange={() => {
							if (displayOption) {
								localStorage.noteDisplayOption = displayOption;
							} else {
								delete localStorage.noteDisplayOption;
							}
						}}
					/>
				</div>
			</div>

			{#if items !== null && total !== null}
				{#if (items ?? []).length > 0}
					{@const groupedNotes = groupNotes(items)}

					<div class="@container h-full py-2.5 px-2.5">
						<div class="">
							{#each groupedNotes as [timeRange, notesList], idx}
								<div
									class={isAtrium
										? 'w-full px-2.5 pb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500'
										: 'w-full text-xs text-gray-500 dark:text-gray-500 font-medium px-2.5 pb-2.5'}
								>
									{$i18n.t(timeRange)}
								</div>

								{#if displayOption === null}
									<div
										class="{groupedNotes.length - 1 !== idx ? 'mb-3' : ''} gap-1.5 flex flex-col"
									>
										{#each notesList as note, idx (note.id)}
											<div
												data-testid={isAtrium ? 'atrium-note-card' : undefined}
												data-note-id={isAtrium ? note.id : undefined}
												class={isAtrium
													? 'flex w-full cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-[#6961ff]/40 hover:bg-[#6961ff]/10'
													: ' flex cursor-pointer w-full px-3.5 py-1.5 border border-gray-50 dark:border-gray-850/30 bg-transparent dark:hover:bg-gray-850 hover:bg-white rounded-2xl transition'}
											>
												<a href={noteHref(note.id)} class="w-full flex flex-col justify-between">
													<div class="flex-1">
														<div class="  flex items-center gap-2 self-center justify-between">
															<Tooltip
																content={note.title}
																className="flex-1"
																placement="top-start"
															>
																<div
																	class={isAtrium
																		? 'line-clamp-1 w-full flex-1 text-sm font-semibold capitalize text-slate-100'
																		: ' text-sm font-medium capitalize flex-1 w-full line-clamp-1'}
																>
																	{note.title}
																</div>
															</Tooltip>

															<div class="flex shrink-0 items-center text-xs gap-2.5">
																{#if isAtrium && isAssistantCreated(note)}
																	<div
																		data-testid="atrium-note-ai-badge"
																		class="inline-flex items-center gap-1 rounded-full border border-[#6961ff]/30 bg-[#6961ff]/15 px-2 py-0.5 text-[11px] font-medium text-[#b8b4ff]"
																		title={`Created by ${assistantLabel(note)}`}
																	>
																		<span class="material-symbols-outlined text-[13px]"
																			>auto_awesome</span
																		>
																		{assistantLabel(note)}
																	</div>
																{/if}
																<Tooltip content={dayjs(note.updated_at / 1000000).format('LLLL')}>
																	<div class={isAtrium ? 'text-slate-500' : ''}>
																		{dayjs(note.updated_at / 1000000).fromNow()}
																	</div>
																</Tooltip>
																<Tooltip
																	content={note?.user?.email ?? $i18n.t('Deleted User')}
																	className="flex shrink-0"
																	placement="top-start"
																>
																	<div
																		class={isAtrium
																			? 'shrink-0 text-slate-500'
																			: 'shrink-0 text-gray-500'}
																	>
																		{$i18n.t('By {{name}}', {
																			name: capitalizeFirstLetter(
																				note?.user?.name ??
																					note?.user?.email ??
																					$i18n.t('Deleted User')
																			)
																		})}
																	</div>
																</Tooltip>

																<div>
																	<NoteMenu
																		onDownload={(type) => {
																			selectedNote = note;

																			downloadHandler(type);
																		}}
																		onCopyLink={async () => {
																			const res = await copyToClipboard(noteShareUrl(note.id));

																			if (res) {
																				toast.success($i18n.t('Copied link to clipboard'));
																			} else {
																				toast.error($i18n.t('Failed to copy link'));
																			}
																		}}
																		onDelete={() => {
																			selectedNote = note;
																			showDeleteConfirm = true;
																		}}
																	>
																		<button
																			class={isAtrium
																				? 'self-center w-fit rounded-xl p-1 text-sm text-slate-400 hover:bg-white/10 hover:text-white'
																				: 'self-center w-fit text-sm p-1 dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl'}
																			type="button"
																		>
																			<EllipsisHorizontal className="size-5" />
																		</button>
																	</NoteMenu>
																</div>
															</div>
														</div>
													</div>
												</a>
											</div>
										{/each}
									</div>
								{:else if displayOption === 'grid'}
									<div
										class="{groupedNotes.length - 1 !== idx
											? 'mb-5'
											: ''} gap-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
									>
										{#each notesList as note, idx (note.id)}
											<div
												data-testid={isAtrium ? 'atrium-note-card' : undefined}
												data-note-id={isAtrium ? note.id : undefined}
												class={isAtrium
													? 'flex min-h-44 w-full cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] px-4.5 py-4 transition hover:border-[#6961ff]/40 hover:bg-[#6961ff]/10'
													: ' flex space-x-4 cursor-pointer w-full px-4.5 py-4 border border-gray-50 dark:border-gray-850/30 bg-transparent dark:hover:bg-gray-850 hover:bg-white rounded-2xl transition'}
											>
												<div class=" flex flex-1 space-x-4 cursor-pointer w-full">
													<a
														href={noteHref(note.id)}
														class="w-full -translate-y-0.5 flex flex-col justify-between"
													>
														<div class="flex-1">
															<div
																class="  flex items-center gap-2 self-center mb-1 justify-between"
															>
																<div
																	class={isAtrium
																		? 'font-semibold line-clamp-1 capitalize text-slate-100'
																		: ' font-semibold line-clamp-1 capitalize'}
																>
																	{note.title}
																</div>
																{#if isAtrium && isAssistantCreated(note)}
																	<div
																		data-testid="atrium-note-ai-badge"
																		class="ml-auto inline-flex items-center gap-1 rounded-full border border-[#6961ff]/30 bg-[#6961ff]/15 px-2 py-0.5 text-[11px] font-medium text-[#b8b4ff]"
																		title={`Created by ${assistantLabel(note)}`}
																	>
																		<span class="material-symbols-outlined text-[13px]"
																			>auto_awesome</span
																		>
																		{assistantLabel(note)}
																	</div>
																{/if}

																<div>
																	<NoteMenu
																		onDownload={(type) => {
																			selectedNote = note;

																			downloadHandler(type);
																		}}
																		onCopyLink={async () => {
																			const res = await copyToClipboard(noteShareUrl(note.id));

																			if (res) {
																				toast.success($i18n.t('Copied link to clipboard'));
																			} else {
																				toast.error($i18n.t('Failed to copy link'));
																			}
																		}}
																		onDelete={() => {
																			selectedNote = note;
																			showDeleteConfirm = true;
																		}}
																	>
																		<button
																			class={isAtrium
																				? 'self-center w-fit rounded-xl p-1 text-sm text-slate-400 hover:bg-white/10 hover:text-white'
																				: 'self-center w-fit text-sm p-1 dark:text-gray-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl'}
																			type="button"
																		>
																			<EllipsisHorizontal className="size-5" />
																		</button>
																	</NoteMenu>
																</div>
															</div>

															<div
																class={isAtrium
																	? 'mb-3 line-clamp-3 min-h-10 text-xs leading-5 text-slate-400'
																	: ' text-xs text-gray-500 dark:text-gray-500 mb-3 line-clamp-3 min-h-10'}
															>
																{#if notePreview(note)}
																	{notePreview(note)}
																{:else}
																	{$i18n.t('No content')}
																{/if}
															</div>
														</div>

														<div class=" text-xs px-0.5 w-full flex justify-between items-center">
															<div class={isAtrium ? 'text-slate-500' : ''}>
																{dayjs(note.updated_at / 1000000).fromNow()}
															</div>
															<Tooltip
																content={note?.user?.email ?? $i18n.t('Deleted User')}
																className="flex shrink-0"
																placement="top-start"
															>
																<div
																	class={isAtrium
																		? 'shrink-0 text-slate-500'
																		: 'shrink-0 text-gray-500'}
																>
																	{$i18n.t('By {{name}}', {
																		name: capitalizeFirstLetter(
																			note?.user?.name ??
																				note?.user?.email ??
																				$i18n.t('Deleted User')
																		)
																	})}
																</div>
															</Tooltip>
														</div>
													</a>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							{/each}

							{#if !allItemsLoaded}
								<Loader
									on:visible={(e) => {
										if (!itemsLoading) {
											loadMoreItems();
										}
									}}
								>
									<div
										class="w-full flex justify-center py-4 text-xs animate-pulse items-center gap-2"
									>
										<Spinner className=" size-4" />
										<div class=" ">{$i18n.t('Loading...')}</div>
									</div>
								</Loader>
							{/if}
						</div>
					</div>
				{:else}
					<div class="w-full h-full flex flex-col items-center justify-center">
						<div class="py-20 text-center">
							<div class=" text-sm text-gray-400 dark:text-gray-600">
								{$i18n.t('No Notes')}
							</div>

							<div class="mt-1 text-xs text-gray-300 dark:text-gray-700">
								{$i18n.t('Create your first note by clicking on the plus button below.')}
							</div>
						</div>
					</div>
				{/if}
			{:else}
				<div class="w-full h-full flex justify-center items-center py-10">
					<Spinner className="size-4" />
				</div>
			{/if}
		</div>
	{:else}
		<div class="w-full h-full flex justify-center items-center">
			<Spinner className="size-4" />
		</div>
	{/if}
</div>
