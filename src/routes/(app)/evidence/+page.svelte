<script lang="ts">
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import { enhance } from '$app/forms';
    import { Plus, Check, Trash2, Edit2 } from 'lucide-svelte';
    import { getPageNumber } from '$lib/constants/navigation';
    import { showSuccessToast } from '$lib/stores/toast';
    import type { PageData } from './$types';
    import Input from '$lib/components/ui/Input.svelte';
    import ThreeDotsMenu from '$lib/components/ui/ThreeDotsMenu.svelte';
    import Dialog from '$lib/components/ui/Dialog.svelte';
    import type { DropdownMenuItem } from '$lib/components/ui/menuTypes';

    let { data, form }: { data: PageData; form: { error?: string } } = $props();

    let showAddModal = $state(false);
    let newCategoryName = $state('');
    let editingCategory = $state<string | null>(null);
    let editCategoryName = $state('');
    let editCategoryTarget = $state(0);
    let deleteConfirmCategory = $state<string | null>(null);

    function openAddModal() {
        newCategoryName = '';
        showAddModal = true;
    }

    function startEdit(category: string) {
        editingCategory = category;
        editCategoryName = category;
        const cat = data.categories.find((c) => c.category === category);
        if (cat) {
            editCategoryTarget = cat.targetCount;
        }
    }

    function cancelEdit() {
        editingCategory = null;
        editCategoryName = '';
        editCategoryTarget = 0;
    }

    function openDeleteConfirm(category: string) {
        deleteConfirmCategory = category;
    }
</script>

<PageHeader title="Evidence" sub="Track evidence collection progress by category." number={getPageNumber('/evidence')}>
    {#snippet actions()}
        {#if data.isOwner}
            <Button onclick={openAddModal}>
                {#snippet children()}<Plus style="width: 14px; height: 14px;" /> Add category{/snippet}
            </Button>
        {/if}
    {/snippet}
</PageHeader>

{#if form?.error}
    <div
        class="card"
        style="border: 1px solid var(--blush-d); background: var(--blush); padding: 16px; margin-bottom: 16px; color: var(--blush-d);"
    >
        {form.error}
    </div>
{/if}

<div class="evidence-grid">
    {#each data.categories as cat, i (cat.category)}
        <div class="card" style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; color: var(--ink-3); flex: 1; min-width: 0;">
                    {#if editingCategory === cat.category}
                        <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
                            <Input
                                type="text"
                                bind:value={editCategoryName}
                                style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 8px; height: 24px;"
                                onkeydown={(e) => {
                                    if (e.key === 'Escape') cancelEdit();
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const form = document.getElementById(`edit-form-${i}`) as HTMLFormElement;
                                        form?.requestSubmit();
                                    }
                                }}
                            />
                            <form
                                id="edit-form-{i}"
                                method="post"
                                action="?/editCategory"
                                use:enhance={({
                                    formElement: _formElement,
                                    formData: _formData,
                                    action: _action,
                                    cancel: _cancel,
                                    submitter: _submitter
                                }) => {
                                    return async ({ result, update }) => {
                                        await update();
                                        if (result.type === 'success') {
                                            showSuccessToast('Category renamed');
                                            editingCategory = null;
                                            editCategoryName = '';
                                        }
                                    };
                                }}
                                style="display: contents;"
                            >
                                <input type="hidden" name="oldCategory" value={cat.category} />
                                <input type="hidden" name="newCategory" value={editCategoryName} />
                                <input type="hidden" name="newTarget" value={editCategoryTarget} />
                                <Button type="submit" variant="ghost" size="icon" class="modal-icon-btn-sm">
                                    <Check style="width: 14px; height: 14px;" />
                                </Button>
                            </form>
                            <Button type="button" variant="ghost" size="icon" class="modal-icon-btn-sm" onclick={cancelEdit}>
                                <span style="font-size: 16px; line-height: 1;">×</span>
                            </Button>
                        </div>
                    {:else}
                        <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;"
                            >{cat.category}</span
                        >
                    {/if}
                </div>
                {#if data.isOwner}
                    <ThreeDotsMenu
                        menuId={`evidence-menu-${cat.category}`}
                        position="bottom-left"
                        items={[
                            {
                                id: 'edit',
                                label: 'Edit',
                                icon: Edit2,
                                action: () => startEdit(cat.category)
                            },
                            {
                                id: 'delete',
                                label: 'Delete',
                                icon: Trash2,
                                variant: 'destructive',
                                action: () => openDeleteConfirm(cat.category),
                                disabled: cat.currentCount > 0
                            }
                        ] satisfies DropdownMenuItem[]}
                    />
                {/if}
            </div>
            <div style="display: flex; align-items: baseline; gap: 4px; justify-content: space-between;">
                <div style="font-family: var(--font-display); font-size: 44px; font-weight: 500; line-height: 1; margin-bottom: 4px; display: flex; align-items: baseline; gap: 4px;">
                    {cat.currentCount}
                    {#if editingCategory === cat.category}
                        <div style="display: flex; align-items: center; gap: 2px;">
                            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--ink-3);">/</span>
                            <Input
                                type="number"
                                bind:value={editCategoryTarget}
                                min="0"
                                style="font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); width: 40px; padding: 2px 4px; height: 20px; border: 1px solid var(--surface-3); background: var(--surface-1);"
                                onkeydown={(e) => {
                                    if (e.key === 'Escape') cancelEdit();
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const form = document.getElementById(`edit-form-${i}`) as HTMLFormElement;
                                        form?.requestSubmit();
                                    }
                                }}
                            />
                        </div>
                    {:else}
                        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--ink-3);">/ {cat.targetCount}</span>
                    {/if}
                </div>
                <form
                    method="post"
                    action="?/adjustCount"
                    use:enhance={() => {
                        return async ({ result, update }) => {
                            await update();
                            if (result.type === 'success') {
                                showSuccessToast('Evidence count updated');
                            }
                        };
                    }}
                    style="display: flex; gap: 4px;"
                >
                    <input type="hidden" name="category" value={cat.category} />
                    <Button type="submit" name="delta" value="-1" variant="ghost" size="sm" disabled={cat.currentCount <= 0}>-</Button>
                    <Button type="submit" name="delta" value="1" variant="ghost" size="sm">+</Button>
                </form>
            </div>
            <div style="height: 6px; background: var(--surface-3); border-radius: 3px; overflow: hidden; margin-top: 12px;">
                <div
                    style:width={`${Math.min(100, cat.targetCount > 0 ? (cat.currentCount / cat.targetCount) * 100 : 0)}%`}
                    style="height: 100%; background: var(--lilac-d); transition: width 0.4s ease-in-out;"
                ></div>
            </div>
        </div>
    {/each}
</div>

<!-- Add Category Modal -->
{#if showAddModal}
    <div
        role="button"
        tabindex="0"
        style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); background: rgba(26, 26, 24, 0.25);"
        onclick={() => (showAddModal = false)}
        onkeydown={(e) => {
            if (e.key === 'Escape') showAddModal = false;
        }}
    >
        <div
            class="card"
            style="width: 400px; padding: 24px;"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
            }}
            role="dialog"
            aria-modal="true"
            tabindex="-1"
        >
            <h2 style="font-family: var(--font-display); font-size: 24px; margin-bottom: 16px;">Add Category</h2>
            <form
                method="post"
                action="?/addCategory"
                use:enhance={({
                    formElement: _formElement,
                    formData: _formData,
                    action: _action,
                    cancel: _cancel,
                    submitter: _submitter
                }) => {
                    // Let the form submit normally
                    return async ({ result, update }) => {
                        await update();
                        // Close modal on successful submission
                        if (result.type === 'success') {
                            showSuccessToast('Category added');
                            showAddModal = false;
                        }
                    };
                }}
            >
                <label for="newCategory" style="display: block; font-size: 13px; margin-bottom: 4px;">Category name</label>
                <Input id="newCategory" name="category" type="text" bind:value={newCategoryName} placeholder="e.g., Passport" />
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
                    <Button type="button" variant="ghost" onclick={() => (showAddModal = false)}>Cancel</Button>
                    <Button type="submit">Add</Button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Delete Confirmation Dialog -->
{#if deleteConfirmCategory}
    {@const categoryToDelete = data.categories.find((c) => c.category === deleteConfirmCategory)}
    <Dialog
        open={true}
        onClose={() => {
            deleteConfirmCategory = null;
        }}
        title="Delete Category"
        contentWidth="sm"
        cancelLabel="Cancel"
        submitLabel="Delete"
        submitVariant="destructive"
        footerFormId="delete-category-form"
    >
        <form
            id="delete-category-form"
            method="post"
            action="?/deleteCategory"
            use:enhance={({ formElement: _formElement, formData: _formData, action: _action, cancel: _cancel, submitter: _submitter }) => {
                return async ({ result, update }) => {
                    await update();
                    if (result.type === 'success') {
                        showSuccessToast('Category deleted');
                        deleteConfirmCategory = null;
                    }
                };
            }}
        >
            <input type="hidden" name="category" value={deleteConfirmCategory} />
            <p style="font-size: 14px; line-height: 1.5; color: var(--ink-2); margin: 0;">
                Are you sure you want to delete <strong>"{deleteConfirmCategory}"</strong>?
                {#if categoryToDelete && categoryToDelete.currentCount > 0}
                    <br /><br />
                    <span style="color: var(--blush-d);"
                        >This category has {categoryToDelete.currentCount} items and cannot be deleted.</span
                    >
                {:else}
                    <br /><br />
                    This action cannot be undone.
                {/if}
            </p>
        </form>
    </Dialog>
{/if}

<style>
    .evidence-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        padding-bottom: max(32px, env(safe-area-inset-bottom, 0px));
    }
    @media (min-width: 640px) {
        .evidence-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    @media (min-width: 1024px) {
        .evidence-grid {
            grid-template-columns: repeat(3, 1fr);
        }
    }
</style>
