<script lang="ts">
    import Card from '$lib/components/ui/Card.svelte';
    import { GripVertical } from 'lucide-svelte';

    let {
        question,
        onEdit,
        onPointerDown,
        onDragHandlePointerDown,
        isDragging = false,
        isAnyDragging = false,
        wasDragging = false
    }: {
        question: {
            id: string;
            question: string;
            answer: string | null;
            sourceType: string;
            priority: string;
        };
        onEdit?: (id: string) => void;
        onPointerDown?: (e: PointerEvent, id: string) => void;
        onDragHandlePointerDown?: (e: PointerEvent, id: string) => void;
        isDragging?: boolean;
        isAnyDragging?: boolean;
        wasDragging?: boolean;
    } = $props();

    const cardClasses = $derived(
        `question-card-inner ${!isAnyDragging ? 'question-card-hoverable' : ''} ${isDragging ? 'question-card-dragging' : ''}`.trim()
    );
</script>

<div class="question-card" role="listitem" data-question-id={question.id} data-source-type={question.sourceType}>
    <div
        class={cardClasses}
        onclick={(e) => {
            if (isAnyDragging || wasDragging) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (onEdit) onEdit(question.id);
        }}
        onkeydown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isAnyDragging && onEdit) {
                e.preventDefault();
                onEdit(question.id);
            }
        }}
        role="button"
        tabindex="0"
        aria-label={question.question}
    >
        <button
            type="button"
            class="question-drag-handle"
            aria-label={`Reorder ${question.question}`}
            onpointerdown={(e) => onDragHandlePointerDown && onDragHandlePointerDown(e, question.id)}
        >
            <GripVertical style="width: 14px; height: 14px;" />
        </button>

        <Card class="question-card-body question-card-border-none question-card-shadow-none question-card-bg-transparent">
            <p class="question-card-text">
                <span class="question-card-q">Q: {question.question}</span>
                {#if question.answer}
                    <br />
                    <span class="question-card-a">A: {question.answer}</span>
                {/if}
            </p>
        </Card>
    </div>
</div>

<style>
    .question-card {
        width: 100%;
        position: relative;
    }

    .question-card-inner {
        width: 100%;
        border-radius: 12px;
        background: var(--surface-2);
        border: 1px solid transparent;
        transition: all 120ms ease;
        cursor: pointer;
        position: relative;
    }

    .question-card-hoverable:hover {
        background: var(--surface-3);
        border-color: var(--hairline);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px color-mix(in srgb, var(--ink-1) 5%, transparent);
    }

    .question-card-dragging {
        opacity: 0.5;
    }

    .question-drag-handle {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: var(--ink-3);
        touch-action: none;
        cursor: grab;
        transition: all 120ms ease;
    }

    .question-drag-handle:hover {
        color: var(--ink-1);
        background: var(--surface-3);
        border-color: var(--hairline);
    }

    .question-drag-handle:active {
        cursor: grabbing;
    }

    :global(.question-card-body) {
        padding: 12px 32px 12px 12px !important;
    }

    :global(.question-card-border-none) {
        border: none !important;
    }
    :global(.question-card-shadow-none) {
        box-shadow: none !important;
    }
    :global(.question-card-bg-transparent) {
        background: transparent !important;
    }

    .question-card-text {
        font-size: 13px;
        line-height: 1.4;
        margin: 0;
        white-space: pre-wrap;
    }

    .question-card-q {
        font-weight: 600;
        color: var(--ink-1);
    }

    .question-card-a {
        font-weight: 400;
        color: var(--ink-2);
    }
</style>
