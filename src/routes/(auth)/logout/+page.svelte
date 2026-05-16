<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { authClient } from '$lib/client/auth-client';

    onMount(async () => {
        try {
            await authClient.signOut();
        } finally {
            await goto('/login', { replaceState: true, invalidateAll: true });
        }
    });
</script>

<svelte:head>
    <title>Signing out</title>
</svelte:head>

<main style="display: grid; place-items: center; min-height: 100dvh; padding: 24px;">
    <p style="color: var(--ink-2); font-size: 14px;">Signing you out…</p>
</main>
