<script lang="ts">
    import Card from '$lib/components/ui/Card.svelte';

    let {
        question,
        onEdit,
        onPointerDown,
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
        onpointerdown={(e) => onPointerDown && onPointerDown(e, question.id)}
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
        cursor: grab;
        touch-action: none;
    }

    .question-card-hoverable:hover {
        background: var(--surface-3);
        border-color: var(--hairline);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px color-mix(in srgb, var(--ink-1) 5%, transparent);
    }

    .question-card-dragging {
        cursor: grabbing;
        opacity: 0.5;
    }

    :global(.question-card-body) {
        padding: 12px !important;
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
