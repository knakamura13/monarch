<script lang="ts">
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { browser } from '$app/environment';
    import { setInstallPrompt } from '$lib/stores/pwa';

    // We use a dynamic import for the virtual module to avoid issues with SSR
    // and to ensure it's only loaded in the browser.
    onMount(async () => {
        if (!browser) return;

        // Capture the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setInstallPrompt(e);
        });

        try {
            const { useRegisterSW } = await import('virtual:pwa-register/svelte');
            const { needRefresh, updateServiceWorker } = useRegisterSW({
                onRegistered(r) {
                    console.info('PWA: Service Worker registered');
                },
                onRegisterError(error) {
                    console.error('PWA: Service Worker registration error', error);
                }
            });

            // React to needRefresh store changes
            // Since this is Svelte 5, we can use the $ syntax for stores if we wrap it in a derived or use a sub-component.
            // But for simplicity in onMount, we can just subscribe.
            needRefresh.subscribe((value) => {
                if (value) {
                    toast.info('New version available', {
                        description: 'Click reload to update the application.',
                        duration: Number.POSITIVE_INFINITY,
                        action: {
                            label: 'Reload',
                            onClick: () => updateServiceWorker(true)
                        },
                        cancel: {
                            label: 'Close',
                            onClick: () => needRefresh.set(false)
                        }
                    });
                }
            });
        } catch (e) {
            console.error('PWA: Failed to load PWA register module', e);
        }
    });
</script>
