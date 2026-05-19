<script lang="ts">
    import '../app.css';
    import { Toaster } from 'svelte-sonner';
    import { afterNavigate, beforeNavigate } from '$app/navigation';
    import { updated } from '$app/stores';
    import { get } from 'svelte/store';
    let { children } = $props();

    beforeNavigate(async ({ cancel }) => {
        // If a new version has been detected by polling, force a reload on navigation
        if (get(updated)) {
            cancel();
            window.location.reload();
        }
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

<Toaster richColors position="top-right" />
{@render children()}
