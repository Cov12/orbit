<script lang="ts">
	/**
	 * P3 assisted path — the "Not sure? Help me decide" interview DeptSetup opens in place of
	 * the department cards.
	 *
	 * A SMALL, FIXED set of leading questions asked one at a time in a chat layout. Nothing
	 * is generated here: the answers go back to DeptSetup, which merges them into the
	 * onboarding draft (the keys reuse P1's, so the Engram seed picks them up) and asks the
	 * backend for a department suggestion. Every question is skippable, and the user can
	 * leave for manual picking at any point.
	 */
	import { onMount, tick } from 'svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import type { OnboardingAnswers } from '$lib/apis/atrium';
	import { onboardingAnswers } from '$lib/stores/atrium';

	export let onComplete: (answers: Partial<Record<keyof OnboardingAnswers, string>>) => void;
	export let onCancel: () => void;

	type Question = {
		key: 'whatBusinessDoes' | 'primaryGoal' | 'dayToDay' | 'customers';
		prompt: string;
		placeholder: string;
	};

	const questions: Question[] = [
		{
			key: 'whatBusinessDoes',
			prompt: 'In a sentence or two, what does your business do?',
			placeholder: 'We build custom Shopify stores for outdoor brands.'
		},
		{
			key: 'primaryGoal',
			prompt: 'What do you most want to get done first?',
			placeholder: 'Double retainer clients without hiring.'
		},
		{
			key: 'dayToDay',
			prompt: 'Walk me through a typical day — where does the time go?',
			placeholder: 'Chasing proposals, answering client emails, sending invoices.'
		},
		{
			key: 'customers',
			prompt: 'Who are your customers or clients?',
			placeholder: 'Founder-led DTC brands doing $1–10M a year.'
		}
	];

	/** Answers so far, by question index; '' means skipped. */
	let answers: string[] = [];
	let current = 0;
	// Pre-fill from anything already typed earlier in the wizard, so the user can just send.
	let draft = $onboardingAnswers[questions[0].key] ?? '';
	let input: HTMLTextAreaElement;
	let thread: HTMLDivElement;

	onMount(() => input?.focus());

	async function advance(answer: string) {
		answers = [...answers.slice(0, current), answer.trim()];
		current += 1;
		if (current >= questions.length) {
			onComplete(Object.fromEntries(questions.map((q, i) => [q.key, answers[i] ?? ''])));
			return;
		}
		draft = $onboardingAnswers[questions[current].key] ?? '';
		await tick();
		thread?.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
		input?.focus();
	}

	async function goBackOne() {
		if (current === 0) return;
		current -= 1;
		draft = answers[current] ?? '';
		answers = answers.slice(0, current);
		await tick();
		input?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			if (draft.trim()) advance(draft);
		}
	}
</script>

<div class="flex flex-col">
	<div bind:this={thread} class="max-h-[26rem] space-y-4 overflow-y-auto p-4 sm:p-6">
		<div class="flex items-start gap-3">
			<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6961ff]/15 text-[#6961ff]">
				<MaterialIcon icon="auto_awesome" size={16} />
			</div>
			<div class="max-w-[85%] rounded-2xl rounded-tl-sm border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-slate-200">
				Happy to help. {questions.length} quick questions and I'll suggest a team — skip anything you like.
			</div>
		</div>

		{#each questions.slice(0, current + 1) as question, i}
			<div class="flex items-start gap-3">
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6961ff]/15 text-[#6961ff]">
					<MaterialIcon icon="auto_awesome" size={16} />
				</div>
				<div class="max-w-[85%] rounded-2xl rounded-tl-sm border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-slate-200">
					{question.prompt}
				</div>
			</div>
			{#if i < current}
				<div class="flex justify-end">
					{#if answers[i]}
						<div class="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-[#6961ff] px-4 py-2.5 text-sm text-white shadow-lg shadow-[#6961ff]/20">
							{answers[i]}
						</div>
					{:else}
						<div class="rounded-2xl rounded-tr-sm border border-dashed border-white/10 px-4 py-2 text-xs italic text-slate-500">
							Skipped
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>

	<div class="border-t border-white/5 p-4 sm:px-6">
		<div class="flex items-end gap-2">
			<textarea
				bind:this={input}
				bind:value={draft}
				on:keydown={onKeydown}
				rows="2"
				aria-label={questions[current]?.prompt}
				placeholder={questions[current]?.placeholder}
				class="min-w-0 flex-1 resize-none rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#6961ff] focus:outline-none focus:ring-2 focus:ring-[#6961ff]/50"
			></textarea>
			<button
				on:click={() => advance(draft)}
				disabled={!draft.trim()}
				aria-label="Send answer"
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#6961ff] text-white shadow-lg shadow-[#6961ff]/20 transition-all hover:bg-[#6961ff]/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
			>
				<MaterialIcon icon="arrow_upward" size={20} />
			</button>
		</div>

		<div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
			<div class="flex items-center gap-3">
				<button on:click={onCancel} class="flex items-center gap-1 font-semibold text-slate-400 transition-colors hover:text-white">
					<MaterialIcon icon="close" size={14} />
					Pick manually instead
				</button>
				{#if current > 0}
					<button on:click={goBackOne} class="flex items-center gap-1 text-slate-500 transition-colors hover:text-white">
						<MaterialIcon icon="undo" size={14} />
						Previous question
					</button>
				{/if}
			</div>
			<div class="flex items-center gap-3">
				<span class="text-slate-500">{current + 1} of {questions.length}</span>
				<button on:click={() => advance('')} class="font-semibold text-[#6961ff] transition-colors hover:text-[#8a84ff]">
					Skip question
				</button>
			</div>
		</div>
	</div>
</div>
