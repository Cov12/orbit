<script lang="ts">
  import { fly } from 'svelte/transition';
  import { isVoiceOverlayOpen, openVoiceOverlay, closeVoiceOverlay } from '$lib/stores/voice';
  import VoiceMode from './VoiceMode.svelte';
  import MaterialIcon from './shared/MaterialIcon.svelte';

  export let show: boolean = true;

  $: isOnVoicePage =
    typeof window !== 'undefined' && window.location.pathname.includes('/atrium/voice');
  $: showButton = show && !isOnVoicePage;
</script>

{#if showButton}
  <div class="fixed bottom-6 right-6 z-40" transition:fly={{ y: 24, duration: 250 }}>
    <div class="relative group">
      <span
        class="absolute inset-0 rounded-full bg-[#20B2AA]/35 animate-pulse pointer-events-none"
        aria-hidden="true"
      ></span>

      <button
        type="button"
        on:click={openVoiceOverlay}
        aria-label="Open Voice Mode"
        class="relative w-14 h-14 rounded-full bg-[#20B2AA] hover:bg-[#1a9e98] shadow-lg shadow-[#20B2AA]/30 text-white flex items-center justify-center transition-colors duration-200"
      >
        <MaterialIcon icon="mic" class="text-white" />
      </button>

      <div
        class="pointer-events-none absolute bottom-full right-0 mb-2 px-2 py-1 text-xs rounded bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
      >
        Voice Mode
      </div>
    </div>
  </div>
{/if}

{#if $isVoiceOverlayOpen}
  <VoiceMode onDismiss={closeVoiceOverlay} />
{/if}
