<script lang="ts">
    import { WifiOff, RefreshCw } from 'lucide-svelte';
    import Button from '$lib/components/ui/Button.svelte';

    function retry() {
        window.location.reload();
    }
</script>

<svelte:head>
    <title>Offline | Monarch</title>
</svelte:head>

<main class="offline-container">
    <div class="offline-card">
        <div class="icon-wrapper">
            <WifiOff size={48} strokeWidth={1.5} />
        </div>
        <h1 class="display">You're offline</h1>
        <p>It looks like you've lost your connection. Some features may be unavailable until you're back online.</p>
        
        <div class="actions">
            <Button variant="default" onclick={retry} class="retry-btn">
                <RefreshCw size={16} />
                Try again
            </Button>
            <Button variant="outline" onclick={() => window.history.back()}>
                Go back
            </Button>
        </div>
    </div>
</main>

<style>
    .offline-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100dvh;
        background: var(--bg);
        padding: 24px;
    }

    .offline-card {
        max-width: 400px;
        width: 100%;
        text-align: center;
        padding: 40px 24px;
        background: var(--surface);
        border: 1px solid var(--hairline);
        border-radius: var(--r-lg);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .icon-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        background: var(--surface-2);
        color: var(--ink-3);
        border-radius: 50%;
        margin-bottom: 24px;
    }

    h1 {
        font-size: 28px;
        margin-bottom: 12px;
        color: var(--ink);
    }

    p {
        font-size: 15px;
        line-height: 1.6;
        color: var(--ink-2);
        margin-bottom: 32px;
    }

    .actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    :global(.retry-btn) {
        width: 100%;
    }

    @media (min-width: 480px) {
        .actions {
            flex-direction: row;
            justify-content: center;
        }
        
        :global(.retry-btn) {
            width: auto;
        }
    }
</style>
