import { expect, test, type Page, type Route } from '@playwright/test';

const token = 'atrium-notes-smoke-token';
const user = {
	id: 'atrium-notes-user',
	email: 'notes-smoke@example.test',
	name: 'Atrium Notes User',
	role: 'admin',
	token
};
const org = {
	id: 'org-notes-smoke',
	name: 'Notes Smoke Org',
	slug: 'notes-smoke-org',
	plan: 'pro',
	settings: {}
};

type StoredNote = {
	id: string;
	title: string;
	data: Record<string, any>;
	meta: Record<string, any> | null;
	access_grants: any[];
	user_id: string;
	user: typeof user;
	write_access?: boolean;
	created_at: number;
	updated_at: number;
};

const nowNs = () => Date.now() * 1_000_000;

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

function createSeedNote(
	id: string,
	title: string,
	md: string,
	meta: Record<string, any> | null = null
): StoredNote {
	return {
		id,
		title,
		data: {
			content: {
				json: null,
				html: md,
				md
			},
			versions: [],
			files: null
		},
		meta,
		access_grants: [],
		user_id: user.id,
		user,
		write_access: true,
		created_at: nowNs(),
		updated_at: nowNs()
	};
}

async function installAtriumNotesMocks(page: Page) {
	const notes = new Map<string, StoredNote>();
	const createdIds: string[] = [];
	let createCounter = 0;

	notes.set(
		'manual-note',
		createSeedNote('manual-note', 'Manual Client Prep', 'Bring the proposal draft.')
	);
	notes.set(
		'assistant-note',
		createSeedNote('assistant-note', 'Call Summary From Chat', 'Saved by the assistant.', {
			atrium: true,
			created_by: 'assistant',
			source: 'atrium_chat',
			assistant_name: 'Orbit Assistant',
			source_chat_id: 'chat-smoke'
		})
	);

	await page.route('**/*', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;

		if (!url.href.startsWith('http://127.0.0.1:8080')) return route.fallback();

		if (path.startsWith('/ws/socket.io') || path.startsWith('/socket.io')) {
			return responseJson(route, {
				sid: 'notes-smoke-socket',
				upgrades: [],
				pingInterval: 25_000,
				pingTimeout: 20_000
			});
		}
		if (path === '/api/config') {
			return responseJson(route, {
				name: 'Open WebUI Notes Smoke',
				version: 'smoke',
				default_locale: 'en-US',
				features: {
					enable_notes: true,
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
			return responseJson(route, { ui: { showChangelog: false, version: 'smoke' } });
		}
		if (path === '/api/v1/configs/banners') return responseJson(route, []);
		if (path === '/api/v1/tools/') return responseJson(route, []);
		if (path === '/api/v1/channels/') return responseJson(route, []);
		if (path === '/api/models') return responseJson(route, { data: [] });
		if (path === '/api/atrium/orgs/' && request.method() === 'GET')
			return responseJson(route, [org]);
		if (path === `/api/atrium/orgs/${org.id}/subaccounts` && request.method() === 'GET') {
			return responseJson(route, {
				subAccounts: [],
				activeSubAccountId: null,
				syncOk: true,
				publicOrigin: 'http://127.0.0.1:5050'
			});
		}

		if (path === '/api/v1/notes/search' && request.method() === 'GET') {
			const query = url.searchParams.get('query')?.toLowerCase() ?? '';
			const page = Number(url.searchParams.get('page') ?? '1');
			const items = Array.from(notes.values()).filter((note) =>
				`${note.title} ${note.data?.content?.md ?? ''}`.toLowerCase().includes(query)
			);
			return responseJson(route, { items: page > 1 ? [] : items, total: items.length });
		}
		if (path === '/api/v1/notes/create' && request.method() === 'POST') {
			createCounter += 1;
			const body = request.postDataJSON();
			const id = `created-note-${createCounter}`;
			const note = createSeedNote(id, body.title, body.data?.content?.md ?? '', body.meta ?? null);
			note.data = body.data;
			note.access_grants = body.access_grants ?? [];
			notes.set(id, note);
			createdIds.push(id);
			return responseJson(route, note);
		}
		const noteMatch = path.match(/^\/api\/v1\/notes\/([^/]+)$/);
		if (noteMatch && request.method() === 'GET') {
			const note = notes.get(noteMatch[1]);
			return note
				? responseJson(route, { ...note, write_access: true })
				: responseJson(route, { detail: 'not found' }, 404);
		}

		return responseJson(
			route,
			{ detail: `Unhandled Atrium notes smoke mock: ${request.method()} ${path}` },
			404
		);
	});

	return { notes, createdIds };
}

test('Atrium notes render branded routes and preserve Atrium note provenance', async ({
	page
}) => {
	const mockState = await installAtriumNotesMocks(page);

	await page.addInitScript(
		({ smokeToken, smokeOrgId }) => {
			window.localStorage.setItem('token', smokeToken);
			window.localStorage.setItem('atrium-org-id', smokeOrgId);
			window.localStorage.setItem('settings', JSON.stringify({}));
		},
		{ smokeToken: token, smokeOrgId: org.id }
	);

	await page.goto('/atrium/notes');
	await expect(page.getByTestId('atrium-notes-page')).toBeVisible();
	await expect(page.locator('a[href="/atrium/notes"]')).toBeVisible();
	await expect(
		page.getByTestId('atrium-note-card').filter({ hasText: 'Manual Client Prep' })
	).toBeVisible();
	await expect(
		page.getByTestId('atrium-note-card').filter({ hasText: 'Call Summary From Chat' })
	).toBeVisible();
	await expect(
		page.getByTestId('atrium-note-ai-badge').filter({ hasText: 'Orbit Assistant' })
	).toBeVisible();

	await page.locator('a[href="/atrium/notes/assistant-note"]').click();
	await expect(page).toHaveURL(/\/atrium\/notes\/assistant-note$/);
	await expect(page.getByTestId('atrium-note-editor')).toBeVisible();
	await expect(
		page.getByTestId('atrium-note-ai-badge').filter({ hasText: 'Orbit Assistant' })
	).toBeVisible();

	await page.goto('/atrium/notes');
	await page.getByTestId('atrium-new-note').click();
	expect(mockState.createdIds).toHaveLength(1);
	const uiCreated = mockState.notes.get(mockState.createdIds[0]);
	expect(uiCreated?.meta).toMatchObject({
		atrium: true,
		created_by: 'user',
		source: 'atrium_notes'
	});
	await expect(page).toHaveURL(new RegExp(`/atrium/notes/${mockState.createdIds[0]}$`));

	await page.goto(
		'/atrium/notes/new?title=Assistant%20Followup&content=Saved%20from%20chat&source=atrium_chat&assistant_name=Orbit%20Assistant'
	);
	await expect(page).toHaveURL(/\/atrium\/notes\/created-note-2$/);
	const assistantCreated = mockState.notes.get('created-note-2');
	expect(assistantCreated?.meta).toMatchObject({
		atrium: true,
		created_by: 'assistant',
		source: 'atrium_chat',
		assistant_name: 'Orbit Assistant'
	});
});
