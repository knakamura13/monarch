<script lang="ts">
    import '../app.css';
    import { afterNavigate } from '$app/navigation';
    import PwaManager from '$lib/components/pwa/PwaManager.svelte';
    import { onMount } from 'svelte';
    
    let ToasterComponent: any = $state(null);
    let { children } = $props();

    onMount(async () => {
        const { Toaster } = await import('svelte-sonner');
        ToasterComponent = Toaster;
    });

    afterNavigate(() => {
        if (typeof window !== 'undefined') {
            window.scrollTo(0, 0);
            const main = document.getElementById('main');
            if (main) {
                main.scrollTo(0, 0);
            }
        }
    });
</script>

<PwaManager />
{#if ToasterComponent}
    <ToasterComponent richColors position="top-center" />
{/if}
{@render children()}
