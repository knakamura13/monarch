<script lang="ts">
    import { onMount, tick } from 'svelte';
    import { Check, X } from 'lucide-svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import { showSuccessToast } from '$lib/stores/toast';
    import type { QuestionSourceType } from '$lib/types/enums';

    let {
        sourceType,
        onCancel,
        onSuccess
    }: {
        sourceType: QuestionSourceType;
        onCancel: () => void;
        onSuccess: () => void | Promise<void>;
    } = $props();

    let questionText = $state('');
    let isSubmitting = $state(false);
    let inputElement = $state<HTMLInputElement | null>(null);

    onMount(() => {
        inputElement?.focus();
    });

    async function submit() {
        if (!questionText.trim() || isSubmitting) return;

        isSubmitting = true;
        let success = false;
        try {
            const formData = new FormData();
            formData.append('question', questionText.trim());
            formData.append('sourceType', sourceType);
            formData.append('priority', 'MEDIUM');
            formData.append('status', 'OPEN');

            const response = await fetch('?/create', {
                method: 'POST',
                body: formData,
                headers: {
                    'x-sveltekit-action': 'true'
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.type === 'success' || (result.data && !result.data.error)) {
                    showSuccessToast('Question added');
                    questionText = '';
                    success = true;
                } else {
                    console.error('Failed to create question:', result);
                }
            } else {
                console.error('Failed to create question:', response.statusText);
            }
        } catch (e) {
            console.error('Error creating question:', e);
        } finally {
            isSubmitting = false;
            if (success) {
                await onSuccess();
                await tick();
                inputElement?.focus();
            }
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    }
</script>

<div class="inline-editor">
    <input
        bind:value={questionText}
        bind:this={inputElement}
        placeholder="Type your question..."
        onkeydown={handleKeyDown}
        disabled={isSubmitting}
        class="input inline-input"
    />
    <div class="inline-actions">
        <Button
            variant="ghost"
            size="icon"
            onclick={submit}
            disabled={isSubmitting || !questionText.trim()}
            title="Add question"
            class="action-btn check-btn"
        >
            <Check style="width: 16px; height: 16px;" />
        </Button>
        <Button
            variant="ghost"
            size="icon"
            onclick={onCancel}
            disabled={isSubmitting}
            title="Cancel"
            class="action-btn x-btn"
        >
            <X style="width: 16px; height: 16px;" />
        </Button>
    </div>
</div>

<style>
    .inline-editor {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--surface-2);
        padding: 8px;
        border-radius: 12px;
        border: 1px solid var(--hairline);
    }

    :global(.inline-input) {
        flex: 1;
        background: transparent !important;
        border: none !important;
        padding: 4px 8px !important;
        font-size: 13px !important;
    }

    :global(.inline-input:focus) {
        box-shadow: none !important;
    }

    .inline-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    :global(.action-btn) {
        width: 28px !important;
        height: 28px !important;
        padding: 0 !important;
        border-radius: 6px !important;
    }

    :global(.check-btn:hover:not(:disabled)) {
        color: var(--sage-fill);
        background: var(--sage) !important;
    }

    :global(.x-btn:hover:not(:disabled)) {
        color: var(--blush-fill);
        background: var(--blush) !important;
    }
</style>
