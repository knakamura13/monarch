<script lang="ts">
    import type { QuickLink, QuickLinkFolder } from '$lib/types/enums';
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import QuickLinksManageDialog from '$lib/components/dashboard/QuickLinksManageDialog.svelte';
    import QuickLinksGrid from '$lib/components/quick-links/QuickLinksGrid.svelte';
    import { getPageNumber } from '$lib/constants/navigation';
    import type { PageData } from './$types';

    let { data, form }: { data: PageData; form?: { error?: string; errorId?: string | null } } = $props();
    let qlDialog = $state<QuickLinksManageDialog | null>(null);

    function openAdd() {
        qlDialog?.openAddLink();
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
        // Invalidate to refresh the UI
        const { invalidateAll } = await import('$app/navigation');
        await invalidateAll();
    }
</script>

<PageHeader title="Quick links" sub="Access your most-used resources and documents." number={getPageNumber('/quick-links')} />

<QuickLinksGrid
    links={data.quickLinks}
    folders={data.quickLinkFolders}
    size="large"
    onOpenLink={(link) => window.open(link.url, '_blank', 'noopener,noreferrer')}
    onOpenAddLink={openAdd}
    onOpenAddFolder={() => qlDialog?.openAddFolder()}
    onEditLink={openEditLink}
    onEditFolder={openEditFolder}
    onDeleteLink={(link) => openDelete('link', link.id, link.title || 'Link')}
    onDeleteFolder={(folder) => openDelete('folder', folder.id, folder.name || 'Untitled folder')}
    onCreateFolderFromLinks={createFolderFromLinks}
    onReorderLinks={reorderLinks}
    onReorderFolders={reorderFolders}
/>

<QuickLinksManageDialog bind:this={qlDialog} links={data.quickLinks} {form} />
