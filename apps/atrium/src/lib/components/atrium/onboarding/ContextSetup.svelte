<script lang="ts">
	/**
	 * P1 context capture — the questions that make the assistant warm on day one.
	 *
	 * The set is SMALL and FIXED on purpose: no LLM interviews the user here (that is the
	 * assisted path, P3). Each answered question becomes exactly one fact seeded into
	 * Engram, so the keys below must match the backend's FACT_LABELS
	 * (apps/atrium/backend/routers/onboarding.py). Everything is optional — a user who
	 * skips the whole step still gets through the wizard, just with a colder assistant.
	 */
	import { goto } from '$app/navigation';
	import GlassPanel from '$lib/components/atrium/shared/GlassPanel.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import { onboardingAnswers } from '$lib/stores/atrium';

	export let step: number;

	type Question = {
		key: 'whatBusinessDoes' | 'customers' | 'primaryGoal' | 'dayToDay';
		label: string;
		hint: string;
		placeholder: string;
		icon: string;
	};

	const questions: Question[] = [
		{
			key: 'whatBusinessDoes',
			label: 'What does your business do?',
			hint: 'A sentence or two is plenty.',
			placeholder: 'We build custom Shopify stores for outdoor brands.',
			icon: 'storefront'
		},
		{
			key: 'customers',
			label: 'Who are your customers?',
			hint: 'The people you actually sell to.',
			placeholder: 'Founder-led DTC brands doing $1–10M a year.',
			icon: 'groups'
		},
		{
			key: 'primaryGoal',
			label: "What's your main goal right now?",
			hint: 'The one thing that matters this quarter.',
			placeholder: 'Double retainer clients without hiring.',
			icon: 'flag'
		},
		{
			key: 'dayToDay',
			label: 'What takes most of your day?',
			hint: 'So we know what to take off your plate first.',
			placeholder: 'Chasing proposals and answering the same client emails.',
			icon: 'schedule'
		}
	];

	// Local draft, flushed to the store on navigate (either direction) so nothing is lost.
	let values: Record<string, string> = Object.fromEntries(
		questions.map((question) => [question.key, $onboardingAnswers[question.key] ?? ''])
	);

	$: answeredCount = questions.filter((question) => values[question.key]?.trim()).length;

	function flush() {
		onboardingAnswers.update((answers) => ({
			...answers,
			...Object.fromEntries(
				questions.map((question) => [question.key, (values[question.key] ?? '').trim()])
			)
		}));
	}

	function goBack() {
		flush();
		goto('/atrium/onboarding/step1');
	}

	function goNext() {
		flush();
		goto('/atrium/onboarding/step3');
	}
</script>

<section class="relative min-h-screen overflow-hidden bg-[#0f0f13] px-4 py-8 text-slate-100 sm:px-6 md:py-10">
	<div class="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-[#6961ff]/20 blur-3xl"></div>
	<div class="pointer-events-none absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-[#20B2AA]/10 blur-3xl"></div>

	<div class="relative mx-auto w-full max-w-3xl">
		<div class="mb-8 flex items-center justify-center gap-3">
			<div class="h-2 w-2 rounded-full bg-[#6961ff]/40"></div>
			<div class="h-2 w-2 rounded-full bg-[#6961ff] ring-4 ring-[#6961ff]/20"></div>
			<div class="h-2 w-2 rounded-full bg-slate-700"></div>
			<div class="h-2 w-2 rounded-full bg-slate-700"></div>
			<span class="ml-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#6961ff]">Step {step} of 4</span>
		</div>

		<GlassPanel blur={24} opacity={0.7} borderOpacity={0.08} rounded="rounded-2xl" class="overflow-hidden shadow-2xl">
			<div class="border-b border-white/5 px-5 pb-5 pt-7 text-center sm:px-7 md:px-9 md:pb-6 md:pt-10">
				<div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#6961ff]/10 text-[#6961ff]">
					<MaterialIcon icon="psychology" size={30} />
				</div>
				<h1 class="text-2xl font-bold tracking-tight text-white sm:text-3xl">Tell us about the business</h1>
				<p class="mx-auto mt-2 max-w-lg text-slate-400">
					Your assistant remembers all of this, so it knows your business from the first message. Skip
					anything you'd rather not answer.
				</p>
			</div>

			<div class="space-y-5 p-4 sm:p-6 md:p-8">
				{#each questions as question}
					<div class="space-y-2">
						<label class="flex items-center gap-2 text-sm font-semibold text-slate-300" for={`q-${question.key}`}>
							<MaterialIcon icon={question.icon} size={16} class="text-[#6961ff]" />
							{question.label}
						</label>
						<textarea
							id={`q-${question.key}`}
							rows="2"
							bind:value={values[question.key]}
							placeholder={question.placeholder}
							class="w-full resize-none rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-white placeholder:text-slate-500 focus:border-[#6961ff] focus:outline-none focus:ring-2 focus:ring-[#6961ff]/50"
						></textarea>
						<p class="ml-1 text-xs text-slate-500">{question.hint}</p>
					</div>
				{/each}
			</div>

			<div class="flex flex-col items-center justify-between gap-3 border-t border-white/5 bg-white/[0.02] px-4 py-4 sm:flex-row sm:px-6 md:px-8 md:py-6">
				<button on:click={goBack} class="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-2.5 font-semibold text-slate-400 transition-all hover:bg-white/5 hover:text-white sm:w-auto">
					<MaterialIcon icon="arrow_back" size={18} />
					Back
				</button>
				<div class="flex w-full items-center gap-3 sm:w-auto sm:gap-4">
					<span class="hidden text-xs text-slate-500 sm:inline">{answeredCount}/{questions.length} answered</span>
					<button on:click={goNext} class="flex w-full items-center justify-center gap-2 rounded-lg bg-[#6961ff] px-8 py-2.5 font-bold text-white shadow-lg shadow-[#6961ff]/20 transition-all hover:bg-[#6961ff]/90 sm:w-auto">
						Continue
						<MaterialIcon icon="arrow_forward" size={18} />
					</button>
				</div>
			</div>
		</GlassPanel>
	</div>
</section>
