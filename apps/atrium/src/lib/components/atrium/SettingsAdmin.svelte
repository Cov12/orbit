<script lang="ts">
	import { onMount } from 'svelte';
	import { departments, activeOrgId } from '$lib/stores/atrium';
	import { user } from '$lib/stores';
	import { getOrganization, getOrgMembers } from '$lib/apis/atrium';
	import GlassPanel from '$lib/components/atrium/shared/GlassPanel.svelte';
	import MaterialIcon from '$lib/components/atrium/shared/MaterialIcon.svelte';
	import Modal from '$lib/components/common/Modal.svelte';

	let orgName = 'Atrium';
	let domain = 'atrium.orbit.example';
	let isLoading = false;

	// Actions that aren't built yet open this notice instead of doing nothing.
	let comingSoon = '';
	let showComingSoon = false;
	function notYet(feature: string) {
		comingSoon = feature;
		showComingSoon = true;
	}

	type TeamMember = {
		initials: string;
		name: string;
		email: string;
		role: string;
		roleStyle: string;
		lastActive: string;
		gradient: boolean;
	};

	let team: TeamMember[] = [];

	const integrations = [
		{ name: 'WorkPipe', desc: 'CRM & Pipeline', enabled: true, icon: 'hub', bg: 'bg-[#6961ff]/10' },
		{ name: 'Google Drive', desc: 'Knowledge Base Sync', enabled: true, icon: 'cloud', bg: 'bg-blue-500/10' },
		{ name: 'GitHub', desc: 'Codebase Automation', enabled: false, icon: 'code', bg: 'bg-[#24292E]/20' },
	];

	const ROLE_STYLES: Record<string, string> = {
		OWNER: 'bg-[#6961ff]/10 text-[#6961ff] border-[#6961ff]/20',
		ADMIN: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
		MEMBER: 'bg-slate-500/10 text-slate-300 border-slate-500/20'
	};

	function getInitials(name: string, email: string) {
		if (name?.trim()) {
			return name
				.split(' ')
				.filter(Boolean)
				.slice(0, 2)
				.map((part) => part[0]?.toUpperCase())
				.join('');
		}

		return email.slice(0, 2).toUpperCase();
	}

	async function loadSettings() {
		const token = ($user as { token?: string } | undefined)?.token;
		if (!token) return;

		isLoading = true;
		try {
			const [organization, membersResponse] = await Promise.all([
				getOrganization(token, $activeOrgId),
				getOrgMembers(token, $activeOrgId)
			]);

			orgName = organization.name || orgName;
			domain = organization.slug ? `${organization.slug}.atrium.orbit.example` : domain;

			const me = $user as { id?: string; name?: string; email?: string } | undefined;
			team = membersResponse.members.map((member) => {
				// The members endpoint returns user IDs only; name the signed-in user and
				// keep everyone else generic rather than showing a raw ID.
				const isMe = !!me?.id && member.user_id === me.id;
				const displayName = (isMe && me?.name) || 'Team Member';
				const email = (isMe && me?.email) || '';
				return {
					initials: getInitials(displayName, email),
					name: isMe ? `${displayName} (you)` : displayName,
					email,
					role: member.role.toUpperCase(),
					roleStyle: ROLE_STYLES[member.role.toUpperCase()] || ROLE_STYLES.MEMBER,
					lastActive: '—',
					gradient: member.role.toUpperCase() === 'OWNER'
				};
			});
		} catch (error) {
			console.error('Failed to load organization settings:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadSettings();
	});

	$: totalAgents = $departments.reduce((a, d) => a + d.agentCount, 0);
	$: activeDeptCount = $departments.filter((d) => d.status === 'active').length;
</script>

<div class="w-full h-full overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:p-12">
	<div class="max-w-5xl mx-auto">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-8 lg:mb-12">
			<div>
				<h2 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100 tracking-tight">Organization Settings</h2>
				<p class="text-sm sm:text-base text-slate-400 mt-1.5 sm:mt-2">Manage your workspace members, permissions, and configuration.</p>
			</div>
			<div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
				<button class="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-slate-100 px-4 sm:px-5 py-2.5 rounded-lg border border-white/10 font-semibold transition-all text-sm" on:click={() => notYet('Audit log export')}>
					<MaterialIcon icon="file_download" size={20} />
					Export Audit Logs
				</button>
				<button class="flex items-center justify-center gap-2 bg-[#6961ff] hover:bg-[#6961ff]/90 text-white px-4 sm:px-5 py-2.5 rounded-lg font-bold shadow-lg shadow-[#6961ff]/20 transition-all text-sm" on:click={() => notYet('Member invitations')}>
					<MaterialIcon icon="person_add" size={20} />
					Invite Member
				</button>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:gap-8">
			<!-- Workspace Details -->
			<GlassPanel class="p-5 sm:p-6 lg:p-8">
				<div class="flex items-center gap-2 mb-6 lg:mb-8">
					<MaterialIcon icon="edit_square" class="text-[#6961ff]" />
					<h3 class="text-base lg:text-lg font-bold text-slate-100">Workspace Details</h3>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">
					<div class="space-y-2">
						<label class="text-sm font-semibold text-slate-400 px-1" for="org-name">Organization Name</label>
						<input id="org-name" bind:value={orgName} class="w-full bg-[#1c1c21] border border-white/10 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-[#6961ff] focus:border-transparent transition-all outline-none text-sm" />
					</div>
					<div class="space-y-2">
						<label class="text-sm font-semibold text-slate-400 px-1" for="workspace-domain">Workspace Domain</label>
						<input id="workspace-domain" bind:value={domain} class="w-full bg-[#1c1c21] border border-white/10 rounded-lg px-4 py-3 text-slate-100 focus:ring-2 focus:ring-[#6961ff] focus:border-transparent transition-all outline-none text-sm" />
					</div>
				</div>
			</GlassPanel>

			<!-- Team -->
			<GlassPanel class="overflow-hidden">
				<div class="p-5 sm:p-6 lg:p-8 pb-3 sm:pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<MaterialIcon icon="groups" class="text-[#20B2AA]" />
						<h3 class="text-base lg:text-lg font-bold text-slate-100">Team Members</h3>
					</div>
					<span class="bg-[#20B2AA]/10 text-[#20B2AA] text-[10px] font-bold px-2 py-1 rounded tracking-wider uppercase w-fit">{isLoading ? 'Loading...' : `${team.length} Active Seat${team.length !== 1 ? 's' : ''}`}</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-left">
						<thead>
							<tr class="border-b border-white/5 text-slate-500 text-xs font-semibold uppercase tracking-wider">
								<th class="px-5 sm:px-8 py-4">User</th>
								<th class="px-5 sm:px-8 py-4">Role</th>
								<th class="px-5 sm:px-8 py-4">Last Active</th>
								<th class="px-5 sm:px-8 py-4 text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							{#each team as member}
								<tr class="hover:bg-white/5 transition-colors">
									<td class="px-5 sm:px-8 py-3 sm:py-4">
										<div class="flex items-center gap-3">
											<div class="size-9 rounded-full {member.gradient ? 'bg-gradient-to-tr from-[#6961ff] to-[#20B2AA]' : 'bg-slate-700'} flex items-center justify-center font-bold text-xs text-white shrink-0">
												{member.initials || member.name.charAt(0)}
											</div>
											<div class="min-w-0">
												<p class="text-sm font-semibold text-slate-100 truncate">{member.name}</p>
												<p class="text-xs text-slate-500 truncate">{member.email}</p>
											</div>
										</div>
									</td>
									<td class="px-5 sm:px-8 py-3 sm:py-4">
										<span class="px-2.5 py-1 rounded-full text-[11px] font-bold {member.roleStyle} border">{member.role}</span>
									</td>
									<td class="px-5 sm:px-8 py-3 sm:py-4 text-sm text-slate-400 font-medium">{member.lastActive}</td>
									<td class="px-5 sm:px-8 py-3 sm:py-4 text-right">
										<button class="text-slate-500 hover:text-white transition-colors" aria-label="Member actions" on:click={() => notYet('Member management')}>
											<MaterialIcon icon="more_horiz" />
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</GlassPanel>

			<!-- Billing + Usage -->
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
				<GlassPanel class="lg:col-span-1 p-5 sm:p-6 lg:p-8 relative overflow-hidden">
					<div class="absolute -top-12 -right-12 size-40 bg-[#6961ff]/10 blur-[60px] rounded-full"></div>
					<div class="relative z-10">
						<div class="flex justify-between items-start mb-4 lg:mb-6">
							<span class="text-xs font-bold uppercase tracking-widest text-[#6961ff]">Overview</span>
							<MaterialIcon icon="verified" class="text-[#6961ff]" />
						</div>
						<h4 class="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">Atrium</h4>
						<p class="text-slate-400 mt-2 text-sm leading-relaxed">{activeDeptCount} departments active, {totalAgents} agents deployed.</p>
						<div class="mt-6 lg:mt-8 space-y-2">
							<div class="flex justify-between text-sm">
								<span class="text-slate-400">Departments</span>
								<span class="text-white font-medium">{$departments.length}</span>
							</div>
							<div class="flex justify-between text-sm">
								<span class="text-slate-400">Total Agents</span>
								<span class="text-white font-medium">{totalAgents}</span>
							</div>
						</div>
					</div>
				</GlassPanel>

				<GlassPanel class="lg:col-span-2 p-5 sm:p-6 lg:p-8">
					<div class="flex items-center justify-between gap-2 mb-6 lg:mb-8">
						<div class="flex items-center gap-2">
							<MaterialIcon icon="analytics" class="text-[#6961ff]" />
							<h3 class="text-base lg:text-lg font-bold text-slate-100">Resource Usage</h3>
						</div>
						<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-1 rounded tracking-wider uppercase">Coming soon</span>
					</div>
					<div class="space-y-6 lg:space-y-8 opacity-60" aria-disabled="true">
						<div class="space-y-3">
							<div class="flex justify-between items-end">
								<span class="text-sm font-semibold text-slate-100">AI Tokens Processed</span>
								<span class="text-xs font-medium text-slate-400">— / —</span>
							</div>
							<div class="w-full h-3 bg-white/5 rounded-full overflow-hidden">
								<div class="h-full bg-gradient-to-r from-[#6961ff] to-[#20B2AA] rounded-full" style="width: 0%"></div>
							</div>
						</div>
						<div class="space-y-3">
							<div class="flex justify-between items-end">
								<span class="text-sm font-semibold text-slate-100">Automated Workflows</span>
								<span class="text-xs font-medium text-slate-400">— / —</span>
							</div>
							<div class="w-full h-3 bg-white/5 rounded-full overflow-hidden">
								<div class="h-full bg-[#20B2AA] rounded-full" style="width: 0%"></div>
							</div>
						</div>
					</div>
				</GlassPanel>
			</div>

			<!-- Integrations -->
			<GlassPanel class="p-5 sm:p-6 lg:p-8">
				<div class="flex items-center justify-between mb-6 lg:mb-8">
					<div class="flex items-center gap-2">
						<MaterialIcon icon="grid_view" class="text-[#6961ff]" />
						<h3 class="text-base lg:text-lg font-bold text-slate-100">Connected Services</h3>
					</div>
					<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-1 rounded tracking-wider uppercase">Coming soon</span>
				</div>
				<p class="text-sm text-slate-400 -mt-3 mb-5 lg:mb-6">Managing connections from here is coming soon. Your assistant already works with your CRM data.</p>
				<div class="opacity-60 pointer-events-none select-none" aria-disabled="true">
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
					{#each integrations as integ}
						<div class="bg-[#1c1c21]/50 border border-white/10 p-4 sm:p-5 rounded-xl flex items-center gap-4 hover:border-[#6961ff]/30 transition-all {integ.enabled ? '' : 'opacity-70'}">
							<div class="size-10 sm:size-12 rounded-lg {integ.bg} flex items-center justify-center shrink-0">
								<MaterialIcon icon={integ.icon} class="text-white" />
							</div>
							<div class="flex-1 min-w-0">
								<h5 class="text-sm font-bold text-slate-100">{integ.name}</h5>
								<p class="text-[11px] text-slate-500">{integ.desc}</p>
							</div>
							<label class="relative inline-flex items-center cursor-pointer shrink-0 p-2">
								<input type="checkbox" checked={integ.enabled} disabled tabindex="-1" class="sr-only peer" />
								<div class="w-11 h-6 bg-white/10 rounded-full transition-all peer peer-checked:bg-[#6961ff]"></div>
								<div class="absolute left-3 top-3 bg-slate-300 size-4 rounded-full transition-all peer-checked:translate-x-5 peer-checked:bg-white"></div>
							</label>
						</div>
					{/each}
				</div>
				</div>
			</GlassPanel>
		</div>
	</div>
</div>

<Modal bind:show={showComingSoon} size="sm" className="bg-[#16161a] border border-white/10 rounded-2xl">
	<div class="p-6 sm:p-8 text-center">
		<div class="mx-auto mb-4 size-12 rounded-full bg-[#6961ff]/10 flex items-center justify-center">
			<MaterialIcon icon="schedule" class="text-[#6961ff]" />
		</div>
		<h3 class="text-lg font-bold text-slate-100">Coming soon</h3>
		<p class="text-sm text-slate-400 mt-2">{comingSoon} isn't available yet. We're working on it.</p>
		<button class="mt-6 bg-[#6961ff] hover:bg-[#6961ff]/90 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-all" on:click={() => (showComingSoon = false)}>Got it</button>
	</div>
</Modal>