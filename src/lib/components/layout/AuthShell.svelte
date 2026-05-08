<script lang="ts">
    let {
        title,
        subtitle,
        children
    }: {
        title: string;
        subtitle?: string;
        children: import('svelte').Snippet;
    } = $props();
</script>

<main
    class="auth-shell"
    id="main"
    style="min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: var(--bg); padding: 32px; padding-bottom: max(32px, env(safe-area-inset-bottom, 0px));"
>
    <div style="width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 32px;">
            <img src="/monarch-logo.png" alt="" width="32" height="32" style="width: 32px; height: 32px;" aria-hidden="true" decoding="async" />
            <span class="display" style="font-size: 24px;">monarch</span>
        </div>
        <div class="card" style="width: 100%; padding: 32px; border-radius: var(--r-lg);">
            <h1 class="display" style="font-size: 32px; font-weight: 500; margin-bottom: 8px;">{title}</h1>
            {#if subtitle}<p style="font-size: 13px; color: var(--ink-2); margin-bottom: 24px;">{subtitle}</p>{/if}
            <div>{@render children()}</div>
        </div>
        <p style="margin-top: 24px; font-size: 12px; color: var(--ink-3); text-align: center;">
            This case is private. Only invited members can sign in.
        </p>
    </div>
</main>

<style>
    .auth-shell {
        box-sizing: border-box;
    }
</style>
