<script lang="ts">
    import type { QuickLink, QuickLinkFolder } from '$lib/types/enums';
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import QuickLinksManageDialog from '$lib/components/dashboard/QuickLinksManageDialog.svelte';
    import QuickLinksGrid from '$lib/components/quick-links/QuickLinksGrid.svelte';
    import QuickLinkFolderDialog from '$lib/components/quick-links/QuickLinkFolderDialog.svelte';
    import { showErrorToast, showSuccessToast } from '$lib/stores/toast';
    import { getPageNumber } from '$lib/constants/navigation';
    import type { PageData } from './$types';

    let { data, form }: { data: PageData; form?: { error?: string; errorId?: string | null } } = $props();
    let qlDialog = $state<QuickLinksManageDialog | null>(null);
    let folderPopoverId = $state<string | null>(null);

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
            showSuccessToast('Link moved');
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
        showSuccessToast('Link order updated');
    }

    async function reorderFolders(folderIds: string[]) {
        const formData = new FormData();
        for (const folderId of folderIds) formData.append('folderIds', folderId);
        const response = await fetch('?/reorderFolders', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Failed to reorder folders');
        const { invalidateAll } = await import('$app/navigation');
        await invalidateAll();
        showSuccessToast('Folder order updated');
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
        const response = await fetch('?/updateFolder', { method: 'POST', body: formData });
        if (response.ok) {
            const { invalidateAll } = await import('$app/navigation');
            await invalidateAll();
            showSuccessToast('Folder name updated');
        } else {
            showErrorToast('Failed to update folder name');
        }
    }

    async function closeFolderDialog() {
        folderPopoverId = null;
    }
</script>

<PageHeader title="Quick links" sub="Access your most-used resources and documents." number={getPageNumber('/quick-links')} />

<QuickLinksGrid
    links={data.quickLinks}
    folders={data.quickLinkFolders}
    size="large"
    onOpenFolder={(folder) => {
        folderPopoverId = folder.id;
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
    {#if folder}
        <QuickLinkFolderDialog
            open={!!folderPopoverId}
            {folder}
            links={data.quickLinks}
            size="large"
            onClose={closeFolderDialog}
            onUpdateFolderName={updateFolderName}
            onDeleteFolder={(f) => handleDeleteFolder(f.id, f.name || 'Untitled folder')}
            onOpenAddLink={openAdd}
            onEditLink={openEditLink}
            onDeleteLink={(link) => openDelete('link', link.id, link.title || 'Link')}
            onMoveToRoot={(linkId) => moveToFolder(linkId, null)}
            onReorderLinks={reorderLinks}
        />
    {/if}
{/if}

<QuickLinksManageDialog bind:this={qlDialog} links={data.quickLinks} {form} />

