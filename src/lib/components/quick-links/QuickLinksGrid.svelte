<script lang="ts">
    import { onDestroy, untrack } from 'svelte';
    import { flip } from 'svelte/animate';
    import { Folder, Link2, Plus, Edit, Trash2 } from 'lucide-svelte';
    import ThreeDotsMenu from '$lib/components/ui/ThreeDotsMenu.svelte';
    import type { QuickLink, QuickLinkFolder } from '$lib/types/enums';
    import { isInternalDomain } from '$lib/utils/url';

    type Size = 'compact' | 'large';

    type Props = {
        links: QuickLink[];
        folders: QuickLinkFolder[];
        size: Size;
        // Optional click hook fired when a link tile is opened (for analytics
        // etc.). Navigation itself is handled natively by the <a> tag, so this
        // is no longer required for the link to actually open.
        onOpenLink?: (link: QuickLink) => void;
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
        pointerType: string;
        longPressTimer: ReturnType<typeof setTimeout> | null;
        cancelled: boolean;
        rafId: number | null;
        pendingX: number;
        pendingY: number;
    };

    // Drag-detection thresholds.
    // Touch uses long-press (time only) so a quick swipe still scrolls the
    // page natively. Mouse/pen uses displacement so accidental holds don't
    // block clicks.
    const TOUCH_LONG_PRESS_MS = 500;
    const POINTER_MOVE_THRESHOLD_PX = 8;
    const TOUCH_CANCEL_MOVE_PX = 12;

    let brokenFavicons = $state<Set<string>>(new Set());
    let preloadedFavicons = $state<Set<string>>(new Set());
    let dragState = $state<DragState | null>(null);
    let wasDragging = $state(false);
    let hoveredMergeId = $state<string | null>(null);
    let lastReorderTargetId: string | null = null;
    // Status text announced via aria-live when keyboard reordering happens.
    let liveStatus = $state('');

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
            if (isInternalDomain(h)) {
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
            if (isInternalDomain(h)) {
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

    // Honor OS-level reduce-motion preference for the FLIP reorder animation.
    let reducedMotion = $state(false);
    $effect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        const apply = () => {
            reducedMotion = mql.matches;
        };
        apply();
        mql.addEventListener('change', apply);
        return () => mql.removeEventListener('change', apply);
    });
    const flipDuration = $derived(reducedMotion ? 0 : 200);

    function enterDragMode() {
        if (!dragState || dragState.isDragging) return;
        dragState.isDragging = true;
        document.body.style.userSelect = 'none';
        // Block native page scroll while a drag is in progress so that touch
        // pointer-moves are routed to the drag, not the scroller.
        document.body.style.touchAction = 'none';
    }

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
            containerRect,
            pointerType: event.pointerType || 'mouse',
            longPressTimer: null,
            cancelled: false,
            rafId: null,
            pendingX: event.clientX,
            pendingY: event.clientY
        };

        // Touch only: arm a long-press timer. If the user pans before the
        // timer fires we cancel the drag candidate so the page can scroll
        // normally — this matches mobile-OS reorder behavior.
        if (dragState.pointerType === 'touch') {
            dragState.longPressTimer = setTimeout(() => {
                if (dragState && !dragState.cancelled && !dragState.isDragging) {
                    enterDragMode();
                }
            }, TOUCH_LONG_PRESS_MS);
        }

        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp, { passive: false });
        window.addEventListener('pointercancel', onPointerUp, { passive: false });
    }

    function onPointerMove(event: PointerEvent) {
        if (!dragState) return;

        if (dragState.isDragging) {
            event.preventDefault();
        }

        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!dragState.isDragging) {
            const isTouch = dragState.pointerType === 'touch';
            if (isTouch) {
                // Movement before long-press fires → user is scrolling, not dragging.
                if (distance > TOUCH_CANCEL_MOVE_PX) {
                    cancelDragCandidate();
                    return;
                }
                // Otherwise wait for the long-press timer.
                return;
            }
            // Mouse/pen: enter drag on small displacement.
            if (distance > POINTER_MOVE_THRESHOLD_PX) {
                enterDragMode();
            } else {
                return;
            }
        }

        // Throttle the expensive hit-testing work to one rAF tick.
        dragState.pendingX = event.clientX;
        dragState.pendingY = event.clientY;
        if (dragState.rafId == null) {
            dragState.rafId = requestAnimationFrame(processPointerMove);
        }
    }

    function processPointerMove() {
        if (!dragState || !dragState.isDragging) {
            if (dragState) dragState.rafId = null;
            return;
        }
        dragState.rafId = null;
        const x = dragState.pendingX;
        const y = dragState.pendingY;

        dragState.currentX = x;
        dragState.currentY = y;
        dragState.containerRect = gridContainer!.getBoundingClientRect();

        // Live reorder hit-testing.
        const items = Array.from(gridContainer!.querySelectorAll('.ql-item[data-id]')) as HTMLElement[];
        let bestTargetId: string | null = null;
        let bestMergeId: string | null = null;

        for (const el of items) {
            const rect = el.getBoundingClientRect();
            const id = el.getAttribute('data-id')!;
            const elKind = el.getAttribute('data-kind')!;

            if (id === dragState.id) continue;

            // Merge: link → link (create folder) or link → folder (move into).
            if (dragState.kind === 'link' && !(dragState.item as QuickLink).folderId) {
                const mergeThreshold = 20;
                const isInside =
                    x > rect.left + mergeThreshold &&
                    x < rect.right - mergeThreshold &&
                    y > rect.top + mergeThreshold &&
                    y < rect.bottom - mergeThreshold;

                if (isInside && (elKind === 'link' || elKind === 'folder')) {
                    bestMergeId = id;
                    break;
                }
            }

            // Reorder.
            if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
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

    function cancelDragCandidate() {
        if (!dragState) return;
        dragState.cancelled = true;
        if (dragState.longPressTimer != null) {
            clearTimeout(dragState.longPressTimer);
            dragState.longPressTimer = null;
        }
        if (dragState.rafId != null) {
            cancelAnimationFrame(dragState.rafId);
            dragState.rafId = null;
        }
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        dragState = null;
    }

    // ─── Keyboard reorder (WCAG 2.1.1 keyboard alternative for drag) ─────────
    // Alt+Arrow on a focused tile moves it through its sibling list. We use Alt
    // as the modifier so plain arrow-key navigation still moves browser focus
    // and selection in the surrounding page.
    async function onTileKeyDown(
        event: KeyboardEvent,
        item: QuickLink | QuickLinkFolder,
        kind: 'link' | 'folder'
    ) {
        if (!event.altKey) return;
        const direction =
            event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                ? -1
                : event.key === 'ArrowRight' || event.key === 'ArrowDown'
                  ? 1
                  : 0;
        if (direction === 0) return;
        event.preventDefault();
        event.stopPropagation();

        const list: { id: string }[] = kind === 'link' ? [...rootLinks] : [...visibleFolders];
        const idx = list.findIndex((i) => i.id === item.id);
        if (idx < 0) return;
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= list.length) {
            liveStatus = `${labelForItem(item, kind)} is already at the ${direction < 0 ? 'start' : 'end'} of the list.`;
            return;
        }
        const target = list[nextIdx];
        if (!target) return;
        const targetId = target.id;
        reorderLocally(item.id, targetId, kind);
        liveStatus = `${labelForItem(item, kind)} moved to position ${nextIdx + 1} of ${list.length}.`;

        try {
            if (kind === 'link') {
                await onReorderLinks(rootLinks.map((l) => l.id));
            } else {
                await onReorderFolders(visibleFolders.map((f) => f.id));
            }
        } catch (e) {
            console.error(e);
            liveStatus = 'Reorder failed. Please try again.';
        }
    }

    function labelForItem(item: QuickLink | QuickLinkFolder, kind: 'link' | 'folder') {
        if (kind === 'folder') return (item as QuickLinkFolder).name || 'Untitled folder';
        return labelFor(item as QuickLink);
    }

    function reorderLocally(activeId: string, targetId: string, kind: 'link' | 'folder') {
        if (kind === 'link') {
            const items = [...rootLinks];
            const activeIdx = items.findIndex((i) => i.id === activeId);
            const targetIdx = items.findIndex((i) => i.id === targetId);
            if (activeIdx !== -1 && targetIdx !== -1 && activeIdx !== targetIdx) {
                const [moved] = items.splice(activeIdx, 1);
                if (!moved) return;
                items.splice(targetIdx, 0, moved);
                const reordered = items.map((item, index) => ({ ...item, order: index }));
                localLinks = [...localLinks.filter((l) => l.folderId), ...reordered];
            }
        } else {
            const items = [...visibleFolders];
            const activeIdx = items.findIndex((i) => i.id === activeId);
            const targetIdx = items.findIndex((i) => i.id === targetId);
            if (activeIdx !== -1 && targetIdx !== -1 && activeIdx !== targetIdx) {
                const [moved] = items.splice(activeIdx, 1);
                if (!moved) return;
                items.splice(targetIdx, 0, moved);
                localFolders = items.map((item, index) => ({ ...item, order: index }));
            }
        }
    }

    async function onPointerUp() {
        if (!dragState) return;

        const { isDragging, id, kind, longPressTimer, rafId } = dragState;
        const mergeId = hoveredMergeId;

        if (longPressTimer != null) clearTimeout(longPressTimer);
        if (rafId != null) cancelAnimationFrame(rafId);

        if (isDragging) {
            wasDragging = true;
        }

        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('touch-action');

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
            document.body.style.removeProperty('user-select');
            document.body.style.removeProperty('touch-action');
        }
        if (dragState) {
            if (dragState.longPressTimer != null) clearTimeout(dragState.longPressTimer);
            if (dragState.rafId != null) cancelAnimationFrame(dragState.rafId);
        }
    });

    // Tracks link IDs whose favicon fetch is currently in-flight. Plain (non-reactive)
    // so changes to it do not re-trigger the $effect below.
    const _inFlight = new Set<string>();

    $effect(() => {
        // Only `links` is a reactive dependency here. preloadedFavicons and
        // brokenFavicons are read via untrack() so completing a preload does not
        // cause the effect to re-run and rebuild Image objects for all other links.
        const toProcess = links.filter(
            (link) =>
                !_inFlight.has(link.id) &&
                !untrack(() => preloadedFavicons.has(link.id) || brokenFavicons.has(link.id))
        );

        const imageEntries: { img: HTMLImageElement; id: string }[] = [];

        const preloadPromises = toProcess.map((link) => {
            _inFlight.add(link.id);
            const url = faviconForLink(link);
            if (!url) {
                _inFlight.delete(link.id);
                return Promise.resolve();
            }
            return new Promise<void>((resolve) => {
                const img = new Image();
                imageEntries.push({ img, id: link.id });
                img.onload = () => {
                    _inFlight.delete(link.id);
                    preloadedFavicons = new Set([...preloadedFavicons, link.id]);
                    resolve();
                };
                img.onerror = () => {
                    const fallbackUrl = getFallbackFavicon(link);
                    if (!fallbackUrl) {
                        _inFlight.delete(link.id);
                        brokenFavicons = new Set([...brokenFavicons, link.id]);
                        resolve();
                        return;
                    }
                    const fallbackImg = new Image();
                    imageEntries.push({ img: fallbackImg, id: link.id });
                    fallbackImg.onload = () => {
                        _inFlight.delete(link.id);
                        preloadedFavicons = new Set([...preloadedFavicons, link.id]);
                        resolve();
                    };
                    fallbackImg.onerror = () => {
                        _inFlight.delete(link.id);
                        brokenFavicons = new Set([...brokenFavicons, link.id]);
                        resolve();
                    };
                    fallbackImg.src = fallbackUrl;
                };
                img.src = url;
            });
        });

        void Promise.all(preloadPromises);

        return () => {
            for (const { img, id } of imageEntries) {
                img.src = '';
                img.onload = null;
                img.onerror = null;
                // Remove from in-flight so the link can be retried if links changes
                // while this preload was still pending.
                _inFlight.delete(id);
            }
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
            animate:flip={{ duration: flipDuration }}
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
                aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
                onpointerdown={(e) => onPointerDown(e, folder, 'folder')}
                onkeydown={(e) => onTileKeyDown(e, folder, 'folder')}
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
            animate:flip={{ duration: flipDuration }}
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
            <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                class="ql-button ql-button--link"
                draggable="false"
                aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
                ondragstart={(e) => e.preventDefault()}
                onpointerdown={(e) => onPointerDown(e, link, 'link')}
                onkeydown={(e) => onTileKeyDown(e, link, 'link')}
                onclick={(e) => {
                    if (wasDragging) {
                        // A drag just ended — suppress the synthetic click so
                        // the browser doesn't navigate after a reorder/merge.
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    // Otherwise let the native <a> handle navigation, which
                    // preserves middle-click and Cmd/Ctrl-click semantics.
                    onOpenLink?.(link);
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
                            draggable="false"
                            style={`width: ${size === 'compact' ? 24 : 32}px; height: ${size === 'compact' ? 24 : 32}px; object-fit: contain;`}
                        />
                    {/if}
                </div>
                <span class="ql-label" style={`font-size: ${labelSize}px;`}>{labelFor(link)}</span>
            </a>
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
<div class="ql-sr-status" role="status" aria-live="polite" aria-atomic="true">{liveStatus}</div>

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
    /* Visually-hidden screen-reader-only status region for keyboard reorder
       announcements. Following the standard sr-only pattern. */
    .ql-sr-status {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
    @media (prefers-reduced-motion: reduce) {
        .ql-item,
        .ql-button,
        .ql-ghost,
        .ql-item--merge-target .ql-icon {
            transition: none !important;
        }
        .ql-button:hover {
            transform: none;
        }
    }
    .ql-item {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
        /* Allow vertical pan (page scroll) on mobile; we toggle to "none"
           imperatively once a drag is detected so reorder still works. */
        touch-action: manipulation;
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
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }
    /* Anchor variant for external links — strip the default link styling so
       it matches the surrounding button-shaped tiles. */
    .ql-button--link {
        text-decoration: none;
        color: inherit;
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
        pointer-events: auto;
    }

    @media (hover: none) and (pointer: coarse) {
        .ql-item :global(.widget-item-menu-wrap) {
            opacity: 1;
            pointer-events: auto;
        }
    }
</style>
