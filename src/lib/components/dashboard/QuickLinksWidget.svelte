<script lang="ts">
    import type { QuickLink, QuickLinkFolder } from '$lib/types/enums';
    import QuickLinksManageDialog from '$lib/components/dashboard/QuickLinksManageDialog.svelte';
    import QuickLinksGrid from '$lib/components/quick-links/QuickLinksGrid.svelte';
    import QuickLinkFolderDialog from '$lib/components/quick-links/QuickLinkFolderDialog.svelte';
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
        folderPopoverId = null;
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
    {#if folder}
        <QuickLinkFolderDialog
            open={!!folderPopoverId}
            {folder}
            {links}
            size="compact"
            onClose={closeFolderDialog}
            onUpdateFolderName={updateFolderName}
            onDeleteFolder={(f) => handleDeleteFolder(f.id, f.name || 'Untitled folder')}
            onOpenAddLink={openAdd}
            onEditLink={openEdit}
            onDeleteLink={(link) => qlDialog?.openDelete('link', link.id, link.title || 'Link')}
            onMoveToRoot={(linkId) => moveToFolder(linkId, null)}
            onReorderLinks={reorderLinks}
        />
    {/if}
{/if}

<QuickLinksManageDialog bind:this={qlDialog} {links} {form} />

