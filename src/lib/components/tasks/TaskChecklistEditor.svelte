<script lang="ts">
    import { flip } from 'svelte/animate';
    import Input from '$lib/components/ui/Input.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import { X, Plus, CheckSquare, GripVertical } from 'lucide-svelte';
    import type { TaskChecklistItem } from '$lib/tasks/taskChecklist';
    import { isDragThresholdMet } from '$lib/utils/drag';
    import { onDestroy } from 'svelte';

    let {
        items = $bindable<TaskChecklistItem[]>([]),
        newChecklistText = $bindable(''),
        onMutate
    }: {
        items?: TaskChecklistItem[];
        newChecklistText?: string;
        onMutate?: (immediate?: boolean) => void | Promise<void>;
    } = $props();

    let showChecklistInput = $state(false);
    let editingChecklistId = $state<string | null>(null);
    let editingChecklistText = $state('');

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

    type DragState = {
        id: string;
        item: TaskChecklistItem;
        pointerOffsetY: number;
        containerTop: number;
        containerBottom: number;
        left: number;
        width: number;
        height: number;
        currentTop: number;
        startX: number;
        startY: number;
        isDragging: boolean;
    };

    let dragState = $state<DragState | null>(null);

    function clamp(value: number, min: number, max: number) {
        return Math.min(Math.max(value, min), max);
    }

    function getDragIndex(activeId: string, pointerY: number) {
        const wrappers = Array.from(
            document.querySelectorAll<HTMLElement>(
                `.modal-checklist-item-wrapper:not([data-checklist-id="${activeId}"])`
            )
        );
        const index = wrappers.findIndex((wrapper) => {
            const rect = wrapper.getBoundingClientRect();
            return pointerY < rect.top + rect.height / 2;
        });
        return index === -1 ? wrappers.length : index;
    }

    function updateDraggedItemPosition(event: PointerEvent) {
        if (!dragState) return;

        if (!dragState.isDragging) {
            if (isDragThresholdMet(dragState.startX, dragState.startY, event.clientX, event.clientY)) {
                dragState.isDragging = true;
                document.body.style.userSelect = 'none';
            } else {
                return;
            }
        }

        const pointerY = clamp(event.clientY, dragState.containerTop, dragState.containerBottom);
        const nextTop = clamp(event.clientY - dragState.pointerOffsetY, dragState.containerTop, dragState.containerBottom - dragState.height);
        const targetIndex = getDragIndex(dragState.id, pointerY);

        const orderedIds = items.map(i => i.id).filter(id => id !== dragState?.id);
        orderedIds.splice(targetIndex, 0, dragState.id);

        dragState = { ...dragState, currentTop: nextTop };

        const currentIds = items.map(i => i.id);
        if (JSON.stringify(orderedIds) !== JSON.stringify(currentIds)) {
            const itemMap = new Map(items.map(i => [i.id, i]));
            items = orderedIds.map(id => itemMap.get(id)!).filter(Boolean);
        }
    }

    function handleWindowPointerMove(event: PointerEvent) {
        event.preventDefault();
        updateDraggedItemPosition(event);
    }

    function handleWindowPointerUp(event: PointerEvent) {
        event.preventDefault();
        dragState = null;
        document.body.style.removeProperty('user-select');
        window.removeEventListener('pointermove', handleWindowPointerMove);
        window.removeEventListener('pointerup', handleWindowPointerUp);
        void notify();
    }

    function beginChecklistDrag(event: PointerEvent, item: TaskChecklistItem) {
        if (event.button !== 0) return;
        const handle = event.currentTarget as HTMLElement;
        const wrapper = handle.closest<HTMLElement>('.modal-checklist-item-wrapper');
        const container = handle.closest<HTMLElement>('.modal-checklist-items');
        if (!wrapper || !container) return;

        event.preventDefault();
        event.stopPropagation();

        const wrapperRect = wrapper.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        dragState = {
            id: item.id,
            item,
            pointerOffsetY: event.clientY - wrapperRect.top,
            containerTop: containerRect.top,
            containerBottom: containerRect.bottom,
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

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('pointermove', handleWindowPointerMove);
            window.removeEventListener('pointerup', handleWindowPointerUp);
        }
    });
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
                    class="modal-checklist-item-wrapper {dragState?.id === ci.id && dragState.isDragging ? 'placeholder' : ''}"
                    animate:flip={{ duration: 180 }}
                    data-checklist-id={ci.id}
                >
                    <div class="modal-checklist-item">
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
                        <Button type="button" variant="ghost" size="sm" class="modal-icon-btn-sm" onclick={() => removeChecklistItem(ci.id)}>
                            <X class="modal-icon-xs" />
                        </Button>
                        <button
                            type="button"
                            class="modal-checklist-drag-handle"
                            onpointerdown={(e) => beginChecklistDrag(e, ci)}
                        >
                            <GripVertical class="modal-icon-xs" />
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    {#if dragState && dragState.isDragging}
        <div
            class="modal-checklist-drag-ghost"
            style="left: {dragState.left}px; top: {dragState.currentTop}px; width: {dragState.width}px; height: {dragState.height}px;"
        >
            <div class="modal-checklist-item">
                <input type="checkbox" checked={dragState.item.done} disabled class="modal-checklist-checkbox" />
                <span class={dragState.item.done ? 'modal-checklist-text-done' : 'modal-checklist-text'}>
                    {dragState.item.text}
                </span>
                <Button type="button" variant="ghost" size="sm" class="modal-icon-btn-sm" disabled>
                    <X class="modal-icon-xs" />
                </Button>
                <div class="modal-checklist-drag-handle">
                    <GripVertical class="modal-icon-xs" />
                </div>
            </div>
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

<style>
    .modal-checklist-item-wrapper {
        position: relative;
    }

    .modal-checklist-item-wrapper.placeholder {
        opacity: 0.3;
    }

    .modal-checklist-drag-handle {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        color: var(--ink-3);
        cursor: grab;
        background: none;
        border: none;
        border-radius: 4px;
        touch-action: none;
    }

    .modal-checklist-drag-handle:hover {
        color: var(--ink-1);
        background: var(--surface-3);
    }

    .modal-checklist-drag-handle:active {
        cursor: grabbing;
    }

    .modal-checklist-drag-ghost {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        opacity: 0.9;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }

    .modal-checklist-drag-ghost .modal-checklist-item {
        background: var(--surface-2);
        border: 1px solid var(--line);
    }
</style>
