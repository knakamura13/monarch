<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    onMount(async () => {
        await goto('/login', { replaceState: true, invalidateAll: true });
    });
</script>

<svelte:head>
    <title>Signed out</title>
</svelte:head>

<main style="display: grid; place-items: center; min-height: 100dvh; padding: 24px;">
    <p style="color: var(--ink-2); font-size: 14px;">Signed out. Redirecting…</p>
</main>
