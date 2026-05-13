<script lang="ts">
    import { onMount } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import Sidebar from '$lib/components/layout/Sidebar.svelte';
    import TopBar from '$lib/components/layout/TopBar.svelte';
    import CommandPalette from '$lib/components/shared/CommandPalette.svelte';
    import { initTruncateTitles } from '$lib/utils/truncate-titles';
    import type { LayoutData } from './$types';

    let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

    let sidebarOpen = $state(false);
    let paletteOpen = $state(false);

    let sidebarDialogEl = $state<HTMLDivElement | null>(null);
    let sidebarOpenerEl = $state<HTMLElement | null>(null);

    function getFocusable(container: HTMLElement): HTMLElement[] {
        const nodes = container.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        return Array.from(nodes).filter((el) => {
            const style = window.getComputedStyle(el);
            return style.display != 'none' && style.visibility != 'hidden';
        });
    }

    function trapTabKey(e: KeyboardEvent, container: HTMLElement) {
        if (e.key !== 'Tab') return;
        const focusable = getFocusable(container);
        if (focusable.length === 0) return;
        const active = document.activeElement as HTMLElement | null;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey) {
            if (!active || active === first || !container.contains(active)) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (!active || active === last || !container.contains(active)) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    onMount(initTruncateTitles);
</script>

<!-- Skip link for keyboard navigation (accessibility) -->
<a href="#main" class="skip-link">Skip to main content</a>

<div class="app-layout">
    <!-- Desktop Sidebar -->
    <aside class="sidebar-wrapper" aria-label="Main navigation">
        <Sidebar workspaceName={data.workspace.name} />
    </aside>

    <!-- Mobile Sidebar Dialog -->
    {#if sidebarOpen}
        <div
            class="mobile-sidebar-container"
            role="dialog"
            aria-modal="true"
            aria-label="Sidebar"
            tabindex="-1"
            onkeydown={(e) => {
                if (e.key === 'Escape') sidebarOpen = false;
                if (sidebarDialogEl) trapTabKey(e, sidebarDialogEl);
            }}
        >
            <div
                transition:fade={{ duration: 200 }}
                class="mobile-sidebar-overlay"
                aria-hidden="true"
                onclick={() => (sidebarOpen = false)}
            ></div>
            <div
                bind:this={sidebarDialogEl}
                tabindex="-1"
                class="mobile-sidebar-panel"
                transition:fly={{ x: -280, duration: 220, opacity: 1 }}
            >
                <Sidebar workspaceName={data.workspace.name} onNavigate={() => (sidebarOpen = false)} />
            </div>
        </div>
    {/if}

    <!-- Main Area -->
    <div class="main-area">
        <TopBar
            onOpenSearch={() => (paletteOpen = true)}
            onToggleSidebar={() => {
                if (!sidebarOpen) sidebarOpenerEl = document.activeElement as HTMLElement | null;
                sidebarOpen = !sidebarOpen;
            }}
        />
        <main id="main" tabindex="-1" class="main-content">
            {@render children()}
        </main>
    </div>
</div>

<CommandPalette bind:open={paletteOpen} />

{#if sidebarOpen && sidebarDialogEl}
    {@const _focus = (() => {
        queueMicrotask(() => {
            if (!sidebarDialogEl) return;
            const focusable = getFocusable(sidebarDialogEl);
            (focusable[0] ?? sidebarDialogEl)?.focus();
        });
        return null;
    })()}
{/if}

{#if !sidebarOpen && sidebarOpenerEl}
    {@const _restore = (() => {
        queueMicrotask(() => sidebarOpenerEl?.focus());
        sidebarOpenerEl = null;
        return null;
    })()}
{/if}

<style>
    .app-layout {
        display: flex;
        height: 100dvh;
        max-height: 100dvh;
        width: 100vw;
        max-width: 100vw;
        background: var(--bg);
        overflow: hidden;
        position: relative;
    }
    .sidebar-wrapper {
        display: none;
        flex-shrink: 0;
        width: 200px;
        height: 100%;
        max-height: 100dvh;
        min-height: 0;
        overflow-y: auto;
    }
    @media (min-width: 768px) {
        .sidebar-wrapper {
            display: block;
        }
        .main-content {
            padding: 32px 32px 32px;
        }
    }
    .main-area {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        min-width: 0;
        min-height: 0;
        height: 100%;
        max-height: 100dvh;
        overflow: hidden;
    }
    .main-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 16px 16px 16px;
        background: var(--bg);
        display: flex;
        flex-direction: column;
    }

    /* Responsive main content for shorter screens */
    @media (max-height: 800px) {
        .main-content {
            padding: 24px 24px 24px;
        }
    }

    @media (max-height: 700px) {
        .main-content {
            padding: 20px 20px 20px;
        }
    }

    @media (max-height: 600px) {
        .main-content {
            padding: 16px 16px 16px;
        }
    }

    /* Skip Link (Accessibility) */
    .skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: var(--ink);
        color: var(--surface);
        padding: 8px 16px;
        z-index: 9999;
        border-radius: 0 0 4px 0;
        font-size: 14px;
        font-weight: 500;
    }

    .skip-link:focus {
        top: 0;
        outline: none;
    }

    /* Improve focus indicators */
    :global(a:focus-visible),
    :global(input:focus-visible),
    :global(select:focus-visible),
    :global(textarea:focus-visible) {
        outline: 2px solid var(--ink);
        outline-offset: 2px;
        border-radius: 4px;
    }

    /* Input focus specifically - we want the app.css focus ring for .input, but this covers raw elements */
    :global(input:focus-visible),
    :global(textarea:focus-visible),
    :global(select:focus-visible) {
        outline: none;
        box-shadow: 0 0 0 3px rgba(26, 26, 24, 0.1);
        border-color: var(--ink-2);
        border-radius: 4px;
    }

    /* Mobile Sidebar Styles */
    .mobile-sidebar-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        overflow: hidden;
    }
    .mobile-sidebar-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(26, 26, 24, 0.4);
        backdrop-filter: blur(4px);
    }
    .mobile-sidebar-panel {
        position: relative;
        width: 200px;
        height: 100%;
        background: var(--bg);
        border-right: 1px solid var(--hairline);
        overflow-x: hidden;
        overflow-y: auto;
        flex-shrink: 0;
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
    }
</style>
