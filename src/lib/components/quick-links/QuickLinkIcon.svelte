<script lang="ts">
    import type { QuickLink } from '$lib/types/enums';
    import { getAccentColor } from '$lib/utils/colors';
    import { isInternalDomain } from '$lib/utils/url';

    type Props = {
        link: QuickLink;
        size?: 'sm' | 'md' | 'lg';
    };

    let { link, size = 'md' }: Props = $props();

    const pixelSize = $derived(size === 'sm' ? 16 : size === 'md' ? 24 : 32);
    const fontSize = $derived(size === 'sm' ? 12 : size === 'md' ? 16 : 24);

    let brokenFavicon = $state(false);
    let preloaded = $state(false);

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

    function getLetter(link: QuickLink): string {
        const label = labelFor(link);
        return label.charAt(0).toUpperCase();
    }

    function faviconForLink(link: QuickLink): string | null {
        if (link.faviconUrl) return link.faviconUrl;
        try {
            const h = new URL(link.url).hostname;
            if (isInternalDomain(h)) return null;
            return `https://${h}/favicon.ico`;
        } catch {
            return null;
        }
    }

    function getFallbackFavicon(link: QuickLink): string | null {
        try {
            const h = new URL(link.url).hostname;
            if (isInternalDomain(h)) return null;
            return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128&default=404`;
        } catch {
            return null;
        }
    }

    $effect(() => {
        const url = faviconForLink(link);
        if (!url) {
            brokenFavicon = true;
            return;
        }

        const img = new Image();
        img.onload = () => {
            preloaded = true;
        };
        img.onerror = () => {
            const fallbackUrl = getFallbackFavicon(link);
            if (!fallbackUrl) {
                brokenFavicon = true;
                return;
            }
            const fallbackImg = new Image();
            fallbackImg.onload = () => {
                preloaded = true;
                // Update primary URL in cache? Not really possible here.
                // We'll just rely on this component's state.
            };
            fallbackImg.onerror = () => {
                brokenFavicon = true;
            };
            fallbackImg.src = fallbackUrl;
        };
        img.src = url;

        return () => {
            img.src = '';
            img.onload = null;
            img.onerror = null;
        };
    });

    const iconColor = $derived(getAccentColor(prettyHostname(link.url)));
</script>

<div
    class="ql-icon-container"
    style={`width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: inherit; overflow: hidden;`}
>
    {#if preloaded && !brokenFavicon}
        <img
            src={faviconForLink(link)}
            alt=""
            draggable="false"
            style={`width: ${pixelSize}px; height: ${pixelSize}px; object-fit: contain;`}
            onerror={() => (brokenFavicon = true)}
        />
    {:else}
        <div
            class="ql-letter-icon"
            style={`background: ${iconColor.bg}; color: ${iconColor.text}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 600; font-size: ${fontSize}px;`}
        >
            {getLetter(link)}
        </div>
    {/if}
</div>
