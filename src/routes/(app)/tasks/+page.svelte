<script lang="ts">
    import { onDestroy } from 'svelte';
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import TaskCard from '$lib/components/tasks/TaskCard.svelte';
    import TaskModal from '$lib/components/tasks/TaskModal.svelte';
    import { Plus } from 'lucide-svelte';
    import { page } from '$app/state';
    import { goto, invalidateAll } from '$app/navigation';
    import { showSuccessToast } from '$lib/stores/toast';
    import { getPageNumber } from '$lib/constants/navigation';
    import { isDragThresholdMet, CLICK_PROTECTION_TIMEOUT_MS } from '$lib/utils/drag';
    import type { PageData } from './$types';

    interface TasksPageData extends PageData {
        members: { id: string; name: string | null; email: string }[];
    }

    let { data, form }: { data: TasksPageData; form: { error?: string; errorId?: string } } = $props();

    let showCreateModal = $state(false);
    let defaultStatus = $state<string | undefined>(undefined);
    const editParam = $derived(page.url.searchParams.get('edit'));
    const editingTask = $derived(editParam && data.tasks.some((t) => t.id === editParam) ? { id: editParam } : null);

    // Check if we're coming from dashboard with pre-fetched data
    let _isFromDashboard = $state(false);
    let _showInstantDialog = $state(false);

    $effect(() => {
        const timestamp = sessionStorage.getItem('prefetched-tasks-timestamp');

        if (timestamp && editParam) {
            // Show dialog instantly while data loads in background
            _isFromDashboard = true;
            _showInstantDialog = true;
            // Clear the flag after using it
            sessionStorage.removeItem('prefetched-tasks-timestamp');
        }
    });

    // Drag and drop state
    type DragState = {
        id: string;
        item: import('$lib/server/dynamo/types').TaskItem;
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

    // Drop indicator state - single source of truth for drop preview
    let dropTarget = $state<{
        targetStatus: string | null;
        targetTaskId: string | null;
        position: 'before' | 'after' | null;
    }>({ targetStatus: null, targetTaskId: null, position: null });

    
    async function updateUrl(id: string | null) {
        const url = new URL(page.url.href);
        if (id) {
            url.searchParams.set('edit', id);
        } else {
            url.searchParams.delete('edit');
        }
        await goto(url.toString(), { replaceState: true, noScroll: true });
    }

    function removeTaskFromPage(id: string) {
        data.tasks = data.tasks.filter((t) => t.id !== id);
    }

    const COLUMNS = [
        { id: 'To do', label: 'To do', pillClass: 's-note' },
        { id: 'Doing', label: 'Doing', pillClass: 's-active' },
        { id: 'On hold', label: 'On hold', pillClass: 's-waiting' },
        { id: 'Done', label: 'Done', pillClass: 's-done' }
    ] as const;

    const grouped = $derived(
        COLUMNS.map((col) => ({
            ...col,
            tasks: data.tasks
                .filter((t) => t.status === col.id)
                .sort((a, b) => a.order - b.order)
                .map((t) => ({
                    ...t
                }))
        }))
    );

    let scrollContainer = $state<HTMLElement | null>(null);

    function getOriginalTaskPosition(taskId: string) {
        const task = data.tasks.find((t) => t.id === taskId);
        if (!task) return null;
        
        const columnTasks = data.tasks
            .filter((t) => t.status === task.status)
            .sort((a, b) => a.order - b.order);
            
        const index = columnTasks.findIndex((t) => t.id === taskId);
        return {
            status: task.status,
            index: index,
            totalInColumn: columnTasks.length
        };
    }

    function wouldChangePosition(taskId: string, targetStatus: string, targetTaskId: string | null, position: 'before' | 'after' | null) {
        const original = getOriginalTaskPosition(taskId);
        if (!original) return true;
        
        // If moving to different column, definitely changes position
        if (original.status !== targetStatus) return true;
        
        // Get target column tasks (excluding the dragged one)
        const targetColumnTasks = data.tasks
            .filter((t) => t.status === targetStatus && t.id !== taskId)
            .sort((a, b) => a.order - b.order);
            
        if (!targetTaskId) {
            // Dropping at end of column
            return original.index !== targetColumnTasks.length;
        }
        
        // Find insertion index
        let insertionIndex = -1;
        for (let i = 0; i < targetColumnTasks.length; i++) {
            const card = targetColumnTasks.at(i);
            if (!card) continue;
            if (card.id === targetTaskId) {
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
        const card = target.closest('.task-card') as HTMLElement;
        if (!card) return;

        const rect = card.getBoundingClientRect();
        const containerRect = scrollContainer!.getBoundingClientRect();

        wasDragging = false;

        const taskItem = data.tasks.find((t) => t.id === id);
        if (!taskItem) return;

        dragState = {
            id,
            item: taskItem,
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

        // Hit testing for drop indicator (preview only - no state mutation)
        const columns = Array.from(scrollContainer!.querySelectorAll('.tasks-column')) as HTMLElement[];
        let targetStatus: string | null = null;
        let targetTaskId: string | null = null;
        let position: 'before' | 'after' | null = null;

        for (const col of columns) {
            const rect = col.getBoundingClientRect();
            if (currentX > rect.left && currentX < rect.right) {
                targetStatus = COLUMNS[columns.indexOf(col)]?.id || null;
                const cards = Array.from(col.querySelectorAll('.task-card:not([data-task-id="' + dragState.id + '"])')) as HTMLElement[];
                
                // Find the correct insertion position based on Y coordinate
                let insertionIndex = -1;
                for (let i = 0; i < cards.length; i++) {
                    const card = cards.at(i);
                    if (!card) continue;
                    const cardRect = card.getBoundingClientRect();
                    const cardCenter = cardRect.top + cardRect.height / 2;
                    
                    if (currentY < cardCenter) {
                        // Ghost is above this card
                        insertionIndex = i;
                        targetTaskId = card.getAttribute('data-task-id');
                        position = 'before';
                        break;
                    }
                }
                
                // If ghost is below all cards or no cards found, position at end
                if (insertionIndex === -1 && cards.length > 0) {
                    // Ghost is below the last card
                    const lastCard = cards[cards.length - 1];
                    if (lastCard) {
                        targetTaskId = lastCard.getAttribute('data-task-id');
                        position = 'after';
                    }
                }
                
                break;
            }
        }

        // Update drop indicator state (preview only) - hide if position wouldn't change
        if (targetStatus && wouldChangePosition(dragState.id, targetStatus, targetTaskId, position)) {
            dropTarget = { targetStatus, targetTaskId, position };
        } else {
            dropTarget = { targetStatus: null, targetTaskId: null, position: null };
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

    function performLocalReorder(activeId: string, targetStatus: string, targetTaskId: string | null, position: 'before' | 'after' | null) {
        const activeTask = data.tasks.find((t) => t.id === activeId);
        if (!activeTask) return;

        let newTasks = data.tasks.filter((t) => t.id !== activeId);
        const columnTasks = newTasks.filter((t) => t.status === targetStatus).sort((a, b) => a.order - b.order);

        if (targetTaskId) {
            let targetIdx = columnTasks.findIndex((t) => t.id === targetTaskId);
            if (position === 'after') targetIdx++;
            columnTasks.splice(targetIdx, 0, { ...activeTask, status: targetStatus as import('$lib/types/enums').TaskStatus });
        } else {
            columnTasks.push({ ...activeTask, status: targetStatus as import('$lib/types/enums').TaskStatus });
        }

        // Update orders
        columnTasks.forEach((t, i) => {
            t.order = i;
        });

        // Update other columns orders just in case
        COLUMNS.forEach((col) => {
            if (col.id !== targetStatus) {
                newTasks
                    .filter((t) => t.status === col.id)
                    .sort((a, b) => a.order - b.order)
                    .forEach((t, i) => {
                        t.order = i;
                    });
            }
        });

        data.tasks = [...newTasks.filter((t) => t.status !== targetStatus), ...columnTasks];
    }

    async function handlePointerUp() {
        if (!dragState) return;

        if (dragState.rafId !== null) {
            cancelAnimationFrame(dragState.rafId);
        }

        const { isDragging, id: draggedId, currentX, currentY } = dragState;
        if (isDragging) {
            wasDragging = true;
            setTimeout(() => {
                wasDragging = false;
            }, CLICK_PROTECTION_TIMEOUT_MS);
        }

        
        // Run hit testing directly on drop to get final position
        let targetStatus: string | null = null;
        let targetTaskId: string | null = null;
        let position: 'before' | 'after' | null = null;

        const columns = Array.from(scrollContainer!.querySelectorAll('.tasks-column')) as HTMLElement[];
        for (const col of columns) {
            const rect = col.getBoundingClientRect();
            if (currentX > rect.left && currentX < rect.right) {
                targetStatus = COLUMNS[columns.indexOf(col)]?.id || null;
                const cards = Array.from(col.querySelectorAll('.task-card:not([data-task-id="' + draggedId + '"])')) as HTMLElement[];
                
                // Find the correct insertion position based on Y coordinate
                let insertionIndex = -1;
                for (let i = 0; i < cards.length; i++) {
                    const card = cards.at(i);
                    if (!card) continue;
                    const cardRect = card.getBoundingClientRect();
                    const cardCenter = cardRect.top + cardRect.height / 2;
                    
                    if (currentY < cardCenter) {
                        // Ghost is above this card
                        insertionIndex = i;
                        targetTaskId = card.getAttribute('data-task-id');
                        position = 'before';
                        break;
                    }
                }
                
                // If ghost is below all cards or no cards found, position at end
                if (insertionIndex === -1 && cards.length > 0) {
                    // Ghost is below the last card
                    const lastCard = cards[cards.length - 1];
                    if (lastCard) {
                        targetTaskId = lastCard.getAttribute('data-task-id');
                        position = 'after';
                    }
                }
                break;
            }
        }

        dragState = null;
        dropTarget = { targetStatus: null, targetTaskId: null, position: null };
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('touch-action');
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);

        if (!isDragging || !targetStatus) return;

        // Perform the actual reorder on drop (not during drag)
        performLocalReorder(draggedId, targetStatus, targetTaskId, position);

        // Persist change (don't invalidate since we've already updated local state)
        const validStatuses = ['To do', 'Doing', 'On hold', 'Done'];
        const updates = data.tasks
            .filter((t) => validStatuses.includes(t.status))
            .map((t) => ({
                id: t.id,
                status: t.status,
                order: t.order
            }));

        try {
            const formData = new FormData();
            formData.append('updates', JSON.stringify(updates));
            const response = await fetch('?/reorder', { method: 'POST', body: formData });
            if (!response.ok) {
                console.error('Failed to persist reorder:', response.statusText);
                const errorText = await response.text();
                console.error('Error response:', errorText);
            } else {
                // Invalidate to ensure UI shows persisted state from server
                await invalidateAll();
            }
        } catch (error) {
            console.error('Failed to persist reorder:', error);
        }
    }

    async function handleTaskKeydown(event: KeyboardEvent, taskId: string) {
        if (!event.altKey) return;

        const activeTask = data.tasks.find((t) => t.id === taskId);
        if (!activeTask) return;

        // Safe to access activeTask.status since we confirmed it exists above
        const currentColumnIdx = COLUMNS.findIndex((c) => c.id === activeTask.status);
        if (currentColumnIdx === -1) return;

        // Get current column safely
        const currentColumnValue = grouped.at(currentColumnIdx);
        if (!currentColumnValue) return;

        const allTasks = [...data.tasks];
        const currentTaskIdx = currentColumnValue.tasks.findIndex((t) => t.id === taskId);
        const updates: Array<{ id: string; status: string; order: number }> = [];

        switch (event.key) {
            case 'ArrowRight': {
                event.preventDefault();
                if (currentColumnIdx >= COLUMNS.length - 1) return;
                const nextColumn = COLUMNS[currentColumnIdx + 1];
                if (!nextColumn) return;
                const targetStatus = nextColumn.id;
                const sourceColumnTasks = allTasks.filter((t) => t.status === activeTask.status).sort((a, b) => a.order - b.order);
                sourceColumnTasks.forEach((t, idx) => {
                    if (t.id !== taskId) {
                        updates.push({ id: t.id, status: t.status, order: idx });
                    }
                });
                const targetColumnTasks = allTasks.filter((t) => t.status === targetStatus).sort((a, b) => a.order - b.order);
                targetColumnTasks.push({ ...activeTask, status: targetStatus as import('$lib/types/enums').TaskStatus });
                targetColumnTasks.forEach((t, idx) => {
                    updates.push({ id: t.id, status: t.status, order: idx });
                });
                liveRegionMessage = `Moved "${activeTask.title}" to ${nextColumn.label}`;
                break;
            }
            case 'ArrowLeft': {
                event.preventDefault();
                if (currentColumnIdx <= 0) return;
                const prevColumn = COLUMNS[currentColumnIdx - 1];
                if (!prevColumn) return;
                const targetStatus = prevColumn.id;
                const sourceColumnTasks = allTasks.filter((t) => t.status === activeTask.status).sort((a, b) => a.order - b.order);
                sourceColumnTasks.forEach((t, idx) => {
                    if (t.id !== taskId) {
                        updates.push({ id: t.id, status: t.status, order: idx });
                    }
                });
                const targetColumnTasks = allTasks.filter((t) => t.status === targetStatus).sort((a, b) => a.order - b.order);
                targetColumnTasks.push({ ...activeTask, status: targetStatus as import('$lib/types/enums').TaskStatus });
                targetColumnTasks.forEach((t, idx) => {
                    updates.push({ id: t.id, status: t.status, order: idx });
                });
                liveRegionMessage = `Moved "${activeTask.title}" to ${prevColumn.label}`;
                break;
            }
            case 'ArrowDown': {
                event.preventDefault();
                if (currentTaskIdx >= currentColumnValue.tasks.length - 1) return;
                const columnTasks = allTasks.filter((t) => t.status === activeTask.status).sort((a, b) => a.order - b.order);
                const newOrder = columnTasks.filter((t) => t.id !== taskId);
                newOrder.splice(currentTaskIdx + 1, 0, activeTask);
                newOrder.forEach((t, idx) => {
                    updates.push({ id: t.id, status: t.status, order: idx });
                });
                liveRegionMessage = `Moved "${activeTask.title}" down in ${currentColumnValue.label}`;
                break;
            }
            case 'ArrowUp': {
                event.preventDefault();
                if (currentTaskIdx <= 0) return;
                const columnTasks = allTasks.filter((t) => t.status === activeTask.status).sort((a, b) => a.order - b.order);
                const newOrder = columnTasks.filter((t) => t.id !== taskId);
                newOrder.splice(currentTaskIdx - 1, 0, activeTask);
                newOrder.forEach((t, idx) => {
                    updates.push({ id: t.id, status: t.status, order: idx });
                });
                liveRegionMessage = `Moved "${activeTask.title}" up in ${currentColumnValue.label}`;
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
            } else {
                console.error('Reorder failed:', response.statusText);
            }
        } catch (error) {
            console.error('Keyboard operation failed:', error);
        }
    }
</script>

<div aria-live="polite" aria-atomic="true" class="sr-only">{liveRegionMessage}</div>

<PageHeader title="Tasks" sub="Personal todos and errands (not legal proceedings)." number={getPageNumber('/tasks')} />

<div class="tasks-board" bind:this={scrollContainer} role="application">
    {#each grouped as column (column.id)}
        <div class="tasks-column" data-status={column.id}>
            <div class="tasks-column-header">
                <span class="pill {column.pillClass}">{column.label}</span>
                <span class="tasks-column-count mono">{column.tasks.length}</span>
            </div>
            <div class="tasks-column-content" role="list" aria-label={`${column.label} column`}>
                {#each column.tasks as task (task.id)}
                    <div
                        role="button"
                        tabindex="-1"
                        aria-label={`Task actions for ${task.title}`}
                        onkeydown={(e) => handleTaskKeydown(e, task.id)}
                        style={dragState?.id === task.id && dragState.isDragging ? 'opacity: 0.2; pointer-events: none;' : ''}
                    >
                        <!-- Drop indicator before this card -->
                        {#if isDragging && dropTarget.targetStatus === column.id && dropTarget.targetTaskId === task.id && dropTarget.position === 'before'}
                            <div class="task-card-drop-indicator"></div>
                        {/if}
                        <TaskCard
                            {task}
                            onEdit={async () => {
                                await updateUrl(task.id);
                            }}
                            onDragHandlePointerDown={handlePointerDown}
                            isDragging={dragState?.id === task.id && dragState.isDragging}
                            isAnyDragging={isDragging}
                            {wasDragging}
                        />
                        <!-- Drop indicator after this card -->
                        {#if isDragging && dropTarget.targetStatus === column.id && dropTarget.targetTaskId === task.id && dropTarget.position === 'after'}
                            <div class="task-card-drop-indicator task-card-drop-indicator-bottom"></div>
                        {/if}
                    </div>
                {/each}
                <!-- Drop indicator at end of column (no target task) - not shown for empty columns -->
                {#if isDragging && dropTarget.targetStatus === column.id && !dropTarget.targetTaskId && column.tasks.length > 0}
                    <div class="task-card-drop-indicator"></div>
                {/if}
                {#if column.tasks.length === 0}
                    <div 
                        class="tasks-empty-placeholder {isDragging && dropTarget.targetStatus === column.id && !dropTarget.targetTaskId ? 'tasks-empty-box-drop-target' : ''}" 
                        role="listitem"
                    >
                        {#if !(isDragging && dropTarget.targetStatus === column.id && !dropTarget.targetTaskId)}
                            No tasks
                        {/if}
                    </div>
                {/if}
            </div>
            <Button
                variant="ghost"
                class="tasks-add-card-btn"
                onclick={() => {
                    defaultStatus = column.id;
                    showCreateModal = true;
                }}
            >
                {#snippet children()}<Plus class="tasks-icon-sm tasks-mr-2" /> Add a card{/snippet}
            </Button>
        </div>
    {/each}
</div>

{#if editingTask}
    {@const task = data.tasks.find((t) => t.id === editingTask?.id)}
    {#if task}
        <TaskModal
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
                        showSuccessToast('Task updated successfully');
                        await updateUrl(null);
                    }
                };
            }}
            initial={{
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                checklist: task.checklist
            }}
            error={form?.error}
            errorId={form?.errorId}
            onDeleteSuccess={removeTaskFromPage}
        />
    {/if}
{/if}

{#if showCreateModal}
    <TaskModal
        mode="create"
        open={true}
        onClose={() => {
            showCreateModal = false;
            defaultStatus = undefined;
        }}
        action="?/create"
        {defaultStatus}
        error={form?.error}
        errorId={form?.errorId}
        onenhance={() => {
            return async ({ result }: { result: { type: string } }) => {
                if (result.type === 'success' || result.type === 'redirect') {
                    showCreateModal = false;
                    defaultStatus = undefined;
                    await invalidateAll();
                    showSuccessToast('Task created successfully');
                }
            };
        }}
    />
{/if}

{#if dragState && dragState.isDragging}
    <div
        class="task-drag-ghost"
        style="position: fixed; pointer-events: none; z-index: 99999; width: {dragState.width}px; height: {dragState.height}px; left: {dragState.currentX -
            dragState.pointerOffsetX}px; top: {dragState.currentY -
            dragState.pointerOffsetY}px; opacity: 0.95; transform: rotate(2deg); box-shadow: 0 12px 24px rgba(0,0,0,0.25); background: white; border: 1px solid #e0d8cc; border-radius: 18px; padding: 16px;"
    >
        <!-- Manually recreate TaskCard content to avoid background conflicts -->
        {#if dragState.item.dueDate && dragState.item.status !== 'Done' && new Date(dragState.item.dueDate) < new Date(new Date().setHours(0, 0, 0, 0))}
            <div style="font-size: 10px; font-weight: 600; color: var(--blush-d); margin-bottom: 8px;">● overdue</div>
        {/if}
        <p style="font-size: 13px; font-weight: 600; line-height: 1.4; margin: 0 0 8px 0;">{dragState.item.title}</p>
        {#if dragState.item.description && /[\p{L}\p{N}]/u.test(dragState.item.description.trim())}
            <div style="font-size: 12px; line-height: 1.5; color: var(--ink-2); margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                {dragState.item.description}
            </div>
        {/if}
        {#if dragState.item.checklist && dragState.item.checklist.length > 0}
            <div style="margin-bottom: 8px;">
                <div style="font-size: 11px; color: var(--ink-3);">
                    {dragState.item.checklist.filter((ci) => ci.done).length}/{dragState.item.checklist.length}
                </div>
            </div>
        {/if}
        <div style="display: flex; align-items: center; gap: 12px; margin-top: 12px;">
            {#if dragState.item.dueDate}
                <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--ink-3);">
                    <svg style="width: 12px; height: 12px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    {dragState.item.dueDate}
                </div>
            {/if}
            {#if dragState.item.checklist && dragState.item.checklist.length > 0}
                <span style="font-size: 11px; color: var(--ink-3);">{dragState.item.checklist.filter((ci) => ci.done).length}/{dragState.item.checklist.length}</span>
            {/if}
        </div>
    </div>
{/if}

<style>
    .tasks-board {
        margin-right: -16px;
        padding-right: 32px;
        padding-bottom: max(32px, env(safe-area-inset-bottom, 0px));
    }
    @media (min-width: 768px) {
        .tasks-board {
            margin-right: 0;
            padding-right: 32px;
        }
    }
</style>
