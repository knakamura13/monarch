<script lang="ts">
    import { onDestroy } from 'svelte';
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import QuestionCard from '$lib/components/questions/QuestionCard.svelte';
    import QuestionModal from '$lib/components/questions/QuestionModal.svelte';
    import InlineQuestionEditor from '$lib/components/questions/InlineQuestionEditor.svelte';
    import { Plus } from 'lucide-svelte';
    import { page } from '$app/state';
    import { goto, invalidateAll } from '$app/navigation';
    import { showSuccessToast } from '$lib/stores/toast';
    import { getPageNumber } from '$lib/constants/navigation';
    import { isDragThresholdMet } from '$lib/utils/drag';
    import type { QuestionSourceType } from '$lib/types/enums';
    import type { PageData } from './$types';

    interface QuestionsPageData extends PageData {
        members: { id: string; name: string | null; email: string }[];
    }

    let { data, form }: { data: QuestionsPageData; form: { error?: string; errorId?: string } } = $props();

    let showCreateModal = $state(false);
    let activeInlineSection = $state<string | null>(null);
    const editParam = $derived(page.url.searchParams.get('edit'));
    const editingQuestion = $derived(editParam && data.items.some((q) => q.id === editParam) ? { id: editParam } : null);

    // Drag and drop state
    type DragState = {
        id: string;
        item: import('$lib/server/dynamo/types').QuestionItem;
        pointerOffsetX: number;
        pointerOffsetY: number;
        containerRect: DOMRect;
        width: number;
        height: number;
        currentX: number;
        currentY: number;
        startX: number;
        startY: number;
        isDragging: boolean;
        rafId: number | null;
    };

    let dragState = $state<DragState | null>(null);
    let isDragging = $derived(!!dragState?.isDragging);
    let wasDragging = $state(false);
    let liveRegionMessage = $state<string>('');

    // Drop indicator state
    let dropTarget = $state<{
        targetStatus: string | null;
        targetQuestionId: string | null;
        position: 'before' | 'after' | null;
    }>({ targetStatus: null, targetQuestionId: null, position: null });

    async function updateUrl(id: string | null) {
        const url = new URL(page.url.href);
        if (id) {
            url.searchParams.set('edit', id);
        } else {
            url.searchParams.delete('edit');
        }
        await goto(url.toString(), { replaceState: true, noScroll: true });
    }

    const COLUMNS = [
        { id: 'OFFICIAL', label: 'Official sources', pillClass: 's-waiting', defaultSourceType: 'USCIS_SITE' as QuestionSourceType },
        { id: 'COMMUNITY', label: 'Community / anecdotal', pillClass: 's-active', defaultSourceType: 'COMMUNITY' as QuestionSourceType },
        { id: 'OTHER', label: 'Other', pillClass: 's-note', defaultSourceType: 'OTHER' as QuestionSourceType }
    ] as const;

    function getColumnIdForQuestion(q: { sourceType: string }) {
        if (['ATTORNEY', 'NONPROFIT', 'USCIS_SITE', 'COUNTY_SITE'].includes(q.sourceType)) return 'OFFICIAL';
        if (q.sourceType === 'COMMUNITY') return 'COMMUNITY';
        return 'OTHER';
    }

    const grouped = $derived(
        COLUMNS.map((col) => {
            const columnQuestions = data.items
                .filter((q) => getColumnIdForQuestion(q) === col.id)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            return {
                ...col,
                questions: columnQuestions
            };
        })
    );

    let scrollContainer = $state<HTMLElement | null>(null);

    function getOriginalPosition(questionId: string) {
        const question = data.items.find((q) => q.id === questionId);
        if (!question) return null;

        const columnId = getColumnIdForQuestion(question);
        const columnQuestions = data.items
            .filter((q) => getColumnIdForQuestion(q) === columnId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const index = columnQuestions.findIndex((q) => q.id === questionId);
        return {
            columnId,
            index: index,
            totalInColumn: columnQuestions.length
        };
    }

    function wouldChangePosition(questionId: string, targetStatus: string, targetQuestionId: string | null, position: 'before' | 'after' | null) {
        const original = getOriginalPosition(questionId);
        if (!original) return true;

        // If moving to different column, definitely changes position (though we restrict this)
        if (original.columnId !== targetStatus) return true;

        // Get target column questions (excluding the dragged one)
        const targetColumnQuestions = data.items
            .filter((q) => getColumnIdForQuestion(q) === targetStatus && q.id !== questionId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        if (!targetQuestionId) {
            // Dropping at end of column
            return original.index !== targetColumnQuestions.length;
        }

        // Find insertion index
        let insertionIndex = -1;
        for (let i = 0; i < targetColumnQuestions.length; i++) {
            const q = targetColumnQuestions.at(i);
            if (!q) continue;
            if (q.id === targetQuestionId) {
                insertionIndex = i;
                break;
            }
        }

        if (insertionIndex === -1) return true;

        // Adjust for before/after
        const finalIndex = position === 'after' ? insertionIndex + 1 : insertionIndex;

        return original.index !== finalIndex;
    }

    function handlePointerDown(event: PointerEvent, id: string) {
        if (event.button !== 0) return;
        const target = event.currentTarget as HTMLElement;
        const card = target.closest('.question-card') as HTMLElement;
        if (!card) return;

        const rect = card.getBoundingClientRect();
        const containerRect = scrollContainer!.getBoundingClientRect();

        wasDragging = false;

        const questionItem = data.items.find((q) => q.id === id);
        if (!questionItem) return;

        dragState = {
            id,
            item: questionItem,
            pointerOffsetX: event.clientX - rect.left,
            pointerOffsetY: event.clientY - rect.top,
            containerRect,
            width: rect.width,
            height: rect.height,
            currentX: event.clientX,
            currentY: event.clientY,
            startX: event.clientX,
            startY: event.clientY,
            isDragging: false,
            rafId: null
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
    }

    function handlePointerMove(event: PointerEvent) {
        if (!dragState) return;

        if (!dragState.isDragging) {
            if (isDragThresholdMet(dragState.startX, dragState.startY, event.clientX, event.clientY)) {
                dragState.isDragging = true;
                document.body.style.userSelect = 'none';
                document.body.style.touchAction = 'none';
            } else {
                return;
            }
        }

        dragState.currentX = event.clientX;
        dragState.currentY = event.clientY;

        if (dragState.rafId === null) {
            dragState.rafId = requestAnimationFrame(processPointerMove);
        }
    }

    function processPointerMove() {
        if (!dragState || !dragState.isDragging) {
            if (dragState) dragState.rafId = null;
            return;
        }
        dragState.rafId = null;

        const { currentX, currentY } = dragState;

        // Hit testing for drop indicator
        const columns = Array.from(scrollContainer!.querySelectorAll('.questions-column')) as HTMLElement[];
        let targetStatus: string | null = null;
        let targetQuestionId: string | null = null;
        let position: 'before' | 'after' | null = null;

        const sourceColumnId = getColumnIdForQuestion(dragState.item);

        for (const col of columns) {
            const rect = col.getBoundingClientRect();
            if (currentX > rect.left && currentX < rect.right) {
                const colId = COLUMNS[columns.indexOf(col)]?.id || null;

                // Restriction: only allow reordering within the same lane
                if (colId !== sourceColumnId) continue;

                targetStatus = colId;
                const cards = Array.from(col.querySelectorAll('.question-card:not([data-question-id="' + dragState.id + '"])')) as HTMLElement[];

                let insertionIndex = -1;
                for (let i = 0; i < cards.length; i++) {
                    const card = cards.at(i);
                    if (!card) continue;
                    const cardRect = card.getBoundingClientRect();
                    const cardCenter = cardRect.top + cardRect.height / 2;

                    if (currentY < cardCenter) {
                        insertionIndex = i;
                        targetQuestionId = card.getAttribute('data-question-id');
                        position = 'before';
                        break;
                    }
                }

                if (insertionIndex === -1 && cards.length > 0) {
                    const lastCard = cards[cards.length - 1];
                    if (lastCard) {
                        targetQuestionId = lastCard.getAttribute('data-question-id');
                        position = 'after';
                    }
                }

                break;
            }
        }

        if (targetStatus && wouldChangePosition(dragState.id, targetStatus, targetQuestionId, position)) {
            dropTarget = { targetStatus, targetQuestionId, position };
        } else {
            dropTarget = { targetStatus: null, targetQuestionId: null, position: null };
        }
    }

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        }
        if (dragState?.rafId !== null && dragState?.rafId !== undefined) {
            cancelAnimationFrame(dragState.rafId);
        }
    });

    function performLocalReorder(activeId: string, targetStatus: string, targetQuestionId: string | null, position: 'before' | 'after' | null) {
        const activeQuestion = data.items.find((q) => q.id === activeId);
        if (!activeQuestion) return;

        let newItems = data.items.filter((q) => q.id !== activeId);
        const columnQuestions = newItems.filter((q) => getColumnIdForQuestion(q) === targetStatus).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        if (targetQuestionId) {
            let targetIdx = columnQuestions.findIndex((q) => q.id === targetQuestionId);
            if (position === 'after') targetIdx++;
            columnQuestions.splice(targetIdx, 0, { ...activeQuestion });
        } else {
            columnQuestions.push({ ...activeQuestion });
        }

        // Update orders
        columnQuestions.forEach((q, i) => {
            q.order = i;
        });

        data.items = [...newItems.filter((q) => getColumnIdForQuestion(q) !== targetStatus), ...columnQuestions];
    }

    async function handlePointerUp() {
        if (!dragState) return;

        if (dragState.rafId !== null) {
            cancelAnimationFrame(dragState.rafId);
        }

        const { isDragging, id: draggedId, currentX, currentY } = dragState;
        if (isDragging) {
            wasDragging = true;
        }

        let targetStatus: string | null = null;
        let targetQuestionId: string | null = null;
        let position: 'before' | 'after' | null = null;

        const sourceColumnId = getColumnIdForQuestion(dragState.item);

        const columns = Array.from(scrollContainer!.querySelectorAll('.questions-column')) as HTMLElement[];
        for (const col of columns) {
            const rect = col.getBoundingClientRect();
            if (currentX > rect.left && currentX < rect.right) {
                const colId = COLUMNS[columns.indexOf(col)]?.id || null;
                if (colId !== sourceColumnId) continue;

                targetStatus = colId;
                const cards = Array.from(col.querySelectorAll('.question-card:not([data-question-id="' + draggedId + '"])')) as HTMLElement[];

                let insertionIndex = -1;
                for (let i = 0; i < cards.length; i++) {
                    const card = cards.at(i);
                    if (!card) continue;
                    const cardRect = card.getBoundingClientRect();
                    const cardCenter = cardRect.top + cardRect.height / 2;

                    if (currentY < cardCenter) {
                        insertionIndex = i;
                        targetQuestionId = card.getAttribute('data-question-id');
                        position = 'before';
                        break;
                    }
                }

                if (insertionIndex === -1 && cards.length > 0) {
                    const lastCard = cards[cards.length - 1];
                    if (lastCard) {
                        targetQuestionId = lastCard.getAttribute('data-question-id');
                        position = 'after';
                    }
                }
                break;
            }
        }

        dragState = null;
        dropTarget = { targetStatus: null, targetQuestionId: null, position: null };
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('touch-action');
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);

        if (!isDragging || !targetStatus) return;

        performLocalReorder(draggedId, targetStatus, targetQuestionId, position);

        const updates = data.items
            .filter((q) => getColumnIdForQuestion(q) === targetStatus)
            .map((q) => ({
                id: q.id,
                order: q.order
            }));

        try {
            const formData = new FormData();
            formData.append('updates', JSON.stringify(updates));
            const response = await fetch('?/reorder', { method: 'POST', body: formData });
            if (!response.ok) {
                console.error('Failed to persist reorder');
            } else {
                await invalidateAll();
            }
        } catch (error) {
            console.error('Failed to persist reorder:', error);
        }
    }

    async function handleQuestionKeydown(event: KeyboardEvent, questionId: string) {
        if (!event.altKey) return;

        const activeQuestion = data.items.find((q) => q.id === questionId);
        if (!activeQuestion) return;

        const columnId = getColumnIdForQuestion(activeQuestion);
        const column = grouped.find((c) => c.id === columnId);
        if (!column) return;

        const currentQuestionIdx = column.questions.findIndex((q) => q.id === questionId);
        const updates: Array<{ id: string; order: number }> = [];

        switch (event.key) {
            case 'ArrowDown': {
                event.preventDefault();
                if (currentQuestionIdx >= column.questions.length - 1) return;
                const columnQuestions = [...column.questions];
                const moved = columnQuestions.splice(currentQuestionIdx, 1)[0];
                if (moved) {
                    columnQuestions.splice(currentQuestionIdx + 1, 0, moved);
                    columnQuestions.forEach((q, idx) => {
                        updates.push({ id: q.id, order: idx });
                    });
                    liveRegionMessage = `Moved question down in ${column.label}`;
                }
                break;
            }
            case 'ArrowUp': {
                event.preventDefault();
                if (currentQuestionIdx <= 0) return;
                const columnQuestions = [...column.questions];
                const moved = columnQuestions.splice(currentQuestionIdx, 1)[0];
                if (moved) {
                    columnQuestions.splice(currentQuestionIdx - 1, 0, moved);
                    columnQuestions.forEach((q, idx) => {
                        updates.push({ id: q.id, order: idx });
                    });
                    liveRegionMessage = `Moved question up in ${column.label}`;
                }
                break;
            }
            default:
                return;
        }

        if (updates.length === 0) return;

        try {
            const formData = new FormData();
            formData.append('updates', JSON.stringify(updates));
            const response = await fetch('?/reorder', { method: 'POST', body: formData });
            if (response.ok) {
                await invalidateAll();
            }
        } catch (error) {
            console.error('Keyboard operation failed:', error);
        }
    }
</script>

<div aria-live="polite" aria-atomic="true" class="sr-only">{liveRegionMessage}</div>

<PageHeader title="Questions" sub="Track unresolved questions, their sources, and answers." number={getPageNumber('/questions')} />

<div class="questions-board" bind:this={scrollContainer} role="application">
    {#each grouped as column (column.id)}
        <div class="questions-column" data-status={column.id}>
            <div class="questions-column-header">
                <span class="pill {column.pillClass}">{column.label}</span>
                <span class="questions-column-count mono">{column.questions.length}</span>
            </div>
            <div class="questions-column-content" role="list" aria-label={`${column.label} column`}>
                {#each column.questions as question (question.id)}
                    <div
                        role="button"
                        tabindex="-1"
                        aria-label={`Question actions for ${question.question}`}
                        onkeydown={(e) => handleQuestionKeydown(e, question.id)}
                        style={dragState?.id === question.id && dragState.isDragging ? 'opacity: 0.2; pointer-events: none;' : ''}
                    >
                        {#if isDragging && dropTarget.targetStatus === column.id && dropTarget.targetQuestionId === question.id && dropTarget.position === 'before'}
                            <div class="question-card-drop-indicator"></div>
                        {/if}
                        <QuestionCard
                            {question}
                            onEdit={async () => {
                                await updateUrl(question.id);
                            }}
                            onPointerDown={handlePointerDown}
                            isDragging={dragState?.id === question.id && dragState.isDragging}
                            isAnyDragging={isDragging}
                            {wasDragging}
                        />
                        {#if isDragging && dropTarget.targetStatus === column.id && dropTarget.targetQuestionId === question.id && dropTarget.position === 'after'}
                            <div class="question-card-drop-indicator question-card-drop-indicator-bottom"></div>
                        {/if}
                    </div>
                {/each}
                {#if isDragging && dropTarget.targetStatus === column.id && !dropTarget.targetQuestionId}
                    <div class="question-card-drop-indicator"></div>
                {/if}

                {#if activeInlineSection === column.id}
                    <div style="margin-top: 8px;">
                        <InlineQuestionEditor
                            sourceType={column.defaultSourceType}
                            onCancel={() => (activeInlineSection = null)}
                            onSuccess={async () => {
                                await invalidateAll();
                            }}
                        />
                    </div>
                {:else}
                    <Button
                        variant="ghost"
                        class="questions-add-card-btn"
                        onclick={() => (activeInlineSection = column.id)}
                    >
                        {#snippet children()}<Plus class="questions-icon-sm questions-mr-2" /> Ask a question{/snippet}
                    </Button>
                {/if}
            </div>
        </div>
    {/each}
</div>

{#if editingQuestion}
    {@const question = data.items.find((q) => q.id === editingQuestion?.id)}
    {#if question}
        <QuestionModal
            mode="edit"
            open={true}
            onClose={async () => {
                await updateUrl(null);
            }}
            action="?/update"
            onenhance={() => {
                return async ({ result }: { result: import('@sveltejs/kit').ActionResult }) => {
                    if (result.type === 'success' || result.type === 'redirect') {
                        await invalidateAll();
                        showSuccessToast('Question updated successfully');
                        await updateUrl(null);
                    }
                };
            }}
            initial={{
                id: question.id,
                question: question.question,
                priority: question.priority,
                status: question.status,
                sourceType: question.sourceType,
                answer: question.answer,
                answeredAt: question.answeredAt
            }}
            error={form?.error}
            errorId={form?.errorId}
            onDeleteSuccess={async () => {
                await invalidateAll();
                await updateUrl(null);
            }}
        />
    {/if}
{/if}

{#if showCreateModal}
    <QuestionModal
        mode="create"
        open={true}
        onClose={() => {
            showCreateModal = false;
        }}
        action="?/create"
        error={form?.error}
        errorId={form?.errorId}
        onenhance={() => {
            return async ({ result }: { result: { type: string } }) => {
                if (result.type === 'success' || result.type === 'redirect') {
                    showCreateModal = false;
                    await invalidateAll();
                    showSuccessToast('Question created successfully');
                }
            };
        }}
    />
{/if}

{#if dragState && dragState.isDragging}
    <div
        class="question-drag-ghost"
        style="position: fixed; pointer-events: none; z-index: 99999; width: {dragState.width}px; height: {dragState.height}px; left: {dragState.currentX -
            dragState.pointerOffsetX}px; top: {dragState.currentY -
            dragState.pointerOffsetY}px; opacity: 0.95; transform: rotate(2deg); box-shadow: 0 12px 24px rgba(0,0,0,0.25); background: white; border: 1px solid #e0d8cc; border-radius: 18px; padding: 12px;"
    >
        <p style="font-size: 13px; line-height: 1.4; margin: 0; white-space: pre-wrap;">
            <span style="font-weight: 600; color: var(--ink-1);">Q: {dragState.item.question}</span>
            {#if dragState.item.answer}
                <br />
                <span style="font-weight: 400; color: var(--ink-2);">A: {dragState.item.answer}</span>
            {/if}
        </p>
    </div>
{/if}

<style>
    .questions-board {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        padding-bottom: max(32px, env(safe-area-inset-bottom, 0px));
    }

    @media (min-width: 768px) {
        .questions-board {
            grid-template-columns: repeat(3, 1fr);
            align-items: start;
        }
    }

    .questions-column {
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: var(--surface);
        padding: 16px;
        border-radius: 16px;
        border: 1px solid var(--hairline);
        height: fit-content;
    }

    .questions-column-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .questions-column-count {
        font-size: 11px;
        color: var(--ink-3);
    }

    .questions-column-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    :global(.questions-add-card-btn) {
        justify-content: flex-start !important;
        margin-top: 4px !important;
        padding: 8px 12px !important;
        height: auto !important;
        color: var(--ink-3) !important;
        font-size: 13px !important;
    }

    :global(.questions-icon-sm) {
        width: 14px;
        height: 14px;
    }

    :global(.questions-mr-2) {
        margin-right: 8px;
    }

    .question-card-drop-indicator {
        height: 3px;
        background: var(--peri-d);
        border-radius: 2px;
        margin: 0 4px 4px;
        pointer-events: none;
    }

    .question-card-drop-indicator-bottom {
        margin: 4px 4px 0;
    }
</style>
