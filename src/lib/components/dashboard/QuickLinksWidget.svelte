<script lang="ts">
    import type { QuickLink, QuickLinkFolder } from '$lib/types/enums';
    import { Plus, Folder, Edit, Trash2, Link2 } from 'lucide-svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Dialog from '$lib/components/ui/Dialog.svelte';
    import QuickLinksManageDialog from '$lib/components/dashboard/QuickLinksManageDialog.svelte';
    import QuickLinksGrid from '$lib/components/quick-links/QuickLinksGrid.svelte';
    import ThreeDotsMenu from '$lib/components/ui/ThreeDotsMenu.svelte';

    type ActionForm = { error?: string; errorId?: string | null } | undefined;
    let { links, folders = [], form }: { links: QuickLink[]; folders: QuickLinkFolder[]; form?: ActionForm } = $props();

    let qlDialog = $state<QuickLinksManageDialog | null>(null);
    let folderPopoverId = $state<string | null>(null);

    function openAdd(folder?: QuickLinkFolder) {
        qlDialog?.openAddLink(folder ?? null);
    }
    function openEdit(link: QuickLink) {
        qlDialog?.openEditLink(link);
    }
    function openEditFolder(folder: QuickLinkFolder) {
        qlDialog?.openEditFolder(folder);
    }
    function closeFolderDialog() {
        folderPopoverId = null;
    }
    function toggleFolderPopover(folderId: string, e: Event) {
        e.preventDefault();
        e.stopPropagation();
        folderPopoverId = folderPopoverId === folderId ? null : folderId;
    }

    async function moveToFolder(linkId: string, folderId: string | null) {
        const formData = new FormData();
        formData.append('linkId', linkId);
        if (folderId) formData.append('folderId', folderId);
        const response = await fetch('?/moveToFolder', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Failed to move link');
    }

    async function reorderLinks(linkIds: string[]) {
        const formData = new FormData();
        for (const linkId of linkIds) formData.append('linkIds', linkId);
        const response = await fetch('?/reorderLinks', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Failed to reorder links');
    }

    async function reorderFolders(folderIds: string[]) {
        const formData = new FormData();
        for (const folderId of folderIds) formData.append('folderIds', folderId);
        const response = await fetch('?/reorderFolders', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Failed to reorder folders');
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
        const { invalidateAll } = await import('$app/navigation');
        await invalidateAll();
    }
</script>

<QuickLinksGrid
    {links}
    {folders}
    size="compact"
    onOpenLink={(link) => window.open(link.url, '_blank', 'noopener,noreferrer')}
    onOpenFolder={(folder) => {
        folderPopoverId = folder.id;
    }}
    onOpenAddLink={() => openAdd()}
    onOpenAddFolder={() => qlDialog?.openAddFolder()}
    onEditLink={openEdit}
    onEditFolder={openEditFolder}
    onDeleteLink={(link) => qlDialog?.openDelete('link', link.id, link.title || 'Link')}
    onDeleteFolder={(folder) => qlDialog?.openDelete('folder', folder.id, folder.name || 'Untitled folder')}
    onCreateFolderFromLinks={createFolderFromLinks}
    onReorderLinks={reorderLinks}
    onReorderFolders={reorderFolders}
/>

{#if folderPopoverId}
    {@const folder = folders.find((f) => f.id === folderPopoverId)}
    {@const folderLinks = links.filter((l) => l.folderId === folderPopoverId).sort((a, b) => a.order - b.order)}
    <Dialog
        open={!!folderPopoverId}
        onClose={closeFolderDialog}
        contentWidth="md"
        ariaLabel={folder?.name ? `Folder ${folder.name}` : 'Folder'}
        titleLevel="h3"
    >
        <div style="display: flex; gap: 12px; flex-direction: column;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <Folder style="width: 16px; height: 16px; color: var(--lilac-d);" />
                    <h3 class="display" style="font-size: 20px; margin: 0;">{folder?.name || 'Untitled Folder'}</h3>
                </div>
                <div style="display: flex; gap: 8px;">
                    <Button variant="ghost" size="icon" onclick={() => folder && openEditFolder(folder)}>
                        <Edit size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        class="text-destructive"
                        onclick={() => folder && qlDialog?.openDelete('folder', folder.id, folder.name || 'Untitled folder')}
                    >
                        <Trash2 size={16} />
                    </Button>
                </div>
            </div>

            <div class="folder-links-grid" style="display: grid; grid-template-columns: 1fr; gap: 8px;">
                {#each folderLinks as link (link.id)}
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: var(--surface-2); border-radius: 8px;">
                        <button
                            type="button"
                            style="display: flex; align-items: center; gap: 12px; background: none; border: none; padding: 0; cursor: pointer; text-align: left; flex: 1;"
                            onclick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                        >
                            <div style="width: 32px; height: 32px; background: var(--surface-3); display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                                <Link2 size={16} class="text-muted-foreground" />
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 500; font-size: 14px;">{link.title || 'Link'}</span>
                                <span style="font-size: 12px; color: var(--ink-3);">{new URL(link.url).hostname}</span>
                            </div>
                        </button>
                        <div style="display: flex; gap: 4px;">
                            <Button variant="ghost" size="icon" onclick={() => openEdit(link)}>
                                <Edit size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" class="text-destructive" onclick={() => qlDialog?.openDelete('link', link.id, link.title || 'Link')}>
                                <Trash2 size={14} />
                            </Button>
                        </div>
                    </div>
                {/each}
            </div>

            <Button variant="outline" style="width: 100%;" onclick={() => folder && openAdd(folder)}>
                <Plus size={16} style="margin-right: 8px;" /> Add link to folder
            </Button>
        </div>
    </Dialog>
{/if}

<QuickLinksManageDialog bind:this={qlDialog} {links} {form} />
