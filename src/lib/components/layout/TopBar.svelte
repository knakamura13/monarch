<script lang="ts">
    import { Search, Menu } from 'lucide-svelte';

    let { onOpenSearch, onToggleSidebar }: { onOpenSearch: () => void; onToggleSidebar: () => void } = $props();
</script>

<header class="topbar">
    <!-- Mobile Menu Toggle -->
    <button class="topbar-menu-btn" onclick={onToggleSidebar} aria-label="Toggle sidebar">
        <Menu size={20} />
    </button>

    <!-- Search Pill -->
    <div class="search-container">
        <Search size={16} class="search-icon" />
        <button onclick={onOpenSearch} class="search-input" aria-label="Open search"> Search tasks, evidence… </button>
        <span class="mono search-kb">⌘K</span>
    </div>

    <div style="flex: 1;"></div>
</header>

<style>
    .topbar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left));
        border-bottom: 1px solid var(--hairline);
        background: var(--bg);
    }

    @media (min-width: 768px) {
        .topbar {
            padding: 32px max(32px, env(safe-area-inset-right)) 32px max(32px, env(safe-area-inset-left));
        }
    }

    /* Responsive topbar for shorter screens */
    @media (max-height: 800px) {
        .topbar {
            padding: 24px max(24px, env(safe-area-inset-right)) 24px max(24px, env(safe-area-inset-left));
        }
    }

    @media (max-height: 700px) {
        .topbar {
            padding: 20px max(20px, env(safe-area-inset-right)) 20px max(20px, env(safe-area-inset-left));
        }
    }

    @media (max-height: 600px) {
        .topbar {
            padding: 16px max(16px, env(safe-area-inset-right)) 16px max(16px, env(safe-area-inset-left));
        }
    }
    .topbar-menu-btn {
        display: none;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        color: var(--ink-2);
    }
    @media (max-width: 768px) {
        .topbar-menu-btn {
            display: flex;
        }
    }
    .search-container {
        position: relative;
        width: 33%;
        min-width: 140px;
        max-width: 100%;
    }
    :global(.search-icon) {
        position: absolute;
        left: 18px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--ink-3);
    }
    .search-input {
        width: 100%;
        text-align: left;
        padding: 0 44px;
        height: 44px;
        border-radius: 999px;
        background: var(--surface);
        border: 1px solid var(--hairline);
        color: var(--ink-3);
        font-size: 14px;
        cursor: text;
        transition: all 150ms ease;
    }
    .search-input:hover {
        background: var(--surface-2);
        border-color: var(--ink-3);
        color: var(--ink-2);
    }
    .search-kb {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 11px;
        color: oklch(0.35 0.12 60);
        background: oklch(0.85 0.08 60);
        padding: 2px 6px;
        border-radius: 6px;
    }

    @media (max-width: 480px) {
        .search-kb {
            display: none;
        }
    }
</style>
