<script lang="ts">
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
        onDeleteFolder
    }: Props = $props();

    const tileSize = $derived(size === 'compact' ? 48 : 64);
    const gridMin = $derived(size === 'compact' ? 80 : 120);
    const gap = $derived(size === 'compact' ? 16 : 24);
    const labelSize = $derived(size === 'compact' ? 11 : 13);

    let brokenFavicons = $state<Set<string>>(new Set());
    let preloadedFavicons = $state<Set<string>>(new Set());

    const faviconCache = new Map<string, string>();
    const fallbackFaviconCache = new Map<string, string>();

    const rootLinks = $derived(
        links
            .filter((link) => !link.folderId)
            .slice()
            .sort((a, b) => a.order - b.order)
    );
    const visibleFolders = $derived(
        folders
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

<div class="ql-grid" style={`grid-template-columns: repeat(auto-fill, minmax(${gridMin}px, 1fr)); gap: ${gap}px;`}>
    {#each visibleFolders as folder (folder.id)}
        <div class="ql-item" data-kind="folder" data-id={folder.id} animate:flip>
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
                onclick={() => onOpenFolder?.(folder)}
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
        <div class="ql-item" data-kind="link" data-id={link.id} animate:flip>
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
                onclick={() => onOpenLink(link)}
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
</style>
