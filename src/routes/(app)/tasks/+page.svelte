<script lang="ts">
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
        item: any;
        pointerOffsetY: number;
        containerRect: DOMRect;
        width: number;
        height: number;
        currentTop: number;
        currentLeft: number;
        startX: number;
        startY: number;
    };

    let dragState = $state<DragState | null>(null);
    let isDragging = $derived(!!dragState);
    let liveRegionMessage = $state<string>('');

    async function updateUrl(id: string | null) {
        const url = new URL(window.location.href);
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

        dragState = {
            id,
            item: data.tasks.find((t) => t.id === id),
            pointerOffsetY: event.clientY - rect.top,
            containerRect,
            width: rect.width,
            height: rect.height,
            currentTop: rect.top,
            currentLeft: rect.left,
            startX: event.clientX,
            startY: event.clientY
        };

        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    }

    function handlePointerMove(event: PointerEvent) {
        if (!dragState) return;

        const nextTop = event.clientY - dragState.pointerOffsetY;
        const nextLeft = event.clientX - (dragState.startX - dragState.currentLeft);

        dragState = {
            ...dragState,
            currentTop: nextTop,
            currentLeft: nextLeft
        };

        // Hit testing for reordering
        const columns = Array.from(scrollContainer!.querySelectorAll('.tasks-column')) as HTMLElement[];
        let targetStatus: string | null = null;
        let targetTaskId: string | null = null;
        let position: 'before' | 'after' | null = null;

        for (const col of columns) {
            const rect = col.getBoundingClientRect();
            if (event.clientX > rect.left && event.clientX < rect.right) {
                targetStatus = COLUMNS[columns.indexOf(col)]?.id || null;
                const cards = Array.from(col.querySelectorAll('.task-card:not([data-task-id="' + dragState.id + '"])')) as HTMLElement[];
                for (const card of cards) {
                    const cardRect = card.getBoundingClientRect();
                    if (event.clientY > cardRect.top && event.clientY < cardRect.bottom) {
                        targetTaskId = card.getAttribute('data-task-id');
                        position = event.clientY < cardRect.top + cardRect.height / 2 ? 'before' : 'after';
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

    function performLocalReorder(activeId: string, targetStatus: string, targetTaskId: string | null, position: 'before' | 'after' | null) {
        const activeTask = data.tasks.find((t) => t.id === activeId);
        if (!activeTask) return;

        let newTasks = data.tasks.filter((t) => t.id !== activeId);
        const columnTasks = newTasks.filter((t) => t.status === targetStatus).sort((a, b) => a.order - b.order);

        if (targetTaskId) {
            let targetIdx = columnTasks.findIndex((t) => t.id === targetTaskId);
            if (position === 'after') targetIdx++;
            columnTasks.splice(targetIdx, 0, { ...activeTask, status: targetStatus as any });
        } else {
            columnTasks.push({ ...activeTask, status: targetStatus as any });
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

        const activeId = dragState.id;
        dragState = null;
        document.body.style.removeProperty('user-select');
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);

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

        const currentColumnIdx = COLUMNS.findIndex((c) => c.id === activeTask.status);
        const currentColumn = grouped[currentColumnIdx];
        if (!currentColumn || currentColumnIdx === -1) return;

        const allTasks = [...data.tasks];
        const currentTaskIdx = currentColumn.tasks.findIndex((t) => t.id === taskId);
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
                if (currentTaskIdx >= currentColumn.tasks.length - 1) return;
                const columnTasks = allTasks.filter((t) => t.status === activeTask.status).sort((a, b) => a.order - b.order);
                const newOrder = columnTasks.filter((t) => t.id !== taskId);
                newOrder.splice(currentTaskIdx + 1, 0, activeTask);
                newOrder.forEach((t, idx) => {
                    updates.push({ id: t.id, status: t.status, order: idx });
                });
                liveRegionMessage = `Moved "${activeTask.title}" down in ${currentColumn.label}`;
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
                liveRegionMessage = `Moved "${activeTask.title}" up in ${currentColumn.label}`;
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
                        role="group"
                        tabindex="-1"
                        aria-label={`Task actions for ${task.title}`}
                        onkeydown={(e) => handleTaskKeydown(e, task.id)}
                        style={dragState?.id === task.id ? 'opacity: 0.2; pointer-events: none;' : ''}
                    >
                        <TaskCard
                            {task}
                            onEdit={async (id: string) => {
                                await updateUrl(id);
                            }}
                            onPointerDown={handlePointerDown}
                            isDragging={dragState?.id === task.id}
                            isAnyDragging={!!dragState}
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
                    if (result.type === 'success') {
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
                if (result.type === 'success') {
                    showCreateModal = false;
                    defaultStatus = undefined;
                    await invalidateAll();
                    showSuccessToast('Task created successfully');
                }
            };
        }}
    />
{/if}

{#if dragState}
    <div
        class="task-drag-ghost"
        style="position: fixed; pointer-events: none; z-index: 9999; width: {dragState.width}px; height: {dragState.height}px; left: {dragState.currentLeft}px; top: {dragState.currentTop}px; opacity: 0.9; transform: rotate(2deg); box-shadow: 0 12px 24px rgba(0,0,0,0.15);"
    >
        <TaskCard task={dragState.item} />
    </div>
{/if}
