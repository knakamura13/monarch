<script lang="ts">
    import type { QuickLink, QuickLinkFolder } from '$lib/types/enums';
    import Dialog from '$lib/components/ui/Dialog.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import Label from '$lib/components/ui/Label.svelte';
    import Textarea from '$lib/components/ui/Textarea.svelte';
    import ErrorDetails from '$lib/components/ErrorDetails.svelte';
    import { createFormState } from '$lib/utils/formState.svelte';
    import { enhance } from '$app/forms';

    type ActionForm = { error?: string; errorId?: string | null } | undefined;

    let {
        links,
        form,
        enableDeleteDialog = true
    }: {
        links: QuickLink[];
        form?: ActionForm;
        enableDeleteDialog?: boolean;
    } = $props();

    const formState = createFormState();

    let modalOpen = $state(false);
    let modalMode = $state<'link' | 'folder'>('link');
    let editing = $state<QuickLink | null>(null);
    let editingFolder = $state<QuickLinkFolder | null>(null);
    let addingToFolder = $state<QuickLinkFolder | null>(null);
    let draftUrl = $state('');
    let draftTitle = $state('');
    let draftDescription = $state('');
    let draftFolderName = $state('');

    let deleteModalOpen = $state(false);
    let itemToDelete = $state<{ type: 'link' | 'folder'; id: string; name: string } | null>(null);

    function prettyHostname(url: string): string {
        try {
            return new URL(url).hostname;
        } catch {
            return 'Link';
        }
    }

    function closeModal() {
        modalOpen = false;
    }

    function closeDeleteModal() {
        deleteModalOpen = false;
        itemToDelete = null;
    }

    export function openAddLink(folder?: QuickLinkFolder | null) {
        modalMode = 'link';
        editing = null;
        editingFolder = null;
        addingToFolder = folder ?? null;
        draftUrl = '';
        draftTitle = '';
        draftDescription = '';
        draftFolderName = '';
        modalOpen = true;
    }

    export function openEditLink(link: QuickLink) {
        modalMode = 'link';
        editing = link;
        editingFolder = null;
        addingToFolder = null;
        draftUrl = link.url;
        draftTitle = link.title ?? '';
        draftDescription = link.description ?? '';
        draftFolderName = '';
        modalOpen = true;
    }

    export function openEditFolder(folder: QuickLinkFolder) {
        modalMode = 'folder';
        editing = null;
        editingFolder = folder;
        addingToFolder = null;
        draftUrl = '';
        draftTitle = '';
        draftDescription = '';
        draftFolderName = folder.name ?? '';
        modalOpen = true;
    }

    export function openAddFolder() {
        modalMode = 'folder';
        editing = null;
        editingFolder = null;
        addingToFolder = null;
        draftUrl = '';
        draftTitle = '';
        draftDescription = '';
        draftFolderName = '';
        modalOpen = true;
    }

    export function openDelete(type: 'link' | 'folder', id: string, name: string) {
        if (!enableDeleteDialog) return;
        itemToDelete = { type, id, name };
        deleteModalOpen = true;
    }

    const folderFormAction = $derived(editingFolder ? '?/updateFolder' : '?/createFolder');
    const folderSubmitLabel = $derived(editingFolder ? 'Save' : 'Create');

    // Focus URL input when link modal opens
    $effect(() => {
        if (modalOpen && modalMode === 'link') {
            // Use setTimeout to ensure the DOM is updated after modal opens
            setTimeout(() => {
                const urlInput = document.querySelector('input[name="url"]') as HTMLInputElement;
                if (urlInput) {
                    urlInput.focus();
                    urlInput.select();
                }
            }, 0);
        }
    });
</script>

{#if modalOpen && modalMode === 'folder'}
    <Dialog
        open={modalOpen}
        onClose={closeModal}
        contentWidth="md"
        titleLevel="h3"
        title={editingFolder ? 'Edit folder' : 'Add folder'}
        footerFormId="ql-mgr-folder-form"
        cancelLabel="Cancel"
        submitLabel={folderSubmitLabel}
        submitting={formState.submitting}
    >
        <form
            id="ql-mgr-folder-form"
            method="post"
            action={folderFormAction}
            class="modal-form"
            use:enhance={() => {
                formState.start();
                return async ({ result, update }) => {
                    try {
                        await update();
                        if (result.type === 'redirect' || result.type === 'success') closeModal();
                    } finally {
                        formState.stop();
                    }
                };
            }}
        >
            {#if editingFolder}
                <input type="hidden" name="id" value={editingFolder.id} />
            {/if}
            <Label for="ql-mgr-folder-name">Folder name</Label>
            <Input
                id="ql-mgr-folder-name"
                name="name"
                bind:value={draftFolderName}
                placeholder="Folder name"
                required
            />
            {#if form?.error}
                <div class="modal-error">
                    <ErrorDetails status={400} message={form.error} errorId={form.errorId ?? undefined} />
                </div>
            {/if}
        </form>
    </Dialog>
{:else if modalOpen}
    <Dialog
        open={modalOpen}
        onClose={closeModal}
        contentWidth="md"
        titleLevel="h3"
        title={editing ? 'Edit link' : 'Add link'}
        footerFormId="ql-mgr-link-form"
        cancelLabel="Cancel"
        submitLabel={editing ? 'Save' : 'Add'}
        submitting={formState.submitting}
    >
        <form
            id="ql-mgr-link-form"
            method="post"
            action={editing ? '?/update' : '?/create'}
            class="modal-form"
            use:enhance={() => {
                formState.start();
                return async ({ result, update }) => {
                    try {
                        await update();
                        if (result.type === 'redirect' || result.type === 'success') closeModal();
                    } finally {
                        formState.stop();
                    }
                };
            }}
        >
            {#if editing}
                <input type="hidden" name="id" value={editing.id} />
            {/if}
            {#if !editing && addingToFolder}
                <input type="hidden" name="folderId" value={addingToFolder.id} />
            {/if}
            <Label for="ql-mgr-url">URL</Label>
            <Input id="ql-mgr-url" name="url" bind:value={draftUrl} placeholder="URL" required />
            <div>
                <Label for="ql-mgr-title">Title (optional)</Label>
                <Input
                    id="ql-mgr-title"
                    name="title"
                    bind:value={draftTitle}
                    placeholder={editing ? 'Link title' : draftUrl ? prettyHostname(draftUrl) : 'Link title'}
                />
            </div>
            <div>
                <Label for="ql-mgr-description">Description (optional)</Label>
                <Textarea id="ql-mgr-description" name="description" rows={2} bind:value={draftDescription} />
            </div>
            {#if form?.error}
                <div class="modal-error">
                    <ErrorDetails status={400} message={form.error} errorId={form.errorId ?? undefined} />
                </div>
            {/if}
        </form>
    </Dialog>
{/if}

{#if enableDeleteDialog && deleteModalOpen && itemToDelete}
    <Dialog
        open={deleteModalOpen}
        onClose={closeDeleteModal}
        contentWidth="md"
        titleLevel="h3"
        title={`Delete ${itemToDelete.type}`}
        footerFormId="ql-mgr-delete-form"
        cancelLabel="Cancel"
        submitLabel="Delete"
        submitVariant="destructive"
        submitting={formState.submitting}
    >
        <form
            id="ql-mgr-delete-form"
            method="post"
            action={itemToDelete.type === 'folder' ? '?/deleteFolder' : '?/delete'}
            class="modal-form"
            use:enhance={() => {
                formState.start();
                return async ({ result, update }) => {
                    try {
                        await update();
                        // Close on both redirect (link delete returns redirect) and
                        // success (folder delete returns { success: true }) so the
                        // dialog never sits open with stale state after delete.
                        if (result.type === 'redirect' || result.type === 'success') closeDeleteModal();
                    } finally {
                        formState.stop();
                    }
                };
            }}
        >
            <input type="hidden" name="id" value={itemToDelete.id} />
            <p>Are you sure you want to delete "{itemToDelete.name}"? This action cannot be undone.</p>
            {#if itemToDelete.type === 'folder' && links.some((link) => link.folderId === itemToDelete?.id)}
                <p style="color: var(--destructive); font-weight: 500;">Warning: This folder contains links that will also be deleted.</p>
            {/if}
        </form>
    </Dialog>
{/if}
