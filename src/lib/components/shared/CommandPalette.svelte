<script lang="ts">
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { Search, X } from 'lucide-svelte';

    interface Result {
        type: string;
        id: string;
        title: string;
        description?: string;
        href: string;
    }

    let { open = $bindable(false) }: { open?: boolean } = $props();

    let query = $state('');
    let results = $state<Record<string, Result[]>>({});
    let loading = $state(false);
    let activeIndex = $state(0);
    let inputEl = $state<HTMLInputElement | null>(null);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let searchRequestId = $state(0);

    let dialogContentEl = $state<HTMLDivElement | null>(null);
    let lastActiveEl = $state<HTMLElement | null>(null);

    function getFocusable(container: HTMLElement): HTMLElement[] {
        const nodes = container.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        return Array.from(nodes).filter((el) => {
            const style = window.getComputedStyle(el);
            return style.display != 'none' && style.visibility != 'hidden';
        });
    }

    function trapTabKey(e: KeyboardEvent) {
        if (e.key !== 'Tab') return;
        const container = dialogContentEl;
        if (!container) return;
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

    const flat = $derived(Object.values(results).flat());
    const activeItem = $derived(flat.at(activeIndex));

    $effect(() => {
        if (open) {
            lastActiveEl = document.activeElement as HTMLElement | null;
            setTimeout(() => inputEl?.focus(), 20);
        } else {
            lastActiveEl?.focus();
            query = '';
            results = {};
            activeIndex = 0;
        }
    });

    async function runSearch(q: string, requestId: number) {
        if (!q.trim()) {
            results = {};
            return;
        }
        loading = true;
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                // Only update results if this is still the current request
                if (requestId === searchRequestId) {
                    results = await res.json();
                }
            }
        } catch (err) {
            console.error('[search]', err);
        } finally {
            // Only set loading to false if this is still the current request
            if (requestId === searchRequestId) {
                loading = false;
            }
        }
    }

    function onInput() {
        if (debounceTimer) clearTimeout(debounceTimer);
        const q = query;
        searchRequestId++;
        const currentRequestId = searchRequestId;
        debounceTimer = setTimeout(() => runSearch(q, currentRequestId), 150);
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            open = false;
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, Math.max(flat.length - 1, 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
        } else if (e.key === 'Enter') {
            const item = flat.at(activeIndex);
            if (item) {
                open = false;
                if (item.type === 'quicklink') {
                    window.open(item.href, '_blank', 'noopener,noreferrer');
                } else {
                    goto(item.href);
                }
            }
        }
    }

    onMount(() => {
        function onGlobalKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                open = !open;
            }
        }
        window.addEventListener('keydown', onGlobalKey);
        return () => window.removeEventListener('keydown', onGlobalKey);
    });
</script>

{#if open}
    <div
        class="dialog-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        tabindex="-1"
        onclick={(e) => {
            if (e.target === e.currentTarget) open = false;
        }}
        onkeydown={(e) => {
            if (e.key === 'Escape') open = false;
            trapTabKey(e);
        }}
    >
        <div bind:this={dialogContentEl} class="dialog-content" style="max-width: 640px;" role="none">
            <div class="cmdpal-container">
                <div class="cmdpal-search-row">
                    <Search size={20} style="color: var(--ink-3);" />
                    <label class="cmdpal-sr-only" for="command-palette-input">Search</label>
                    <input
                        id="command-palette-input"
                        bind:this={inputEl}
                        bind:value={query}
                        oninput={onInput}
                        onkeydown={onKeydown}
                        aria-controls="command-palette-results"
                        aria-activedescendant={activeItem ? `cp-opt-${activeItem.type}-${activeItem.id}` : undefined}
                        aria-autocomplete="list"
                        placeholder="Search tasks, evidence, questions…"
                        class="cmdpal-input"
                    />
                    <button class="btn sm ghost" style="padding: 0 8px; height: 32px;" aria-label="Close" onclick={() => (open = false)}>
                        <X size={16} />
                    </button>
                </div>
                <div class="cmdpal-results">
                    {#if loading}
                        <div class="cmdpal-empty">Searching…</div>
                    {:else if !query.trim()}
                        <div class="cmdpal-empty">Type to search your workspace.</div>
                    {:else if flat.length === 0}
                        <div class="cmdpal-empty">No results for "{query}"</div>
                    {:else}
                        {#each Object.entries(results) as [group, items]}
                            {#if items.length > 0}
                                <div>
                                    <div class="cmdpal-group-title">{group}</div>
                                    <ul
                                        id="command-palette-results"
                                        role="listbox"
                                        aria-label="Search results"
                                        style="list-style: none; padding: 0; margin: 0;"
                                    >
                                        {#each items as item, _i (item.type + item.id)}
                                            {@const globalIndex = flat.findIndex((f) => f.type === item.type && f.id === item.id)}
                                            {@const optionId = `cp-opt-${item.type}-${item.id}`}
                                            <li role="option" id={optionId} aria-selected={activeIndex === globalIndex}>
                                                <a
                                                    href={item.href}
                                                    target={item.type === 'quicklink' ? '_blank' : undefined}
                                                    rel={item.type === 'quicklink' ? 'noopener noreferrer' : undefined}
                                                    onclick={() => (open = false)}
                                                    class="cmdpal-item {activeIndex === globalIndex ? 'active' : ''}"
                                                >
                                                    <span class="cmdpal-item-title">{item.title}</span>
                                                    {#if item.description}
                                                        <span class="cmdpal-item-desc">{item.description}</span>
                                                    {/if}
                                                </a>
                                            </li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}
                        {/each}
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}
