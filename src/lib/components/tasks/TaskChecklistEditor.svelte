<script lang="ts">
    import Input from '$lib/components/ui/Input.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import X from "lucide-svelte/icons/x";
    import Plus from "lucide-svelte/icons/plus";
    import CheckSquare from "lucide-svelte/icons/check-square";;
    import type { TaskChecklistItem } from '$lib/tasks/taskChecklist';

    let {
        items = $bindable<TaskChecklistItem[]>([]),
        onMutate
    }: {
        items?: TaskChecklistItem[];
        onMutate?: (immediate?: boolean) => void | Promise<void>;
    } = $props();

    let showChecklistInput = $state(false);
    let editingChecklistId = $state<string | null>(null);
    let editingChecklistText = $state('');
    let newChecklistText = $state('');

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
