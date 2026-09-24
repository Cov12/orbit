import { expect, test, type Page, type Route } from '@playwright/test';

const token = 'atrium-smoke-token';
const user = {
	id: 'atrium-smoke-user',
	email: 'smoke@example.test',
	name: 'Atrium Smoke User',
	role: 'admin',
	token
};
const org = {
	id: 'org-smoke',
	name: 'Smoke Org',
	slug: 'smoke-org',
	plan: 'pro',
	settings: { sub_account_id: 'settings-derived-sub-must-not-win' }
};
const subAccounts = [
	{ id: 'sub-smoke', name: 'Smoke Sub One', slug: 'smoke-one' },
	{ id: 'sub-two', name: 'Smoke Sub Two', slug: 'smoke-two' }
];

type StoredChat = {
	id: string;
	title: string;
	chat: Record<string, any>;
	created_at: number;
	updated_at: number;
	time_range?: string;
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

function responseJson(route: Route, body: unknown, status = 200) {
	return route.fulfill({
		status,
		contentType: 'application/json',
		headers: {
			'Access-Control-Allow-Origin': 'http://127.0.0.1:5050',
			'Access-Control-Allow-Credentials': 'true',
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
		},
		body: JSON.stringify(body)
	});
}

function createSeedChat(
	id: string,
	title: string,
	source: 'atrium' | 'atrium_voice',
	orgId: string,
	subAccountId: string | null,
	messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>
): StoredChat {
	const history = {
		messages: Object.fromEntries(
			messages.map((message, index) => [
				message.id,
				{
					...message,
					parentId: index === 0 ? null : messages[index - 1].id,
					childrenIds: messages[index + 1] ? [messages[index + 1].id] : [],
					timestamp: nowSeconds()
				}
			])
		),
		currentId: messages.at(-1)?.id ?? null
	};

	return {
		id,
		title,
		created_at: nowSeconds(),
		updated_at: nowSeconds(),
		time_range: 'Just now',
		chat: {
			id,
			title,
			history,
			messages,
			atrium: {
				atrium: true,
				source,
				org_id: orgId,
				sub_account_id: subAccountId,
				department_slug: 'chief',
				target_type: 'chief',
				target_id: 'chief',
				employee_tab_id: null,
				agent_id: null,
				agent_name: 'Orbit Assistant'
			}
		}
	};
}

async function installAtriumMocks(page: Page) {
	const chats = new Map<string, StoredChat>();
	let activeSubAccountId: string | null = 'sub-smoke';
	let createCounter = 0;
	const createdIds: string[] = [];
	const chiefChatRequests: any[] = [];

	const inScopeSeed = createSeedChat(
		'seed-text-chat',
		'Seeded Atrium Thread',
		'atrium',
		org.id,
		'sub-smoke',
		[
			{ id: 'seed-user', role: 'user', content: 'Seeded user message' },
			{ id: 'seed-assistant', role: 'assistant', content: 'Seeded assistant response' }
		]
	);
	const voiceSeed = createSeedChat(
		'seed-voice-chat',
		'Seeded Voice Thread',
		'atrium_voice',
		org.id,
		'sub-smoke',
		[
			{ id: 'voice-user', role: 'user', content: 'Seeded voice transcription' },
			{ id: 'voice-assistant', role: 'assistant', content: 'Seeded voice response' }
		]
	);
	const secondSubAccountSeed = createSeedChat(
		'seed-sub-two-chat',
		'Seeded Sub Two Thread',
		'atrium',
		org.id,
		'sub-two',
		[{ id: 'sub-two-user', role: 'user', content: 'This only belongs to sub two' }]
	);
	const businessScopeSeed = createSeedChat(
		'seed-business-chat',
		'Seeded Business Scope Thread',
		'atrium',
		org.id,
		null,
		[{ id: 'business-user', role: 'user', content: 'This only belongs to business scope' }]
	);
	const outOfScopeSeed = createSeedChat(
		'neighbor-chat',
		'Neighbor Org Thread',
		'atrium',
		'org-neighbor',
		'sub-neighbor',
		[{ id: 'neighbor-user', role: 'user', content: 'This must not be listed in Atrium recents' }]
	);
	for (const chat of [
		inScopeSeed,
		voiceSeed,
		secondSubAccountSeed,
		businessScopeSeed,
		outOfScopeSeed
	])
		chats.set(chat.id, chat);

	await page.route('**/*', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;

		if (!url.href.startsWith('http://127.0.0.1:8080')) return route.fallback();

		if (path.startsWith('/ws/socket.io') || path.startsWith('/socket.io')) {
			return responseJson(route, {
				sid: 'smoke-socket',
				upgrades: [],
				pingInterval: 25_000,
				pingTimeout: 20_000
			});
		}
		if (path === '/api/config') {
			return responseJson(route, {
				name: 'Open WebUI Smoke',
				version: 'smoke',
				default_locale: 'en-US',
				features: {
					enable_websocket: false,
					enable_direct_connections: false,
					enable_community_sharing: false
				}
			});
		}
		if (path === '/api/version')
			return responseJson(route, { version: 'smoke', deployment_id: 'smoke' });
		if (path === '/api/v1/auths/') return responseJson(route, user);
		if (path === '/api/v1/users/user/settings') {
			return responseJson(route, {
				ui: {
					showChangelog: false,
					version: 'smoke'
				}
			});
		}
		if (path === '/api/v1/configs/banners') return responseJson(route, []);
		if (path === '/api/v1/tools/') return responseJson(route, []);
		if (path === '/api/v1/channels/') return responseJson(route, []);
		if (path === '/api/models') return responseJson(route, { data: [] });

		if (path === '/api/atrium/orgs/' && request.method() === 'GET')
			return responseJson(route, [org]);
		if (path === `/api/atrium/orgs/${org.id}/subaccounts` && request.method() === 'GET') {
			return responseJson(route, {
				subAccounts,
				activeSubAccountId,
				syncOk: true,
				publicOrigin: 'http://127.0.0.1:5050'
			});
		}
		if (path === `/api/atrium/orgs/${org.id}/subaccounts/select` && request.method() === 'POST') {
			const body = request.postDataJSON();
			activeSubAccountId = body.subAccountId ?? null;
			return responseJson(route, { selected: activeSubAccountId });
		}
		if (path === '/api/atrium/employee-tabs/' && request.method() === 'GET') {
			return responseJson(route, { tabs: [], total: 0 });
		}
		if (path === '/api/atrium/departments/chief/chat' && request.method() === 'POST') {
			const body = request.postDataJSON();
			chiefChatRequests.push(body);
			return responseJson(route, {
				department: 'chief',
				model_tier: 'standard',
				model: 'smoke-model',
				content: `Smoke response to: ${body.message}`,
				proposals: [],
				usage: {},
				status: 'success'
			});
		}

		if (path === '/api/v1/chats/' && request.method() === 'GET') {
			return responseJson(
				route,
				Array.from(chats.values()).map((chat) => ({
					id: chat.id,
					title: chat.title,
					updated_at: chat.updated_at,
					created_at: chat.created_at,
					time_range: chat.time_range
				}))
			);
		}
		if (path === '/api/v1/chats/new' && request.method() === 'POST') {
			createCounter += 1;
			const body = request.postDataJSON();
			const id = `ui-created-chat-${createCounter}`;
			const chat: StoredChat = {
				id,
				title: body?.chat?.title ?? body?.title ?? 'Atrium Chat',
				chat: { ...body.chat, id },
				created_at: nowSeconds(),
				updated_at: nowSeconds(),
				time_range: 'Just now'
			};
			chats.set(id, chat);
			createdIds.push(id);
			return responseJson(route, chat);
		}
		const chatIdMatch = path.match(/^\/api\/v1\/chats\/([^/]+)$/);
		if (chatIdMatch) {
			const chatId = chatIdMatch[1];
			if (request.method() === 'GET') {
				const chat = chats.get(chatId);
				return chat ? responseJson(route, chat) : responseJson(route, { detail: 'not found' }, 404);
			}
			if (request.method() === 'POST') {
				const body = request.postDataJSON();
				const existing = chats.get(chatId);
				const chat: StoredChat = {
					id: chatId,
					title: body?.chat?.title ?? existing?.title ?? 'Atrium Chat',
					chat: { ...body.chat, id: chatId },
					created_at: existing?.created_at ?? nowSeconds(),
					updated_at: nowSeconds(),
					time_range: 'Just now'
				};
				chats.set(chatId, chat);
				return responseJson(route, chat);
			}
		}

		return responseJson(
			route,
			{ detail: `Unhandled smoke mock: ${request.method()} ${path}` },
			404
		);
	});

	return { chats, createdIds, chiefChatRequests };
}

test('Atrium chat persists through Open WebUI chat APIs and rehydrates from recents', async ({
	page
}) => {
	const mockState = await installAtriumMocks(page);

	await page.addInitScript(
		({ smokeToken, smokeOrgId }) => {
			window.localStorage.setItem('token', smokeToken);
			window.localStorage.setItem('atrium-org-id', smokeOrgId);
			window.localStorage.setItem('settings', JSON.stringify({}));
		},
		{ smokeToken: token, smokeOrgId: org.id }
	);

	await page.goto('/atrium/chat');
	await expect(page.getByTestId('atrium-chat-page')).toBeVisible();

	const onboardingCta = page.getByRole('button', { name: /Let's Build/i });
	if (await onboardingCta.isVisible().catch(() => false)) {
		await onboardingCta.click();
		await expect(onboardingCta).toBeHidden();
	}

	const recents = page.getByTestId('atrium-recent-chat');
	await expect(recents.filter({ hasText: 'Seeded Atrium Thread' })).toBeVisible();
	await expect(recents.filter({ hasText: 'Seeded Voice Thread' })).toBeVisible();
	await expect(page.getByText('Seeded Sub Two Thread')).toHaveCount(0);
	await expect(page.getByText('Seeded Business Scope Thread')).toHaveCount(0);
	await expect(page.getByText('Neighbor Org Thread')).toHaveCount(0);
	await expect(page.getByText('This must not be listed in Atrium recents')).toHaveCount(0);

	await page.getByRole('button', { name: /Scope: Smoke Sub One/i }).click();
	await page.getByRole('button', { name: /Smoke Sub Two/i }).click();
	await expect(recents.filter({ hasText: 'Seeded Sub Two Thread' })).toBeVisible();
	await expect(page.getByText('Seeded Atrium Thread')).toHaveCount(0);
	await expect(page.getByText('Seeded Voice Thread')).toHaveCount(0);
	await expect(page.getByText('Seeded Business Scope Thread')).toHaveCount(0);

	await page.getByRole('button', { name: /Scope: Smoke Sub Two/i }).click();
	await page.getByRole('button', { name: /^Business/i }).click();
	await expect(recents.filter({ hasText: 'Seeded Business Scope Thread' })).toBeVisible();
	await expect(page.getByText('Seeded Sub Two Thread')).toHaveCount(0);
	await expect(page.getByText('Seeded Atrium Thread')).toHaveCount(0);

	await page.getByRole('button', { name: /Scope: Business/i }).click();
	await page.getByRole('button', { name: /Smoke Sub One/i }).click();
	await expect(recents.filter({ hasText: 'Seeded Atrium Thread' })).toBeVisible();
	await expect(recents.filter({ hasText: 'Seeded Voice Thread' })).toBeVisible();

	await page.getByTestId('atrium-new-chat').click();
	await page.getByTestId('atrium-chat-input').fill('First UI smoke turn');
	await page.getByTestId('atrium-chat-send').click();
	await expect(
		page
			.locator('[data-testid="atrium-chat-message"][data-role="user"]')
			.filter({ hasText: 'First UI smoke turn' })
	).toBeVisible();
	await expect(
		page
			.locator('[data-testid="atrium-chat-message"][data-role="ai"]')
			.filter({ hasText: 'Smoke response to: First UI smoke turn' })
	).toBeVisible();

	await page.getByTestId('atrium-chat-input').fill('Second UI smoke turn');
	await page.getByTestId('atrium-chat-send').click();
	await expect(
		page
			.locator('[data-testid="atrium-chat-message"][data-role="user"]')
			.filter({ hasText: 'Second UI smoke turn' })
	).toBeVisible();
	await expect(
		page
			.locator('[data-testid="atrium-chat-message"][data-role="ai"]')
			.filter({ hasText: 'Smoke response to: Second UI smoke turn' })
	).toBeVisible();

	expect(mockState.createdIds).toHaveLength(1);
	const createdId = mockState.createdIds[0];
	expect(mockState.chiefChatRequests.map((request) => request.chat_id)).toEqual([
		createdId,
		createdId
	]);

	const persisted = mockState.chats.get(createdId);
	expect(persisted?.chat?.atrium).toMatchObject({
		atrium: true,
		source: 'atrium',
		org_id: org.id,
		sub_account_id: 'sub-smoke',
		department_slug: 'chief',
		target_type: 'chief'
	});
	expect(
		Object.values(persisted?.chat?.history?.messages ?? {}).map((message: any) => message.content)
	).toEqual([
		'First UI smoke turn',
		'Smoke response to: First UI smoke turn',
		'Second UI smoke turn',
		'Smoke response to: Second UI smoke turn'
	]);

	await page.reload();
	await expect(page.getByTestId('atrium-chat-page')).toBeVisible();
	await expect(
		page.getByTestId('atrium-recent-chat').filter({ hasText: 'First UI smoke turn' })
	).toBeVisible();
	await page.getByTestId('atrium-recent-chat').filter({ hasText: 'First UI smoke turn' }).click();
	await expect(
		page
			.locator('[data-testid="atrium-chat-message"][data-role="user"]')
			.filter({ hasText: 'First UI smoke turn' })
	).toBeVisible();
	await expect(
		page
			.locator('[data-testid="atrium-chat-message"][data-role="user"]')
			.filter({ hasText: 'Second UI smoke turn' })
	).toBeVisible();
	await expect(page.getByTestId('atrium-chat-message')).toHaveCount(4);
});
