import { describe, expect, it } from 'vitest';

import {
	agencyMessagesToOpenWebUIChat,
	createAtriumChatPayload,
	generateAtriumChatTitle,
	isAtriumChatForScope,
	openWebUIChatToAgencyMessages,
	type AtriumChatMessage,
	type AtriumChatMetadata
} from './atriumChatHistory';

const metadata: AtriumChatMetadata = {
	atrium: true,
	source: 'atrium',
	org_id: 'org-1',
	sub_account_id: 'sub-1',
	department_slug: 'chief',
	target_type: 'chief',
	target_id: 'chief',
	employee_tab_id: null,
	agent_id: null,
	agent_name: 'Orbit Assistant'
};

const agencyMessages: AtriumChatMessage[] = [
	{
		id: 'user-1',
		role: 'user',
		content: 'Build a lead follow-up sequence',
		time: '2026-09-09T19:00:00.000Z'
	},
	{
		id: 'assistant-1',
		role: 'ai',
		persona: 'Orbit Assistant',
		content: 'I can draft that sequence.',
		time: '2026-09-09T19:01:00.000Z'
	}
];

describe('atriumChatHistory', () => {
	it('converts Atrium messages into the Open WebUI chat shape', () => {
		const payload = agencyMessagesToOpenWebUIChat(agencyMessages, metadata);

		expect(payload.title).toBe('Build a lead follow-up sequence');
		expect(payload.models).toEqual(['atrium']);
		expect(payload.atrium).toEqual(metadata);
		expect(payload.history.currentId).toBe('assistant-1');
		expect(payload.history.messages['user-1']).toMatchObject({
			id: 'user-1',
			parentId: null,
			childrenIds: ['assistant-1'],
			role: 'user',
			content: 'Build a lead follow-up sequence'
		});
		expect(payload.history.messages['assistant-1']).toMatchObject({
			id: 'assistant-1',
			parentId: 'user-1',
			childrenIds: [],
			role: 'assistant',
			content: 'I can draft that sequence.',
			persona: 'Orbit Assistant'
		});
		expect(payload.messages.map((message) => message.id)).toEqual(['user-1', 'assistant-1']);
	});

	it('converts Open WebUI history back into Atrium messages in parent-child order', () => {
		const payload = agencyMessagesToOpenWebUIChat(agencyMessages, metadata);

		expect(openWebUIChatToAgencyMessages(payload)).toEqual([
			expect.objectContaining({
				id: 'user-1',
				role: 'user',
				content: 'Build a lead follow-up sequence'
			}),
			expect.objectContaining({
				id: 'assistant-1',
				role: 'ai',
				persona: 'Orbit Assistant',
				content: 'I can draft that sequence.'
			})
		]);
	});

	it('falls back to messages when history is absent', () => {
		const messages = openWebUIChatToAgencyMessages({
			messages: [
				{
					id: 'message-1',
					parentId: null,
					childrenIds: [],
					role: 'assistant',
					content: 'Hello',
					timestamp: 1788980460
				}
			]
		});

		expect(messages).toEqual([
			expect.objectContaining({ id: 'message-1', role: 'ai', content: 'Hello' })
		]);
	});

	it('generates a simple truncated title from the first user message', () => {
		expect(generateAtriumChatTitle(agencyMessages, 12)).toBe('Build a lea…');
		expect(generateAtriumChatTitle([{ id: 'ai-1', role: 'ai', content: 'Hi', time: '' }])).toBe(
			'Atrium Chat'
		);
	});

	it('creates payloads through the exported helper', () => {
		expect(createAtriumChatPayload(agencyMessages, metadata, { title: 'Custom' }).title).toBe(
			'Custom'
		);
	});

	it('filters Atrium chats by active org and sub-account scope', () => {
		expect(
			isAtriumChatForScope({ atrium: metadata }, { org_id: 'org-1', sub_account_id: 'sub-1' })
		).toBe(true);
		expect(
			isAtriumChatForScope({ atrium: metadata }, { org_id: 'org-2', sub_account_id: 'sub-1' })
		).toBe(false);
		expect(
			isAtriumChatForScope({ atrium: metadata }, { org_id: 'org-1', sub_account_id: 'sub-2' })
		).toBe(false);
		expect(
			isAtriumChatForScope(
				{ atrium: { ...metadata, source: 'atrium_voice' } },
				{ org_id: 'org-1', sub_account_id: 'sub-1' }
			)
		).toBe(true);
	});
});
