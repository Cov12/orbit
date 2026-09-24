export interface AtriumChatMessage {
	id: string;
	role: 'ai' | 'user';
	persona?: string;
	content: string;
	time: string;
	actions?: string[];
	dataCard?: { label: string; value: string; progress: number; months: string[] };
}

export interface AtriumChatMetadata {
	atrium: true;
	source: 'atrium' | 'atrium_voice';
	org_id: string;
	sub_account_id?: string | null;
	department_slug?: string | null;
	target_type: 'chief' | 'department' | 'employee';
	target_id?: string | null;
	employee_tab_id?: string | null;
	agent_id?: string | null;
	agent_name?: string | null;
	conductor_session_id?: string | null;
	[key: string]: unknown;
}

export interface OpenWebUIHistoryMessage {
	id: string;
	parentId: string | null;
	childrenIds: string[];
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	models?: string[];
	model?: string;
	persona?: string;
	source?: string;
	[key: string]: unknown;
}

export interface OpenWebUIChatPayload {
	title: string;
	models: string[];
	messages: OpenWebUIHistoryMessage[];
	history: {
		currentId: string | null;
		messages: Record<string, OpenWebUIHistoryMessage>;
	};
	atrium: AtriumChatMetadata;
	[key: string]: unknown;
}

const DEFAULT_MODEL = 'atrium';
const DEFAULT_TITLE = 'Atrium Chat';

function timestampFromAgencyTime(time: string): number {
	const parsed = Date.parse(time);
	if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
	return Math.floor(Date.now() / 1000);
}

function formatAgencyTime(timestamp?: number): string {
	if (!timestamp) return '';
	return new Date(timestamp * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function generateAtriumChatTitle(messages: AtriumChatMessage[], maxLength = 64): string {
	const firstUserMessage = messages.find((message) => message.role === 'user')?.content?.trim();
	if (!firstUserMessage) return DEFAULT_TITLE;
	return firstUserMessage.length > maxLength
		? `${firstUserMessage.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
		: firstUserMessage;
}

export function agencyMessagesToOpenWebUIChat(
	messages: AtriumChatMessage[],
	metadata: AtriumChatMetadata,
	options: { title?: string; models?: string[] } = {}
): OpenWebUIChatPayload {
	const historyMessages: Record<string, OpenWebUIHistoryMessage> = {};
	let previousId: string | null = null;
	const orderedMessages: OpenWebUIHistoryMessage[] = [];

	for (const message of messages) {
		const historyMessage: OpenWebUIHistoryMessage = {
			id: message.id,
			parentId: previousId,
			childrenIds: [],
			role: message.role === 'user' ? 'user' : 'assistant',
			content: message.content,
			timestamp: timestampFromAgencyTime(message.time),
			...(message.persona ? { persona: message.persona } : {})
		};

		if (previousId && historyMessages[previousId]) {
			historyMessages[previousId] = {
				...historyMessages[previousId],
				childrenIds: [...historyMessages[previousId].childrenIds, message.id]
			};
		}

		historyMessages[message.id] = historyMessage;
		orderedMessages.push(historyMessage);
		previousId = message.id;
	}

	return {
		title: options.title ?? generateAtriumChatTitle(messages),
		models: options.models ?? [DEFAULT_MODEL],
		messages: orderedMessages,
		history: {
			currentId: previousId,
			messages: historyMessages
		},
		atrium: metadata
	};
}

export function openWebUIChatToAgencyMessages(chat: {
	history?: { currentId?: string | null; messages?: Record<string, OpenWebUIHistoryMessage> };
	messages?: OpenWebUIHistoryMessage[];
}): AtriumChatMessage[] {
	if (chat.history?.messages && Object.keys(chat.history.messages).length > 0) {
		const historyMessages = chat.history.messages;
		const roots = Object.values(historyMessages).filter((message) => !message.parentId);
		const start = roots[0] ?? Object.values(historyMessages)[0];
		const ordered: OpenWebUIHistoryMessage[] = [];
		const visited = new Set<string>();
		let current: OpenWebUIHistoryMessage | undefined = start;

		while (current && !visited.has(current.id)) {
			ordered.push(current);
			visited.add(current.id);
			const nextId: string | undefined = current.childrenIds?.[0];
			current = nextId ? historyMessages[nextId] : undefined;
		}

		return ordered.map(openWebUIMessageToAgencyMessage);
	}

	return (chat.messages ?? []).map(openWebUIMessageToAgencyMessage);
}

export function createAtriumChatPayload(
	messages: AtriumChatMessage[],
	metadata: AtriumChatMetadata,
	options: { title?: string; models?: string[] } = {}
): OpenWebUIChatPayload {
	return agencyMessagesToOpenWebUIChat(messages, metadata, options);
}

export function isAtriumChatForScope(
	chat: { atrium?: Partial<AtriumChatMetadata> },
	scope: { org_id: string; sub_account_id?: string | null }
): boolean {
	const metadata = chat.atrium;
	if (!metadata?.atrium || !['atrium', 'atrium_voice'].includes(String(metadata.source)))
		return false;
	if (metadata.org_id !== scope.org_id) return false;
	if (scope.sub_account_id !== undefined && metadata.sub_account_id !== scope.sub_account_id)
		return false;
	return true;
}

function openWebUIMessageToAgencyMessage(message: OpenWebUIHistoryMessage): AtriumChatMessage {
	return {
		id: message.id,
		role: message.role === 'user' ? 'user' : 'ai',
		...(message.persona ? { persona: String(message.persona) } : {}),
		content: message.content,
		time: formatAgencyTime(message.timestamp)
	};
}
