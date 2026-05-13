<script lang="ts">
    import Folder from "lucide-svelte/icons/folder";
    import Trash2 from "lucide-svelte/icons/trash-2";;
    import Dialog from '$lib/components/ui/Dialog.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import ThreeDotsMenu from '$lib/components/ui/ThreeDotsMenu.svelte';
    import QuickLinksGrid from '$lib/components/quick-links/QuickLinksGrid.svelte';
    import type { QuickLink, QuickLinkFolder } from '$lib/types/enums';

    type Props = {
        open: boolean;
        folder: QuickLinkFolder;
        links: QuickLink[];
        size: 'compact' | 'large';
        onClose: () => void;
        onUpdateFolderName: (folderId: string, name: string) => Promise<void>;
        onDeleteFolder: (folder: QuickLinkFolder) => void;
        onOpenAddLink: (folder: QuickLinkFolder) => void;
        onEditLink: (link: QuickLink) => void;
        onDeleteLink: (link: QuickLink) => void;
        onMoveToRoot: (linkId: string) => Promise<void>;
        onReorderLinks: (linkIds: string[]) => Promise<void>;
    };

    let {
        open,
        folder,
        links,
        size,
        onClose,
        onUpdateFolderName,
        onDeleteFolder,
        onOpenAddLink,
        onEditLink,
        onDeleteLink,
        onMoveToRoot,
        onReorderLinks
    }: Props = $props();

    let draftFolderName = $state('');

    $effect(() => {
        if (open) {
            draftFolderName = folder.name || '';
        }
    });

    async function handleClose() {
        if (draftFolderName.trim() && draftFolderName !== folder.name) {
            await onUpdateFolderName(folder.id, draftFolderName);
        }
        onClose();
    }

    const folderLinks = $derived(links.filter((l) => l.folderId === folder.id));
</script>

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
                action: () => onDeleteFolder(folder)
            }
        ]}
    />
{/snippet}

<Dialog
    {open}
    onClose={handleClose}
    contentWidth="md"
    header={folderHeader}
    headerActions={folderHeaderActions}
    ariaLabel={folder.name ? `Folder ${folder.name}` : 'Folder'}
>
    <div class="folder-content">
        <QuickLinksGrid
            links={folderLinks}
            folders={[]}
            {size}
            showAllLinks={true}
            hideAddFolder={true}
            disableMerging={true}
            onOpenAddLink={() => onOpenAddLink(folder)}
            onOpenAddFolder={() => {}}
            {onEditLink}
            onEditFolder={() => {}}
            {onDeleteLink}
            onDeleteFolder={() => {}}
            onMoveToFolder={async () => {}}
            onCreateFolderFromLinks={async () => {}}
            {onReorderLinks}
            onReorderFolders={async () => {}}
            {onMoveToRoot}
        />
    </div>
</Dialog>

<style>
    .folder-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
</style>
