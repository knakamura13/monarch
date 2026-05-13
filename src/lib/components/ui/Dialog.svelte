<script lang="ts">
    import Button from '$lib/components/ui/Button.svelte';
    import type { ButtonVariant } from '$lib/components/ui/Button.svelte';
    import X from "lucide-svelte/icons/x";;

    let {
        open,
        onClose,
        contentWidth = 'xl',
        children,
        showHeader = true,
        showFooter = true,
        showCloseButton = true,
        title,
        titleLevel = 'h2',
        ariaLabel,
        header,
        headerActions,
        footer,
        cancelLabel,
        cancelVariant = 'outline',
        onCancel,
        submitLabel,
        footerFormId,
        submitVariant = 'default',
        submitClass = '',
        bodyClass = 'modal-content'
    }: {
        open: boolean;
        onClose: () => void | Promise<void>;
        contentWidth?: 'sm' | 'md' | 'lg' | 'xl';
        children: import('svelte').Snippet;
        showHeader?: boolean;
        showFooter?: boolean;
        showCloseButton?: boolean;
        title?: string;
        titleLevel?: 'h2' | 'h3';
        ariaLabel?: string;
        header?: import('svelte').Snippet;
        headerActions?: import('svelte').Snippet;
        footer?: import('svelte').Snippet;
        cancelLabel?: string;
        cancelVariant?: ButtonVariant;
        onCancel?: () => void | Promise<void>;
        submitLabel?: string;
        footerFormId?: string;
        submitVariant?: ButtonVariant;
        submitClass?: string;
        bodyClass?: string;
    } = $props();

    const titleId = `dialog-title-${Math.random().toString(36).slice(2, 11)}`;

    let panelEl: HTMLElement | undefined = $state();

    const cancelHandler = $derived(onCancel ?? onClose);

    const labeledBy = $derived(title ? titleId : undefined);

    function handleEscape(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            void onClose();
        }
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) void onClose();
    }

    $effect(() => {
        if (open) {
            const focusDialog = () => {
                const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
                if (dialog && document.activeElement !== dialog) {
                    dialog.focus();
                }
            };

            // Use requestAnimationFrame to ensure the DOM is ready
            requestAnimationFrame(focusDialog);
        }
    });
</script>

{#if open}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" onclick={handleBackdropClick} onkeydown={handleEscape}>
        <div
            bind:this={panelEl}
            class="dialog-content dialog-content--{contentWidth}"
            role="dialog"
            aria-modal="true"
            aria-labelledby={labeledBy}
            aria-label={labeledBy ? undefined : ariaLabel}
            tabindex="-1"
            style="padding-bottom: env(safe-area-inset-bottom)"
            onclick={(e) => e.stopPropagation()}
            onkeydown={handleEscape}
        >
            {#if showHeader}
                <header class="modal-header">
                    <div class="modal-header-left">
                        {#if header}
                            {@render header()}
                        {:else if title}
                            {#if titleLevel === 'h3'}
                                <h3 id={titleId} class="modal-title">{title}</h3>
                            {:else}
                                <h2 id={titleId} class="modal-title">{title}</h2>
                            {/if}
                        {/if}
                    </div>
                    <div class="modal-header-right">
                        {#if headerActions}
                            {@render headerActions()}
                        {/if}
                        {#if showCloseButton}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onclick={() => void onClose()}
                                class="modal-shrink-0"
                                aria-label="Close dialog"
                            >
                                {#snippet children()}<X class="modal-icon-sm" />{/snippet}
                            </Button>
                        {/if}
                    </div>
                </header>
            {/if}

            {#if bodyClass}
                <div class="dialog-body-region {bodyClass}">
                    {@render children()}
                </div>
            {:else}
                {@render children()}
            {/if}

            {#if showFooter}
                {#if footer}
                    <footer class="modal-footer">
                        {@render footer()}
                    </footer>
                {:else if cancelLabel || submitLabel}
                    <footer class="modal-footer">
                        {#if cancelLabel}
                            <Button type="button" variant={cancelVariant} onclick={() => void cancelHandler()}>
                                {cancelLabel}
                            </Button>
                        {/if}
                        {#if submitLabel}
                            <Button
                                type={footerFormId ? 'submit' : 'button'}
                                form={footerFormId}
                                variant={submitVariant}
                                class={submitClass}
                            >
                                {submitLabel}
                            </Button>
                        {/if}
                    </footer>
                {/if}
            {/if}
        </div>
    </div>
{/if}
