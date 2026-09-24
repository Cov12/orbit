<script lang="ts">
	import { goto } from '$app/navigation';
	import GlassPanel from '$lib/components/atrium/shared/GlassPanel.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import AssistedSetup from '$lib/components/atrium/onboarding/AssistedSetup.svelte';
	import { user } from '$lib/stores';
	import {
		activeOrgId,
		departments,
		mergeOnboardingAnswers,
		onboardingAnswers,
		preselectDepartmentsByRole
	} from '$lib/stores/atrium';
	import { suggestOnboardingRoles, type OnboardingAnswers } from '$lib/apis/atrium';

	export let step: number;

	/** Manual picking is the default; the interview is an opt-in detour that always comes
	 * back here with the cards (suggested ones pre-switched on) for the user to confirm. */
	let mode: 'manual' | 'interview' | 'suggesting' = 'manual';
	/** Outcome of the last assisted run, shown above the cards. Never blocks Continue. */
	let assisted: { kind: 'suggested' | 'failed'; ids: Set<string>; rationale: Record<string, string> } | null = null;
	/** Bumped on every run/cancel so a slow suggest response can't land after the user left. */
	let requestSeq = 0;

	function authToken(): string | undefined {
		return (($user as { token?: string } | undefined)?.token ??
			(typeof localStorage !== 'undefined' ? localStorage.token : undefined)) as
			| string
			| undefined;
	}

	function startInterview() {
		assisted = null;
		mode = 'interview';
	}

	function backToManual() {
		requestSeq += 1;
		mode = 'manual';
	}

	function fallBack() {
		assisted = { kind: 'failed', ids: new Set(), rationale: {} };
		mode = 'manual';
	}

	/** Interview done: keep the answers for the Engram seed, then ask for a suggestion and
	 * pre-select it. Any failure (502, empty, network, no org) lands on manual picking. */
	async function finishInterview(answers: Partial<Record<keyof OnboardingAnswers, string>>) {
		onboardingAnswers.update((current) => mergeOnboardingAnswers(current, answers));

		const token = authToken();
		const orgId = $activeOrgId;
		if (!token || !orgId || !Object.values(answers).some((a) => a?.trim())) {
			fallBack();
			return;
		}

		const seq = ++requestSeq;
		mode = 'suggesting';
		try {
			const result = await suggestOnboardingRoles(token, orgId, $onboardingAnswers);
			if (seq !== requestSeq) return;
			const { departments: next, matchedIds } = preselectDepartmentsByRole(
				$departments,
				result?.roles ?? []
			);
			if (matchedIds.length === 0) {
				fallBack();
				return;
			}
			departments.set(next);
			const rationaleByRole = Object.fromEntries(
				(result?.suggestions ?? []).map((s) => [s.role.trim().toLowerCase(), s.rationale])
			);
			assisted = {
				kind: 'suggested',
				ids: new Set(matchedIds),
				rationale: Object.fromEntries(
					next
						.filter((d) => matchedIds.includes(d.id) && rationaleByRole[d.role.trim().toLowerCase()])
						.map((d) => [d.id, rationaleByRole[d.role.trim().toLowerCase()]])
				)
			};
			mode = 'manual';
		} catch (error) {
			if (seq !== requestSeq) return;
			console.error('Failed to suggest onboarding departments', error);
			fallBack();
		}
	}

	function isChecked(status: string) {
		return status === 'active';
	}

	function toggleDepartment(id: string, checked: boolean) {
		departments.update((items) =>
			items.map((dept) => {
				if (dept.id !== id) return dept;
				return {
					...dept,
					status: checked ? 'active' : 'inactive'
				};
			})
		);
	}

	function goBack() {
		goto('/atrium/onboarding/step2');
	}

	function goNext() {
		goto('/atrium/onboarding/step4');
	}
</script>

<section class="relative min-h-screen overflow-hidden bg-[#0f0f13] px-4 py-8 text-slate-100 sm:px-6 md:py-10">
	<div class="pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-[#6961ff]/20 blur-3xl"></div>
	<div class="pointer-events-none absolute -bottom-20 -right-16 h-80 w-80 rounded-full bg-[#20B2AA]/10 blur-3xl"></div>

	<div class="relative mx-auto w-full max-w-3xl">
		<div class="mb-8 flex items-center justify-center gap-3">
			<div class="h-2 w-2 rounded-full bg-[#6961ff]/40"></div>
			<div class="h-2 w-2 rounded-full bg-[#6961ff]/40"></div>
			<div class="h-2 w-2 rounded-full bg-[#6961ff] ring-4 ring-[#6961ff]/20"></div>
			<div class="h-2 w-2 rounded-full bg-slate-700"></div>
			<span class="ml-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#6961ff]">Step {step} of 4</span>
		</div>

		<GlassPanel blur={24} opacity={0.7} borderOpacity={0.08} rounded="rounded-2xl" class="overflow-hidden shadow-2xl">
			<div class="border-b border-white/5 px-5 pb-5 pt-7 text-center sm:px-7 md:px-9 md:pb-6 md:pt-10">
				<div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#6961ff]/10 text-[#6961ff]">
					<MaterialIcon icon="category" size={30} />
				</div>
				<h1 class="text-2xl font-bold tracking-tight text-white sm:text-3xl">Activate Your Departments</h1>
				<p class="mx-auto mt-2 max-w-lg text-slate-400">Choose the core areas of your agency you want to manage. You can always change this later in settings.</p>
			</div>

			{#if mode === 'interview'}
				<AssistedSetup onComplete={finishInterview} onCancel={backToManual} />
			{:else if mode === 'suggesting'}
				<div class="flex flex-col items-center gap-4 px-6 py-14 text-center">
					<div class="flex items-center gap-2 text-[#6961ff]">
						<span class="h-2 w-2 animate-bounce rounded-full bg-[#6961ff]"></span>
						<span class="h-2 w-2 animate-bounce rounded-full bg-[#6961ff] [animation-delay:150ms]"></span>
						<span class="h-2 w-2 animate-bounce rounded-full bg-[#6961ff] [animation-delay:300ms]"></span>
					</div>
					<p class="text-sm text-slate-300">Looking at your answers to suggest a team…</p>
					<button on:click={backToManual} class="text-xs font-semibold text-slate-400 transition-colors hover:text-white">
						Skip — I'll pick myself
					</button>
				</div>
			{:else}
			<div class="space-y-3 p-4 sm:p-5 md:p-6">
				{#if assisted?.kind === 'suggested'}
					<div class="flex items-start gap-3 rounded-lg border border-[#6961ff]/30 bg-[#6961ff]/10 p-4 text-sm text-slate-200">
						<MaterialIcon icon="auto_awesome" size={18} class="mt-0.5 shrink-0 text-[#6961ff]" />
						<p>Based on your answers, we suggest these — adjust anything before continuing.</p>
					</div>
				{:else if assisted?.kind === 'failed'}
					<div class="flex items-start gap-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-slate-300">
						<MaterialIcon icon="info" size={18} class="mt-0.5 shrink-0 text-amber-300" />
						<p>We couldn't generate suggestions just now — pick the departments you want.</p>
					</div>
				{/if}

				{#if assisted?.kind !== 'suggested'}
					<div class="flex flex-col items-start justify-between gap-3 rounded-lg border border-dashed border-[#6961ff]/30 p-4 sm:flex-row sm:items-center">
						<div>
							<p class="font-semibold text-white">Not sure which you need?</p>
							<p class="text-sm text-slate-400">Answer a few quick questions and we'll suggest a team.</p>
						</div>
						<button on:click={startInterview} class="flex shrink-0 items-center gap-2 rounded-lg border border-[#6961ff]/40 px-4 py-2 text-sm font-semibold text-[#6961ff] transition-all hover:bg-[#6961ff]/10">
							<MaterialIcon icon="auto_awesome" size={16} />
							Help me decide
						</button>
					</div>
				{/if}

				{#each $departments as dept}
					<div class="group flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-4 transition-all hover:border-[#6961ff]/50">
						<div class="flex min-w-0 items-center gap-3 sm:gap-4">
							<div class={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg shadow-black/20 ${dept.gradient}`}>
								<MaterialIcon icon={dept.icon} size={22} class="text-white" />
							</div>
							<div class="min-w-0">
								<h3 class="flex items-center gap-2 font-semibold text-white">
									{dept.name}
									{#if assisted?.ids.has(dept.id)}
										<span class="rounded-full bg-[#6961ff]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6961ff]">Suggested</span>
									{/if}
								</h3>
								<p class="hidden truncate text-sm text-slate-400 sm:block">{dept.description}</p>
								{#if assisted?.rationale[dept.id]}
									<p class="mt-1 text-xs text-slate-400">{assisted.rationale[dept.id]}</p>
								{/if}
							</div>
						</div>

						<label class="relative flex h-[31px] w-[51px] cursor-pointer items-center rounded-full bg-slate-700 p-0.5 transition-colors has-[:checked]:bg-[#6961ff]">
							<input
								type="checkbox"
								checked={isChecked(dept.status)}
								on:change={(event) => toggleDepartment(dept.id, (event.currentTarget as HTMLInputElement).checked)}
								class="peer invisible absolute"
							/>
							<div class="h-full w-[27px] rounded-full bg-white shadow-sm transition-all peer-checked:translate-x-5"></div>
						</label>
					</div>
				{/each}

				{#if assisted?.kind === 'suggested'}
					<button on:click={startInterview} class="flex items-center gap-1 text-xs font-semibold text-slate-400 transition-colors hover:text-white">
						<MaterialIcon icon="refresh" size={14} />
						Retake the questions
					</button>
				{/if}
			</div>
			{/if}

			{#if mode === 'manual'}
			<div class="flex flex-col items-center justify-between gap-3 border-t border-white/5 bg-white/[0.02] px-4 py-4 sm:flex-row sm:px-6 md:px-8 md:py-6">
				<button on:click={goBack} class="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-2.5 font-semibold text-slate-400 transition-all hover:bg-white/5 hover:text-white sm:w-auto">
					<MaterialIcon icon="arrow_back" size={18} />
					Back
				</button>
				<div class="flex w-full items-center gap-3 sm:w-auto sm:gap-4">
					<span class="hidden text-xs text-slate-500 sm:inline">Auto-saving selection...</span>
					<button on:click={goNext} class="flex w-full items-center justify-center gap-2 rounded-lg bg-[#6961ff] px-8 py-2.5 font-bold text-white shadow-lg shadow-[#6961ff]/20 transition-all hover:bg-[#6961ff]/90 sm:w-auto">
						Continue
						<MaterialIcon icon="arrow_forward" size={18} />
					</button>
				</div>
			</div>
			{/if}
		</GlassPanel>
	</div>
</section>
