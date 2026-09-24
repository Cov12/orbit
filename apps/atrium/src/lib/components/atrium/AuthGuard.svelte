<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { user } from '$lib/stores';

  const PORTAL_URL = 'https://portal.orbit.example';

  let authenticated = false;
  let checking = true;

  onMount(() => {
    const token = ($user as { token?: string } | undefined)?.token ?? localStorage.getItem('token');

    if (token) {
      authenticated = true;
      checking = false;
    } else {
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `${PORTAL_URL}/auth/sign-in?redirect_url=${returnUrl}`;
    }
  });
</script>

{#if checking}
  <div class="flex items-center justify-center min-h-screen bg-[#0f0f13]">
    <div class="flex flex-col items-center gap-4">
      <div class="w-12 h-12 border-2 border-[#6961ff]/30 border-t-[#6961ff] rounded-full animate-spin"></div>
      <p class="text-white/50 text-sm">Verifying authentication...</p>
    </div>
  </div>
{:else if authenticated}
  <slot />
{/if}
