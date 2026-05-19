<script lang="ts">
    import Input from '$lib/components/ui/Input.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import { X, Plus, CheckSquare, GripVertical } from 'lucide-svelte';
    import type { TaskChecklistItem } from '$lib/tasks/taskChecklist';
    import { flip } from 'svelte/animate';
    import { isDragThresholdMet } from '$lib/utils/drag';

    let {
        items = $bindable<TaskChecklistItem[]>([]),
        onMutate,
        // eslint-disable-next-line no-useless-assignment
        flush = $bindable()
    }: {
        items?: TaskChecklistItem[];
        onMutate?: (immediate?: boolean) => void | Promise<void>;
        flush?: () => void;
    } = $props();

    let showChecklistInput = $state(false);
    let editingChecklistId = $state<string | null>(null);
    let editingChecklistText = $state('');
    let newChecklistText = $state('');

    type DragState = {
        id: string;
        pointerOffsetY: number;
        railTop: number;
        railBottom: number;
        left: number;
        width: number;
        height: number;
        currentTop: number;
        startX: number;
        startY: number;
        isDragging: boolean;
        item: TaskChecklistItem;
    };

    let dragState = $state<DragState | null>(null);

    function checklistProgress() {
        if (items.length === 0) return 0;
        const done = items.filter((ci) => ci.done).length;
        return Math.round((done / items.length) * 100);
    }

    async function notify(immediate = false) {
        await onMutate?.(immediate);
    }

    async function addChecklistItem() {
        if (!newChecklistText.trim()) return;
        items = [...items, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false, order: items.length }];
        newChecklistText = '';
        await notify();
    }

    // Auto-submit functionality exposed to parent
    // eslint-disable-next-line no-useless-assignment
    flush = () => {
        if (newChecklistText.trim()) {
            items = [...items, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false, order: items.length }];
            newChecklistText = '';
            void notify();
        }
    };

    async function removeChecklistItem(id: string) {
        items = items.filter((ci) => ci.id !== id);
        await notify(true);
    }

    async function updateChecklistItemText(id: string, newText: string) {
        items = items.map((ci) => (ci.id === id ? { ...ci, text: newText } : ci));
        await notify(true);
    }

    async function toggleChecklistItem(id: string) {
        items = items.map((ci) => (ci.id === id ? { ...ci, done: !ci.done } : ci));
        await notify();
    }

    function clamp(value: number, min: number, max: number) {
        return Math.min(Math.max(value, min), max);
    }

    function getDragIndex(activeId: string, pointerY: number) {
        const wrappers = Array.from(
            document.querySelectorAll<HTMLElement>(`.modal-checklist-item:not([data-dragging-id="${activeId}"])`)
        );
        const index = wrappers.findIndex((wrapper) => {
            const rect = wrapper.getBoundingClientRect();
            return pointerY < rect.top + rect.height / 2;
        });
        return index === -1 ? wrappers.length : index;
    }

    function handleWindowPointerMove(event: PointerEvent) {
        if (!dragState) return;
        event.preventDefault();

        if (!dragState.isDragging) {
            if (isDragThresholdMet(dragState.startX, dragState.startY, event.clientX, event.clientY)) {
                dragState.isDragging = true;
                document.body.style.userSelect = 'none';
            } else {
                return;
            }
        }

        const pointerY = clamp(event.clientY, dragState.railTop, dragState.railBottom);
        const nextTop = clamp(event.clientY - dragState.pointerOffsetY, dragState.railTop, dragState.railBottom - dragState.height);
        const targetIndex = getDragIndex(dragState.id, pointerY);

        dragState = { ...dragState, currentTop: nextTop };

        const currentIds = items.map((item) => item.id);
        const filteredIds = currentIds.filter((id) => id !== dragState?.id);
        filteredIds.splice(targetIndex, 0, dragState.id);

        if (JSON.stringify(currentIds) !== JSON.stringify(filteredIds)) {
            const itemMap = new Map(items.map((item) => [item.id, item]));
            items = filteredIds.map((id) => itemMap.get(id)!).map((item, index) => ({ ...item, order: index }));
        }
    }

    function handleWindowPointerUp(event: PointerEvent) {
        if (!dragState) return;
        event.preventDefault();
        dragState = null;
        document.body.style.removeProperty('user-select');
        window.removeEventListener('pointermove', handleWindowPointerMove);
        window.removeEventListener('pointerup', handleWindowPointerUp);
        void notify(true);
    }

    function beginDrag(event: PointerEvent, item: TaskChecklistItem) {
        if (event.button !== 0) return;
        const handle = event.currentTarget as HTMLElement;
        const wrapper = handle.closest<HTMLElement>('.modal-checklist-item');
        const rail = handle.closest<HTMLElement>('.modal-checklist-items');
        if (!wrapper || !rail) return;

        event.preventDefault();
        event.stopPropagation();

        const wrapperRect = wrapper.getBoundingClientRect();
        const railRect = rail.getBoundingClientRect();

        dragState = {
            id: item.id,
            item,
            pointerOffsetY: event.clientY - wrapperRect.top,
            railTop: railRect.top,
            railBottom: railRect.bottom,
            left: wrapperRect.left,
            width: wrapperRect.width,
            height: wrapperRect.height,
            currentTop: wrapperRect.top,
            startX: event.clientX,
            startY: event.clientY,
            isDragging: false
        };

        window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
        window.addEventListener('pointerup', handleWindowPointerUp, { passive: false });
    }
</script>

<div class="modal-checklist-section">
    <div class="modal-checklist-header">
        <CheckSquare class="modal-icon-sm" />
        <span>Sub-tasks</span>
        {#if items.length > 0}
            <span class="modal-checklist-progress-text">{checklistProgress()}%</span>
        {/if}
    </div>
    {#if items.length > 0}
        <div class="modal-checklist-progress-bar">
            <div class="modal-checklist-progress-fill" style="width: {checklistProgress()}%"></div>
        </div>
    {/if}
    {#if items.length > 0}
        <div class="modal-checklist-items">
            {#each items as ci (ci.id)}
                <div
                    class="modal-checklist-item {dragState?.id === ci.id && dragState.isDragging ? 'modal-checklist-item-placeholder' : ''}"
                    animate:flip={{ duration: 180 }}
                    data-dragging-id={dragState?.id === ci.id ? ci.id : undefined}
                >
                    <input type="checkbox" checked={ci.done} onchange={() => toggleChecklistItem(ci.id)} class="modal-checklist-checkbox" />
                    {#if editingChecklistId === ci.id}
                        <Input
                            bind:value={editingChecklistText}
                            onkeydown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void updateChecklistItemText(ci.id, editingChecklistText);
                                    editingChecklistId = null;
                                } else if (e.key === 'Escape') {
                                    editingChecklistId = null;
                                }
                            }}
                            onblur={() => {
                                if (editingChecklistText !== ci.text) {
                                    void updateChecklistItemText(ci.id, editingChecklistText);
                                }
                                editingChecklistId = null;
                            }}
                            class="modal-checklist-input"
                        />
                    {:else}
                        <button
                            type="button"
                            class={ci.done
                                ? 'modal-checklist-text-done modal-checklist-text-btn'
                                : 'modal-checklist-text modal-checklist-text-btn'}
                            onclick={() => {
                                editingChecklistId = ci.id;
                                editingChecklistText = ci.text;
                            }}
                        >
                            {ci.text}
                        </button>
                    {/if}
                    <div class="modal-checklist-item-actions">
                        <Button type="button" variant="ghost" size="sm" class="modal-icon-btn-sm" onclick={() => removeChecklistItem(ci.id)}>
                            <X class="modal-icon-xs" />
                        </Button>
                        <button
                            type="button"
                            class="modal-checklist-drag-handle"
                            onpointerdown={(e) => beginDrag(e, ci)}
                            aria-label="Reorder sub-task"
                        >
                            <GripVertical class="modal-icon-xs" />
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
    {#if !showChecklistInput}
        <Button type="button" variant="ghost" size="sm" onclick={() => (showChecklistInput = true)} class="modal-add-checklist-btn">
            <Plus class="modal-icon-xs" /> Add sub-task
        </Button>
    {:else}
        <div class="modal-checklist-add">
            <Input
                bind:value={newChecklistText}
                placeholder="Enter sub-task..."
                onkeydown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        void addChecklistItem();
                    }
                }}
                class="modal-checklist-add-input"
            />
            <Button type="button" size="sm" onclick={() => void addChecklistItem()}>Add</Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => {
                    newChecklistText = '';
                    showChecklistInput = false;
                }}>Cancel</Button
            >
        </div>
    {/if}
</div>

{#if dragState && dragState.isDragging}
    <div
        class="modal-checklist-item-ghost"
        style={`left: ${dragState.left}px; top: ${dragState.currentTop}px; width: ${dragState.width}px; height: ${dragState.height}px;`}
    >
        <input type="checkbox" checked={dragState.item.done} disabled class="modal-checklist-checkbox" />
        <span class={dragState.item.done ? 'modal-checklist-text-done' : 'modal-checklist-text'}>
            {dragState.item.text}
        </span>
        <div class="modal-checklist-item-actions">
            <Button type="button" variant="ghost" size="sm" class="modal-icon-btn-sm" disabled>
                <X class="modal-icon-xs" />
            </Button>
            <div class="modal-checklist-drag-handle">
                <GripVertical class="modal-icon-xs" />
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-checklist-items {
        position: relative;
    }
    .modal-checklist-item-placeholder {
        opacity: 0.2;
    }
    .modal-checklist-item-actions {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    .modal-checklist-drag-handle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        color: var(--ink-3);
        cursor: grab;
        border: none;
        background: none;
        padding: 0;
    }
    .modal-checklist-drag-handle:active {
        cursor: grabbing;
    }
    .modal-checklist-item-ghost {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 6px;
        box-shadow: 0 8px 24px color-mix(in srgb, var(--ink-1) 12%, transparent);
        opacity: 0.95;
    }
</style>

