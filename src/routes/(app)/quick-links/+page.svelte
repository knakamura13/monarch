<script lang="ts">
    import type { QuickLink, QuickLinkFolder } from '$lib/types/enums';
    import { Folder, Plus, Edit, Trash2, Link2 } from 'lucide-svelte';
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import QuickLinksManageDialog from '$lib/components/dashboard/QuickLinksManageDialog.svelte';
    import QuickLinksGrid from '$lib/components/quick-links/QuickLinksGrid.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Dialog from '$lib/components/ui/Dialog.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import ThreeDotsMenu from '$lib/components/ui/ThreeDotsMenu.svelte';
    import { showSuccessToast, showErrorToast } from '$lib/stores/toast';
    import { getPageNumber } from '$lib/constants/navigation';
    import type { PageData } from './$types';

    let { data, form }: { data: PageData; form?: { error?: string; errorId?: string | null } } = $props();
    let qlDialog = $state<QuickLinksManageDialog | null>(null);
    let folderPopoverId = $state<string | null>(null);
    let draftFolderName = $state('');

    function openAdd(folder?: QuickLinkFolder) {
        qlDialog?.openAddLink(folder ?? null);
    }
    function openEditLink(link: QuickLink) {
        qlDialog?.openEditLink(link);
    }
    function openEditFolder(folder: QuickLinkFolder) {
        qlDialog?.openEditFolder(folder);
    }
    function openDelete(type: 'link' | 'folder', id: string, name: string) {
        qlDialog?.openDelete(type, id, name);
    }

    async function moveToFolder(linkId: string, folderId: string | null) {
        const formData = new FormData();
        formData.set('linkId', linkId);
        if (folderId) formData.set('folderId', folderId);
        const response = await fetch('?/moveToFolder', { method: 'POST', body: formData });
        if (response.ok) {
            const { invalidateAll } = await import('$app/navigation');
            await invalidateAll();
        } else {
            throw new Error('Failed to move link');
        }
    }

    async function reorderLinks(linkIds: string[]) {
        const formData = new FormData();
        for (const linkId of linkIds) formData.append('linkIds', linkId);
        const response = await fetch('?/reorderLinks', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Failed to reorder links');
        const { invalidateAll } = await import('$app/navigation');
        await invalidateAll();
    }

    async function reorderFolders(folderIds: string[]) {
        const formData = new FormData();
        for (const folderId of folderIds) formData.append('folderIds', folderId);
        const response = await fetch('?/reorderFolders', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Failed to reorder folders');
        const { invalidateAll } = await import('$app/navigation');
        await invalidateAll();
    }

    async function createFolderFromLinks(activeId: string, targetId: string) {
        const response = await fetch('/dashboard/api/quick-link-folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Untitled folder' })
        });
        if (!response.ok) throw new Error('Failed to create folder');
        const folder = await response.json();
        if (!folder?.id) throw new Error('Failed to create folder');
        await Promise.all([moveToFolder(activeId, folder.id), moveToFolder(targetId, folder.id)]);
        // Invalidate to refresh the UI
        const { invalidateAll } = await import('$app/navigation');
        await invalidateAll();
    }

    async function handleDeleteFolder(folderId: string, folderName: string) {
        const confirmed = confirm(`Are you sure you want to delete "${folderName}"? This will also delete all links inside.`);
        if (!confirmed) return;

        void closeFolderDialog();
        try {
            const formData = new FormData();
            formData.set('id', folderId);
            const response = await fetch('?/deleteFolder', { method: 'POST', body: formData });
            if (response.ok) {
                showSuccessToast('Folder deleted');
                const { invalidateAll } = await import('$app/navigation');
                await invalidateAll();
            } else {
                showErrorToast('Failed to delete folder');
            }
        } catch (e) {
            showErrorToast('Failed to delete folder');
        }
    }

    async function updateFolderName(folderId: string, name: string) {
        const formData = new FormData();
        formData.set('id', folderId);
        formData.set('name', name);
        const response = await fetch('?/updateFolder', { method: 'POST', body: formData });
        if (response.ok) {
            const { invalidateAll } = await import('$app/navigation');
            await invalidateAll();
        } else {
            showErrorToast('Failed to update folder name');
        }
    }

    async function closeFolderDialog() {
        if (folderPopoverId) {
            const folder = data.quickLinkFolders.find((f) => f.id === folderPopoverId);
            if (folder && draftFolderName.trim() && draftFolderName !== folder.name) {
                await updateFolderName(folder.id, draftFolderName);
            }
        }
        folderPopoverId = null;
        draftFolderName = '';
    }
</script>

<PageHeader title="Quick links" sub="Access your most-used resources and documents." number={getPageNumber('/quick-links')} />

<QuickLinksGrid
    links={data.quickLinks}
    folders={data.quickLinkFolders}
    size="large"
    onOpenLink={(link) => window.open(link.url, '_blank', 'noopener,noreferrer')}
    onOpenFolder={(folder) => {
        folderPopoverId = folder.id;
        draftFolderName = folder.name || '';
    }}
    onOpenAddLink={() => openAdd()}
    onOpenAddFolder={() => qlDialog?.openAddFolder()}
    onEditLink={openEditLink}
    onEditFolder={openEditFolder}
    onDeleteLink={(link) => openDelete('link', link.id, link.title || 'Link')}
    onDeleteFolder={(folder) => openDelete('folder', folder.id, folder.name || 'Untitled folder')}
    onMoveToFolder={moveToFolder}
    onCreateFolderFromLinks={createFolderFromLinks}
    onReorderLinks={reorderLinks}
    onReorderFolders={reorderFolders}
/>

{#if folderPopoverId}
    {@const folder = data.quickLinkFolders.find((f) => f.id === folderPopoverId)}
    {@const folderLinks = data.quickLinks.filter((l) => l.folderId === folderPopoverId).sort((a, b) => a.order - b.order)}

    {#snippet folderHeader()}
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <Folder style="width: 16px; height: 16px; color: var(--lilac-d); flex-shrink: 0;" />
            <Input
                bind:value={draftFolderName}
                class="modal-title-input display"
                style="height: 32px; font-size: 18px; border: none; background: transparent; padding: 0;"
                placeholder="Folder name"
            />
        </div>
    {/snippet}

    {#snippet folderHeaderActions()}
        <ThreeDotsMenu
            menuId="folder-options"
            items={[
                {
                    label: 'Delete',
                    icon: Trash2,
                    variant: 'destructive',
                    action: () => folder && handleDeleteFolder(folder.id, folder.name || 'Untitled folder')
                }
            ]}
        />
    {/snippet}

    <Dialog
        open={!!folderPopoverId}
        onClose={closeFolderDialog}
        contentWidth="md"
        header={folderHeader}
        headerActions={folderHeaderActions}
        ariaLabel={folder?.name ? `Folder ${folder.name}` : 'Folder'}
    >
        <div style="display: flex; gap: 12px; flex-direction: column;">
            <div class="folder-links-grid" style="display: grid; grid-template-columns: 1fr; gap: 8px;">
                {#each folderLinks as link (link.id)}
                    <div
                        style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--surface-2); border-radius: 12px;"
                    >
                        <button
                            type="button"
                            style="display: flex; align-items: center; gap: 12px; background: none; border: none; padding: 0; cursor: pointer; text-align: left; flex: 1;"
                            onclick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                        >
                            <div
                                style="width: 40px; height: 40px; background: var(--surface-3); display: flex; align-items: center; justify-content: center; border-radius: 10px;"
                            >
                                <Link2 size={20} class="text-muted-foreground" />
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 500; font-size: 15px;">{link.title || 'Link'}</span>
                                <span style="font-size: 13px; color: var(--ink-3);">{new URL(link.url).hostname}</span>
                            </div>
                        </button>
                        <div style="display: flex; gap: 4px;">
                            <Button variant="ghost" size="icon" onclick={() => openEditLink(link)}>
                                <Edit size={16} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="text-destructive"
                                onclick={() => openDelete('link', link.id, link.title || 'Link')}
                            >
                                <Trash2 size={16} />
                            </Button>
                        </div>
                    </div>
                {/each}
            </div>

            <Button variant="outline" style="width: 100%;" onclick={() => folder && openAdd(folder)}>
                <Plus size={16} style="margin-right: 8px;" /> Add link
            </Button>
        </div>
    </Dialog>
{/if}

<QuickLinksManageDialog bind:this={qlDialog} links={data.quickLinks} {form} />
