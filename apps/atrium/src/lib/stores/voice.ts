import { derived, get, writable } from 'svelte/store';

export type VoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export interface VoiceConfig {
  pushToTalk: boolean;
  selectedVoice: string;
  autoPlayResponse: boolean;
  showTranscription: boolean;
  silenceTimeout: number;
}

export interface VoiceTurn {
  role: 'user' | 'ai';
  text: string;
  timestamp: number;
  department?: string;
}

const VOICE_CONFIG_STORAGE_KEY = 'atrium-voice-config';

const defaultVoiceConfig: VoiceConfig = {
  pushToTalk: false,
  selectedVoice: '',
  autoPlayResponse: true,
  showTranscription: true,
  silenceTimeout: 3000
};

export const voiceState = writable<VoiceState>('idle');
export const voiceConfig = writable<VoiceConfig>({ ...defaultVoiceConfig });
export const voiceHistory = writable<VoiceTurn[]>([]);
export const voiceError = writable<string>('');
export const voiceSessionId = writable<string | null>(null);
export const isVoiceOverlayOpen = writable(false);

export const isVoiceActive = derived(voiceState, ($s) => $s !== 'idle' && $s !== 'error');
export const recentTurns = derived(voiceHistory, ($h) => $h.slice(-6));

export function openVoiceOverlay(): void {
  isVoiceOverlayOpen.set(true);
}

export function closeVoiceOverlay(): void {
  isVoiceOverlayOpen.set(false);
  voiceState.set('idle');
}

export function addVoiceTurn(role: 'user' | 'ai', text: string, department?: string): void {
  const turn: VoiceTurn = {
    role,
    text,
    timestamp: Date.now(),
    ...(department ? { department } : {})
  };

  voiceHistory.update((history) => [...history, turn].slice(-50));
}

export function clearVoiceHistory(): void {
  voiceHistory.set([]);
}

export function resetVoiceState(): void {
  voiceState.set('idle');
  voiceConfig.set({ ...defaultVoiceConfig });
  voiceHistory.set([]);
  voiceError.set('');
  voiceSessionId.set(null);
  isVoiceOverlayOpen.set(false);
}

export function loadVoiceConfig(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    const raw = localStorage.getItem(VOICE_CONFIG_STORAGE_KEY);

    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Partial<VoiceConfig>;

    const merged: VoiceConfig = {
      ...defaultVoiceConfig,
      ...parsed,
      silenceTimeout:
        typeof parsed.silenceTimeout === 'number' && parsed.silenceTimeout > 0
          ? parsed.silenceTimeout
          : defaultVoiceConfig.silenceTimeout
    };

    voiceConfig.set(merged);
  } catch (error) {
    console.error('Failed to load voice config from localStorage:', error);
  }
}

export function saveVoiceConfig(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(VOICE_CONFIG_STORAGE_KEY, JSON.stringify(get(voiceConfig)));
  } catch (error) {
    console.error('Failed to save voice config to localStorage:', error);
  }
}
