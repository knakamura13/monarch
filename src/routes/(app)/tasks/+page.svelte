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

    const POINTER_MOVE_THRESHOLD_PX = 8;

    let dragState = $state<DragState | null>(null);
    let isDragging = $derived(!!dragState?.isDragging);
    let wasDragging = $state(false);
    let liveRegionMessage = $state<string>('');

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
        { id: 'TODO', label: 'This week', pillClass: 's-active' },
        { id: 'IN_PROGRESS', label: 'Soon', pillClass: 's-note' },
        { id: 'WAITING', label: 'Waiting', pillClass: 's-waiting' },
        { id: 'DONE', label: 'Done', pillClass: 's-done' }
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

        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!dragState.isDragging) {
            if (distance > POINTER_MOVE_THRESHOLD_PX) {
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

        // Hit testing for reordering
        const columns = Array.from(scrollContainer!.querySelectorAll('.tasks-column')) as HTMLElement[];
        let targetStatus: string | null = null;
        let targetTaskId: string | null = null;
        let position: 'before' | 'after' | null = null;

        for (const col of columns) {
            const rect = col.getBoundingClientRect();
            if (currentX > rect.left && currentX < rect.right) {
                targetStatus = COLUMNS[columns.indexOf(col)]?.id || null;
                const cards = Array.from(col.querySelectorAll('.task-card:not([data-task-id="' + dragState.id + '"])')) as HTMLElement[];
                for (const card of cards) {
                    const cardRect = card.getBoundingClientRect();
                    if (currentY > cardRect.top && currentY < cardRect.bottom) {
                        targetTaskId = card.getAttribute('data-task-id');
                        position = currentY < cardRect.top + cardRect.height / 2 ? 'before' : 'after';
                        break;
                    }
                }
                break;
            }
        }

        if (targetStatus) {
            performLocalReorder(dragState.id, targetStatus, targetTaskId, position);
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

        const { isDragging } = dragState;
        if (isDragging) {
            wasDragging = true;
        }

        dragState = null;
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('touch-action');
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);

        if (!isDragging) return;

        // Persist change
        const updates = data.tasks.map((t) => ({
            id: t.id,
            status: t.status,
            order: t.order
        }));

        try {
            const formData = new FormData();
            formData.append('updates', JSON.stringify(updates));
            const response = await fetch('?/reorder', { method: 'POST', body: formData });
            if (response.ok) {
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

        // Get the current column safely
        const currentColumnValue = grouped[currentColumnIdx];
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
                        <TaskCard
                            {task}
                            onEdit={async () => {
                                await updateUrl(task.id);
                            }}
                            onPointerDown={handlePointerDown}
                            isDragging={dragState?.id === task.id && dragState.isDragging}
                            isAnyDragging={isDragging}
                            {wasDragging}
                        />
                    </div>
                {/each}
                {#if column.tasks.length === 0}
                    <div class="tasks-empty-placeholder" role="listitem">No tasks</div>
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
        style="position: fixed; pointer-events: none; z-index: 9999; width: {dragState.width}px; height: {dragState.height}px; left: {dragState.currentX -
            dragState.pointerOffsetX}px; top: {dragState.currentY -
            dragState.pointerOffsetY}px; opacity: 0.9; transform: rotate(2deg); box-shadow: 0 12px 24px rgba(0,0,0,0.15);"
    >
        <TaskCard task={dragState.item} />
    </div>
{/if}
