<script lang="ts">
    import type { QuickLink, QuickLinkFolder } from '$lib/types/enums';
    import { Plus, Folder, Edit, Trash2 } from 'lucide-svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Dialog from '$lib/components/ui/Dialog.svelte';
    import QuickLinksManageDialog from '$lib/components/dashboard/QuickLinksManageDialog.svelte';
    import QuickLinksGrid from '$lib/components/quick-links/QuickLinksGrid.svelte';
    import QuickLinkIcon from '$lib/components/quick-links/QuickLinkIcon.svelte';
    import ThreeDotsMenu from '$lib/components/ui/ThreeDotsMenu.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import { showErrorToast, showSuccessToast } from '$lib/stores/toast';

    type ActionForm = { error?: string; errorId?: string | null } | undefined;
    let {
        links,
        folders = [],
        form,
        actionBase = '/quick-links'
    }: { links: QuickLink[]; folders: QuickLinkFolder[]; form?: ActionForm; actionBase?: string } = $props();

    let qlDialog = $state<QuickLinksManageDialog | null>(null);
    let folderPopoverId = $state<string | null>(null);
    let draftFolderName = $state('');

    function prettyHostname(url: string): string {
        try {
            return new URL(url).hostname;
        } catch {
            return 'Link';
        }
    }

    function openAdd(folder?: QuickLinkFolder) {
        qlDialog?.openAddLink(folder ?? null);
    }
    function openEdit(link: QuickLink) {
        qlDialog?.openEditLink(link);
    }
    function openEditFolder(folder: QuickLinkFolder) {
        qlDialog?.openEditFolder(folder);
    }
    async function closeFolderDialog() {
        if (folderPopoverId) {
            const folder = folders.find((f) => f.id === folderPopoverId);
            if (folder && draftFolderName.trim() && draftFolderName !== folder.name) {
                await updateFolderName(folder.id, draftFolderName);
            }
        }
        folderPopoverId = null;
        draftFolderName = '';
    }

    async function moveToFolder(linkId: string, folderId: string | null) {
        const formData = new FormData();
        formData.set('linkId', linkId);
        if (folderId) formData.set('folderId', folderId);
        const response = await fetch(`${actionBase}?/moveToFolder`, { method: 'POST', body: formData });
        if (response.ok) {
            const { invalidateAll } = await import('$app/navigation');
            await invalidateAll();
            showSuccessToast('Link moved');
        } else {
            throw new Error('Failed to move link');
        }
    }

    async function reorderLinks(linkIds: string[]) {
        const formData = new FormData();
        for (const linkId of linkIds) formData.append('linkIds', linkId);
        const response = await fetch(`${actionBase}?/reorderLinks`, { method: 'POST', body: formData });
        if (response.ok) {
            const { invalidateAll } = await import('$app/navigation');
            await invalidateAll();
            showSuccessToast('Link order updated');
        } else {
            throw new Error('Failed to reorder links');
        }
    }

    async function reorderFolders(folderIds: string[]) {
        const formData = new FormData();
        for (const folderId of folderIds) formData.append('folderIds', folderId);
        const response = await fetch(`${actionBase}?/reorderFolders`, { method: 'POST', body: formData });
        if (response.ok) {
            const { invalidateAll } = await import('$app/navigation');
            await invalidateAll();
            showSuccessToast('Folder order updated');
        } else {
            throw new Error('Failed to reorder folders');
        }
    }

    async function createFolderFromLinks(activeId: string, targetId: string) {
        // Atomic — server uses a DynamoDB transaction so we never end up with
        // an empty orphan folder if a link reassignment fails.
        const formData = new FormData();
        formData.append('linkIds', activeId);
        formData.append('linkIds', targetId);
        formData.set('name', 'Untitled folder');
        const response = await fetch('?/createFolderFromLinks', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Failed to create folder');
        const { invalidateAll } = await import('$app/navigation');
        await invalidateAll();
        showSuccessToast('Folder created from links');
    }

    function handleDeleteFolder(folderId: string, folderName: string) {
        // Close the folder popover and route through the app's standard
        // QuickLinksManageDialog confirmation, matching every other delete
        // surface in the app instead of the browser's native confirm().
        void closeFolderDialog();
        qlDialog?.openDelete('folder', folderId, folderName);
    }

    async function updateFolderName(folderId: string, name: string) {
        const formData = new FormData();
        formData.set('id', folderId);
        formData.set('name', name);
        const response = await fetch(`${actionBase}?/updateFolder`, { method: 'POST', body: formData });
        if (response.ok) {
            const { invalidateAll } = await import('$app/navigation');
            await invalidateAll();
            showSuccessToast('Folder name updated');
        } else {
            showErrorToast('Failed to update folder name');
        }
    }
</script>

<QuickLinksGrid
    {links}
    {folders}
    size="compact"
    onOpenFolder={(folder) => {
        folderPopoverId = folder.id;
        draftFolderName = folder.name || '';
    }}
    onOpenAddLink={() => openAdd()}
    onOpenAddFolder={() => qlDialog?.openAddFolder()}
    onEditLink={openEdit}
    onEditFolder={openEditFolder}
    onDeleteLink={(link) => qlDialog?.openDelete('link', link.id, link.title || 'Link')}
    onDeleteFolder={(folder) => qlDialog?.openDelete('folder', folder.id, folder.name || 'Untitled folder')}
    onMoveToFolder={moveToFolder}
    onCreateFolderFromLinks={createFolderFromLinks}
    onReorderLinks={reorderLinks}
    onReorderFolders={reorderFolders}
/>

{#if folderPopoverId}
    {@const folder = folders.find((f) => f.id === folderPopoverId)}
    {@const folderLinks = links.filter((l) => l.folderId === folderPopoverId).sort((a, b) => a.order - b.order)}

    {#snippet folderHeader()}
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <Folder style="width: 16px; height: 16px; color: var(--lilac-d); flex-shrink: 0;" />
            <Input
                bind:value={draftFolderName}
                class="modal-title-input display"
                style="height: 32px; font-size: 18px; border: none; background: transparent; padding: 0;"
                placeholder="Folder name"
                aria-label="Folder name"
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
                        style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: var(--surface-2); border-radius: 8px;"
                    >
                        <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style="display: flex; align-items: center; gap: 12px; background: none; border: none; padding: 0; cursor: pointer; text-align: left; flex: 1; text-decoration: none; color: inherit;"
                        >
                            <div
                                style="width: 32px; height: 32px; background: var(--surface-3); display: flex; align-items: center; justify-content: center; border-radius: 8px; overflow: hidden;"
                            >
                                <QuickLinkIcon {link} size="sm" />
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 500; font-size: 14px;">{link.title || 'Link'}</span>
                                <span style="font-size: 12px; color: var(--ink-3);">{prettyHostname(link.url)}</span>
                            </div>
                        </a>
                        <div style="display: flex; gap: 4px;">
                            <Button variant="ghost" size="icon" onclick={() => openEdit(link)}>
                                <Edit size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="text-destructive"
                                onclick={() => qlDialog?.openDelete('link', link.id, link.title || 'Link')}
                            >
                                <Trash2 size={14} />
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

<QuickLinksManageDialog bind:this={qlDialog} {links} {form} />
