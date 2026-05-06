<script lang="ts">
    import { onDestroy } from 'svelte';
    import { flip } from 'svelte/animate';
    import { Folder, Link2, Plus, Edit, Trash2 } from 'lucide-svelte';
    import ThreeDotsMenu from '$lib/components/ui/ThreeDotsMenu.svelte';
    import type { QuickLink, QuickLinkFolder } from '$lib/types/enums';

    type Size = 'compact' | 'large';

    type Props = {
        links: QuickLink[];
        folders: QuickLinkFolder[];
        size: Size;
        onOpenLink: (link: QuickLink) => void;
        onOpenFolder?: (folder: QuickLinkFolder) => void;
        onOpenAddLink: () => void;
        onOpenAddFolder: () => void;
        onEditLink: (link: QuickLink) => void;
        onEditFolder: (folder: QuickLinkFolder) => void;
        onDeleteLink: (link: QuickLink) => void;
        onDeleteFolder: (folder: QuickLinkFolder) => void;
        onMoveToFolder: (linkId: string, folderId: string | null) => Promise<void>;
        onCreateFolderFromLinks: (activeId: string, targetId: string) => Promise<void>;
        onReorderLinks: (linkIds: string[]) => Promise<void>;
        onReorderFolders: (folderIds: string[]) => Promise<void>;
    };

    let {
        links,
        folders,
        size,
        onOpenLink,
        onOpenFolder,
        onOpenAddLink,
        onOpenAddFolder,
        onEditLink,
        onEditFolder,
        onDeleteLink,
        onDeleteFolder,
        onMoveToFolder,
        onCreateFolderFromLinks,
        onReorderLinks,
        onReorderFolders
    }: Props = $props();

    const tileSize = $derived(size === 'compact' ? 48 : 64);
    const gridMin = $derived(size === 'compact' ? 80 : 120);
    const gap = $derived(size === 'compact' ? 16 : 24);
    const labelSize = $derived(size === 'compact' ? 11 : 13);

    type DragState = {
        id: string;
        kind: 'link' | 'folder';
        item: QuickLink | QuickLinkFolder;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        offsetX: number;
        offsetY: number;
        width: number;
        height: number;
        startTime: number;
        isDragging: boolean;
        containerRect: DOMRect;
    };

    let brokenFavicons = $state<Set<string>>(new Set());
    let preloadedFavicons = $state<Set<string>>(new Set());
    let dragState = $state<DragState | null>(null);
    let wasDragging = $state(false);
    let hoveredMergeId = $state<string | null>(null);
    let lastReorderTargetId: string | null = null;

    const faviconCache = new Map<string, string>();
    const fallbackFaviconCache = new Map<string, string>();

    let localLinks = $state<QuickLink[]>([]);
    let localFolders = $state<QuickLinkFolder[]>([]);

    $effect(() => {
        localLinks = links;
        localFolders = folders;
    });

    const rootLinks = $derived(
        localLinks
            .filter((link) => !link.folderId)
            .slice()
            .sort((a, b) => a.order - b.order)
    );
    const visibleFolders = $derived(
        localFolders
            .slice()
            .sort((a, b) => a.order - b.order)
    );

    function prettyHostname(url: string): string {
        try {
            return new URL(url).hostname;
        } catch {
            return 'Link';
        }
    }

    function labelFor(link: QuickLink) {
        return link.title?.trim() ? link.title : prettyHostname(link.url);
    }

    function faviconForLink(link: QuickLink): string {
        if (link.faviconUrl) return link.faviconUrl;
        if (faviconCache.has(link.url)) return faviconCache.get(link.url) || '';
        try {
            const h = new URL(link.url).hostname;
            if (/^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(h)) {
                faviconCache.set(link.url, '');
                return '';
            }
            const faviconUrl = `https://${h}/favicon.ico`;
            faviconCache.set(link.url, faviconUrl);
            return faviconUrl;
        } catch {
            faviconCache.set(link.url, '');
            return '';
        }
    }

    function getFallbackFavicon(link: QuickLink): string {
        if (fallbackFaviconCache.has(link.url)) return fallbackFaviconCache.get(link.url) || '';
        try {
            const h = new URL(link.url).hostname;
            if (/^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(h)) {
                fallbackFaviconCache.set(link.url, '');
                return '';
            }
            const fallbackUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128`;
            fallbackFaviconCache.set(link.url, fallbackUrl);
            return fallbackUrl;
        } catch {
            fallbackFaviconCache.set(link.url, '');
            return '';
        }
    }

    let gridContainer = $state<HTMLElement | null>(null);

    function onPointerDown(event: PointerEvent, item: QuickLink | QuickLinkFolder, kind: 'link' | 'folder') {
        if (event.button !== 0) return;
        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const containerRect = gridContainer!.getBoundingClientRect();

        // Cleared here (not on a timer) so the next click is gated solely by
        // whether this pointer cycle crossed the drag threshold.
        wasDragging = false;

        dragState = {
            id: item.id,
            kind,
            item,
            startX: event.clientX,
            startY: event.clientY,
            currentX: event.clientX,
            currentY: event.clientY,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            width: rect.width,
            height: rect.height,
            startTime: Date.now(),
            isDragging: false,
            containerRect
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(event: PointerEvent) {
        if (!dragState) return;

        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!dragState.isDragging && (distance > 8 || Date.now() - dragState.startTime > 200)) {
            dragState.isDragging = true;
            document.body.style.userSelect = 'none';
        }

        if (dragState.isDragging) {
            dragState.currentX = event.clientX;
            dragState.currentY = event.clientY;
            dragState.containerRect = gridContainer!.getBoundingClientRect();

            // Handle live reordering
            const items = Array.from(gridContainer!.querySelectorAll('.ql-item[data-id]')) as HTMLElement[];
            let bestTargetId: string | null = null;
            let bestMergeId: string | null = null;

            for (const el of items) {
                const rect = el.getBoundingClientRect();
                const id = el.getAttribute('data-id')!;
                const kind = el.getAttribute('data-kind')!;

                if (id === dragState.id) continue;

                // Merge detection: Link onto Link (create folder) or Link onto Folder (move into)
                if (dragState.kind === 'link' && !dragState.item.folderId) {
                    const mergeThreshold = 20;
                    const isInside =
                        event.clientX > rect.left + mergeThreshold &&
                        event.clientX < rect.right - mergeThreshold &&
                        event.clientY > rect.top + mergeThreshold &&
                        event.clientY < rect.bottom - mergeThreshold;

                    if (isInside && (kind === 'link' || kind === 'folder')) {
                        bestMergeId = id;
                        break;
                    }
                }

                // Reorder detection
                if (
                    event.clientX > rect.left &&
                    event.clientX < rect.right &&
                    event.clientY > rect.top &&
                    event.clientY < rect.bottom
                ) {
                    bestTargetId = id;
                    break;
                }
            }

            hoveredMergeId = bestMergeId;

            if (bestTargetId && !bestMergeId) {
                if (bestTargetId !== lastReorderTargetId) {
                    lastReorderTargetId = bestTargetId;
                    reorderLocally(dragState.id, bestTargetId, dragState.kind);
                }
            } else {
                lastReorderTargetId = null;
            }
        }
    }

    function reorderLocally(activeId: string, targetId: string, kind: 'link' | 'folder') {
        if (kind === 'link') {
            const items = [...rootLinks];
            const activeIdx = items.findIndex((i) => i.id === activeId);
            const targetIdx = items.findIndex((i) => i.id === targetId);
            if (activeIdx !== -1 && targetIdx !== -1 && activeIdx !== targetIdx) {
                items.splice(targetIdx, 0, items.splice(activeIdx, 1)[0]);
                const reordered = items.map((item, index) => ({ ...item, order: index }));
                localLinks = [...localLinks.filter((l) => l.folderId), ...reordered];
            }
        } else {
            const items = [...visibleFolders];
            const activeIdx = items.findIndex((i) => i.id === activeId);
            const targetIdx = items.findIndex((i) => i.id === targetId);
            if (activeIdx !== -1 && targetIdx !== -1 && activeIdx !== targetIdx) {
                items.splice(targetIdx, 0, items.splice(activeIdx, 1)[0]);
                localFolders = items.map((item, index) => ({ ...item, order: index }));
            }
        }
    }

    async function onPointerUp() {
        if (!dragState) return;

        const { isDragging, id, kind } = dragState;
        const mergeId = hoveredMergeId;

        if (isDragging) {
            wasDragging = true;
        }

        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        document.body.style.removeProperty('user-select');

        if (isDragging) {
            if (mergeId && kind === 'link') {
                try {
                    const targetIsFolder = folders.some((f) => f.id === mergeId);
                    if (targetIsFolder) {
                        await onMoveToFolder(id, mergeId);
                    } else {
                        await onCreateFolderFromLinks(id, mergeId);
                    }
                } catch (e) {
                    console.error(e);
                }
            } else {
                // Commit reorder
                try {
                    if (kind === 'link') {
                        await onReorderLinks(rootLinks.map((l) => l.id));
                    } else {
                        await onReorderFolders(visibleFolders.map((f) => f.id));
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }

        dragState = null;
        hoveredMergeId = null;
        lastReorderTargetId = null;
    }

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
        }
    });

    $effect(() => {
        const imageElements: HTMLImageElement[] = [];
        const preloadPromises = links.map((link) => {
            if (preloadedFavicons.has(link.id) || brokenFavicons.has(link.id)) return Promise.resolve();
            const url = faviconForLink(link);
            if (!url) return Promise.resolve();
            return new Promise<void>((resolve) => {
                const img = new Image();
                imageElements.push(img);
                img.onload = () => {
                    const next = new Set(preloadedFavicons);
                    next.add(link.id);
                    preloadedFavicons = next;
                    resolve();
                };
                img.onerror = () => {
                    const fallbackUrl = getFallbackFavicon(link);
                    if (!fallbackUrl) {
                        const next = new Set(brokenFavicons);
                        next.add(link.id);
                        brokenFavicons = next;
                        resolve();
                        return;
                    }
                    const fallbackImg = new Image();
                    imageElements.push(fallbackImg);
                    fallbackImg.onload = () => {
                        const next = new Set(preloadedFavicons);
                        next.add(link.id);
                        preloadedFavicons = next;
                        resolve();
                    };
                    fallbackImg.onerror = () => {
                        const next = new Set(brokenFavicons);
                        next.add(link.id);
                        brokenFavicons = next;
                        resolve();
                    };
                    fallbackImg.src = fallbackUrl;
                };
                img.src = url;
            });
        });
        void Promise.all(preloadPromises);
        return () => {
            imageElements.forEach((img) => {
                img.src = '';
                img.onload = null;
                img.onerror = null;
            });
        };
    });
</script>

<div
    bind:this={gridContainer}
    class="ql-grid"
    style={`grid-template-columns: repeat(auto-fill, minmax(${gridMin}px, 1fr)); gap: ${gap}px;`}
>
    {#each visibleFolders as folder (folder.id)}
        <div
            class="ql-item {dragState?.id === folder.id ? 'ql-item--dragging-placeholder' : ''} {hoveredMergeId === folder.id
                ? 'ql-item--merge-target'
                : ''}"
            data-kind="folder"
            data-id={folder.id}
            animate:flip={{ duration: 200 }}
        >
            <div class="widget-item-menu-wrap" onclick={(e) => e.stopPropagation()} role="presentation">
                <div class="widget-item-menu-inner">
                    <ThreeDotsMenu
                        menuId={`ql-folder-${folder.id}`}
                        items={[
                            { label: 'Edit', icon: Edit, action: () => onEditFolder(folder) },
                            { label: 'Delete', icon: Trash2, variant: 'destructive', action: () => onDeleteFolder(folder) }
                        ]}
                    />
                </div>
            </div>
            <button
                type="button"
                class="ql-button"
                onpointerdown={(e) => onPointerDown(e, folder, 'folder')}
                onclick={(e) => {
                    if (wasDragging) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    onOpenFolder?.(folder);
                }}
            >
                <div class="ql-icon ql-icon--folder" style={`width: ${tileSize}px; height: ${tileSize}px;`}>
                    <Folder
                        style={`width: ${size === 'compact' ? 24 : 32}px; height: ${size === 'compact' ? 24 : 32}px; color: var(--lilac-d);`}
                    />
                </div>
                <span class="ql-label" style={`font-size: ${labelSize}px;`}>{folder.name || 'Untitled'}</span>
            </button>
        </div>
    {/each}

    {#each rootLinks as link (link.id)}
        <div
            class="ql-item {dragState?.id === link.id ? 'ql-item--dragging-placeholder' : ''} {hoveredMergeId === link.id ? 'ql-item--merge-target' : ''}"
            data-kind="link"
            data-id={link.id}
            animate:flip={{ duration: 200 }}
        >
            <div class="widget-item-menu-wrap" onclick={(e) => e.stopPropagation()} role="presentation">
                <div class="widget-item-menu-inner">
                    <ThreeDotsMenu
                        menuId={`ql-link-${link.id}`}
                        items={[
                            { label: 'Edit', icon: Edit, action: () => onEditLink(link) },
                            { label: 'Delete', icon: Trash2, variant: 'destructive', action: () => onDeleteLink(link) }
                        ]}
                    />
                </div>
            </div>
            <button
                type="button"
                class="ql-button"
                onpointerdown={(e) => onPointerDown(e, link, 'link')}
                onclick={(e) => {
                    if (wasDragging) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    onOpenLink(link);
                }}
            >
                <div class="ql-icon ql-icon--link" style={`width: ${tileSize}px; height: ${tileSize}px;`}>
                    {#if brokenFavicons.has(link.id) || !(link.faviconUrl || preloadedFavicons.has(link.id))}
                        <Link2
                            style={`width: ${size === 'compact' ? 24 : 32}px; height: ${size === 'compact' ? 24 : 32}px; color: var(--ink-3);`}
                        />
                    {:else}
                        <img
                            src={faviconForLink(link)}
                            alt=""
                            style={`width: ${size === 'compact' ? 24 : 32}px; height: ${size === 'compact' ? 24 : 32}px; object-fit: contain;`}
                        />
                    {/if}
                </div>
                <span class="ql-label" style={`font-size: ${labelSize}px;`}>{labelFor(link)}</span>
            </button>
        </div>
    {/each}

    <button type="button" class="ql-item ql-button" onclick={onOpenAddLink}>
        <div class="ql-icon ql-icon--add-link" style={`width: ${tileSize}px; height: ${tileSize}px;`}>
            <Plus style={`width: ${size === 'compact' ? 24 : 32}px; height: ${size === 'compact' ? 24 : 32}px; color: var(--ink-4);`} />
        </div>
        <span class="ql-label ql-label--muted" style={`font-size: ${labelSize}px;`}>Add link</span>
    </button>

    <button type="button" class="ql-item ql-button" onclick={onOpenAddFolder}>
        <div class="ql-icon ql-icon--add-folder" style={`width: ${tileSize}px; height: ${tileSize}px;`}>
            <Folder style={`width: ${size === 'compact' ? 24 : 32}px; height: ${size === 'compact' ? 24 : 32}px; color: var(--lilac-d);`} />
        </div>
        <span class="ql-label ql-label--folder" style={`font-size: ${labelSize}px;`}>Add folder</span>
    </button>
</div>

{#if dragState && dragState.isDragging}
    {@const item = dragState.item}
    {@const clampedX = Math.max(
        dragState.containerRect.left,
        Math.min(dragState.currentX - dragState.offsetX, dragState.containerRect.right - dragState.width)
    )}
    {@const clampedY = Math.max(
        dragState.containerRect.top,
        Math.min(dragState.currentY - dragState.offsetY, dragState.containerRect.bottom - dragState.height)
    )}
    <div
        class="ql-ghost"
        style={`
            left: ${clampedX}px;
            top: ${clampedY}px;
            width: ${dragState.width}px;
            height: ${dragState.height}px;
        `}
    >
        <div class="ql-icon {dragState.kind === 'folder' ? 'ql-icon--folder' : 'ql-icon--link'}" style={`width: ${tileSize}px; height: ${tileSize}px;`}>
            {#if dragState.kind === 'folder'}
                <Folder
                    style={`width: ${size === 'compact' ? 24 : 32}px; height: ${size === 'compact' ? 24 : 32}px; color: var(--lilac-d);`}
                />
            {:else}
                {@const link = item as QuickLink}
                {#if brokenFavicons.has(link.id) || !(link.faviconUrl || preloadedFavicons.has(link.id))}
                    <Link2
                        style={`width: ${size === 'compact' ? 24 : 32}px; height: ${size === 'compact' ? 24 : 32}px; color: var(--ink-3);`}
                    />
                {:else}
                    <img
                        src={faviconForLink(link)}
                        alt=""
                        style={`width: ${size === 'compact' ? 24 : 32}px; height: ${size === 'compact' ? 24 : 32}px; object-fit: contain;`}
                    />
                {/if}
            {/if}
        </div>
        <span class="ql-label" style={`font-size: ${labelSize}px;`}>
            {dragState.kind === 'folder' ? (item as QuickLinkFolder).name || 'Untitled' : labelFor(item as QuickLink)}
        </span>
    </div>
{/if}

<style>
    .ql-grid {
        display: grid;
        align-items: start;
        position: relative;
        padding: 12px 0;
    }
    .ql-item {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }
    .ql-item--dragging-placeholder {
        opacity: 0.2;
    }
    .ql-item--merge-target .ql-icon {
        background: var(--lilac-light) !important;
        border-color: var(--lilac-d) !important;
        transform: scale(1.1);
        transition: transform 0.2s ease, background 0.2s ease;
    }
    .ql-ghost {
        position: fixed;
        z-index: 1000;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        opacity: 0.9;
        filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15));
        transition: transform 0.1s ease-out;
    }
    .ql-button {
        cursor: pointer;
        background: none;
        border: none;
        padding: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }
    .ql-button:hover {
        transform: translateY(-2px);
    }
    .ql-button:hover .ql-icon--folder {
        background: var(--lilac-light);
    }
    .ql-button:hover .ql-icon--link {
        background: var(--surface-3);
    }
    .ql-button:hover .ql-icon--add-link,
    .ql-button:hover .ql-icon--add-folder {
        background: var(--surface-4);
        border-color: var(--ink-3);
    }
    .ql-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
    }
    .ql-icon--folder,
    .ql-icon--add-folder {
        background: var(--lilac);
        border: 1px solid var(--lilac-d);
    }
    .ql-icon--link {
        background: var(--surface-2);
        border: 1px solid var(--hairline);
    }
    .ql-icon--add-link {
        background: var(--surface-3);
        border: 1px dashed var(--hairline);
    }
    .ql-label {
        text-align: center;
        font-weight: 500;
    }
    .ql-label--muted {
        color: var(--ink-3);
    }
    .ql-label--folder {
        color: var(--lilac-d);
    }

    .ql-item:hover :global(.widget-item-menu-wrap),
    .ql-item:focus-within :global(.widget-item-menu-wrap) {
        opacity: 1;
    }

    @media (hover: none) and (pointer: coarse) {
        .ql-item :global(.widget-item-menu-wrap) {
            opacity: 1;
        }
    }
</style>
