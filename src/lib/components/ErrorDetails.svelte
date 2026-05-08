<script lang="ts">
    export let status: number | undefined = undefined;
    export let message: string;
    export let errorId: string | undefined = undefined;
    export let requestId: string | undefined = undefined;
    export let stack: string | undefined = undefined;

    import { showSuccessToast } from '$lib/stores/toast';

    async function copyError() {
        let errorReport = '## Error Details\n';
        errorReport += '- **Status**: ' + (status || 'Unknown') + '\n';
        errorReport += '- **Message**: ' + message + '\n';
        errorReport += '- **Error ID**: ' + (errorId || 'Unknown') + '\n';
        errorReport += '- **Request ID**: ' + (requestId || 'Unknown') + '\n';

        if (stack) {
            errorReport += '\n## Error Stack Trace\n\n```\n' + stack + '\n```';
        }

        try {
            await navigator.clipboard.writeText(errorReport);
            showSuccessToast('Error report copied to clipboard');
        } catch {
            // ignore
        }
    }
</script>

<div class="error-details">
    <div class="error-details__top">
        <div class="error-details__main">
            <div class="error-details__title-row">
                {#if status != null}
                    <span class="error-details__badge">{status}</span>
                {/if}
                <p class="error-details__message">
                    {message}
                </p>
            </div>

            {#if requestId || errorId}
                <p class="error-details__meta">
                    {#if requestId}<span class="error-details__meta-item">Request: <code>{requestId}</code></span>{/if}
                    {#if errorId}<span>Error: <code>{errorId}</code></span>{/if}
                </p>
            {/if}
        </div>

        {#if errorId}
            <button type="button" class="error-details__copy" onclick={() => copyError()}> Copy error </button>
        {/if}
    </div>

    {#if stack}
        <details class="error-details__details">
            <summary class="error-details__summary">Show details</summary>
            <pre class="error-details__stack" style="tab-size: 2">{stack}</pre>
        </details>
    {/if}
</div>

<style>
    .error-details {
        border-radius: var(--r-md);
        border: 1px solid var(--hairline);
        background: var(--surface);
        padding: 16px;
        text-align: left;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .error-details__top {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
    }

    .error-details__main {
        min-width: 0;
        flex: 1;
    }

    .error-details__title-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }

    .error-details__badge {
        display: inline-flex;
        align-items: center;
        border-radius: var(--r-sm);
        background: var(--surface-3);
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 600;
        color: var(--ink);
    }

    .error-details__message {
        margin: 0;
        min-width: 0;
        overflow-wrap: break-word;
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
        flex: 1;
    }

    .error-details__meta {
        margin: 4px 0 0;
        font-size: 11px;
        color: var(--ink-3);
    }

    .error-details__meta-item {
        margin-right: 12px;
    }

    .error-details__meta code {
        font-family: var(--font-mono);
        font-size: 11px;
    }

    .error-details__copy {
        flex-shrink: 0;
        border-radius: var(--r-sm);
        border: 1px solid var(--hairline);
        background: var(--surface);
        padding: 4px 12px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        color: var(--ink);
    }

    .error-details__copy:hover {
        background: var(--surface-2);
    }

    .error-details__details {
        margin-top: 12px;
    }

    .error-details__summary {
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        color: var(--ink-3);
        list-style: none;
    }

    .error-details__summary:hover {
        color: var(--ink);
    }

    .error-details__stack {
        margin: 8px 0 0;
        max-height: 16rem;
        overflow: auto;
        border-radius: var(--r-sm);
        background: var(--surface-2);
        padding: 12px;
        font-size: 11px;
        line-height: 1.6;
        color: var(--ink);
        font-family: var(--font-mono);
    }
</style>
