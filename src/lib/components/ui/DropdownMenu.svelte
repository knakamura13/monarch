<script lang="ts">
    import type { Snippet } from 'svelte';
    import Button from './Button.svelte';
    import { MoreHorizontal } from 'lucide-svelte';
    import type { DropdownMenuEntry, DropdownMenuIcon, DropdownMenuItem } from './menuTypes';

    type TriggerArgs = { toggle: (e?: MouseEvent) => void; isOpen: boolean };

    let {
        items = [],
        triggerLabel = 'Menu',
        triggerIcon = MoreHorizontal,
        position = 'bottom-end',
        size = 'default',
        menuId = `dropdown-${Math.random().toString(36).slice(2, 11)}`,
        menuClass = '',
        trigger
    }: {
        items?: DropdownMenuEntry[];
        triggerLabel?: string;
        triggerIcon?: DropdownMenuIcon;
        position?: 'top-start' | 'top-end' | 'top-center' | 'bottom-start' | 'bottom-end' | 'bottom-center';
        size?: 'default' | 'sm' | 'lg';
        menuId?: string;
        menuClass?: string;
        trigger?: Snippet<[TriggerArgs]>;
    } = $props();

    let isOpen = $state(false);
    let rootEl = $state<HTMLDivElement>();
    let menuEl = $state<HTMLDivElement | null>(null);

    const listId = $derived(`${menuId}-menu`);
    const triggerId = $derived(`${menuId}-trigger`);

    function toggle(e?: MouseEvent) {
        e?.stopPropagation();
        isOpen = !isOpen;
    }

    function close() {
        isOpen = false;
    }

    function handleItemClick(item: DropdownMenuItem) {
        if (item.disabled) return;
        item.action?.();
        close();
    }

    function entryKey(entry: DropdownMenuEntry, i: number): string {
        if (entry === 'separator') return `sep-${i}`;
        return entry.id ?? `${entry.label}-${i}`;
    }

    // Close menu when clicking outside
    $effect(() => {
        if (!isOpen) return;

        const onDoc = (e: MouseEvent) => {
            const t = e.target;
            if (!(t instanceof HTMLElement)) return;
            if (rootEl?.contains(t)) return;
            close();
        };

        document.addEventListener('click', onDoc, true);
        return () => document.removeEventListener('click', onDoc, true);
    });

    // Close menu on Escape key
    $effect(() => {
        if (!isOpen) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                close();
            }
        };

        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    });

    const sizeClass = $derived(() => {
        const sizeMap = {
            default: 'dropdown-menu--size-default',
            sm: 'dropdown-menu--size-sm',
            lg: 'dropdown-menu--size-lg'
        } as const;
        return sizeMap[size as keyof typeof sizeMap] ?? 'dropdown-menu--size-default';
    });

    const positionClass = $derived(() => {
        const positionMap = {
            'top-start': 'dropdown-menu--pos-top-start',
            'top-end': 'dropdown-menu--pos-top-end',
            'top-center': 'dropdown-menu--pos-top-center',
            'bottom-start': 'dropdown-menu--pos-bottom-start',
            'bottom-end': 'dropdown-menu--pos-bottom-end',
            'bottom-center': 'dropdown-menu--pos-bottom-center'
        } as const;
        return positionMap[position as keyof typeof positionMap] ?? 'dropdown-menu--pos-bottom-end';
    });

    let horizontalShift = $state(0);

    // Prevent horizontal overflow and position dropdown correctly
    $effect(() => {
        if (!isOpen) {
            horizontalShift = 0;
            return;
        }

        const updatePosition = () => {
            if (!menuEl) return;

            // Get trigger element position
            const triggerEl = document.getElementById(triggerId);
            if (!triggerEl) return;

            // Reset shift to get natural position
            horizontalShift = 0;

            // Wait for DOM to update with reset shift
            requestAnimationFrame(() => {
                if (!menuEl) return;
                
                const triggerRect = triggerEl.getBoundingClientRect();
                const menuRect = menuEl.getBoundingClientRect();
                const padding = 12;
                let shift = 0;
                let top = 0;
                let left = 0;

                // Calculate position based on position prop
                const isBottomPosition = position.includes('bottom');
                if (position === 'bottom-start' || position === 'top-start') {
                    left = triggerRect.left;
                    top = isBottomPosition ? triggerRect.bottom + 4 : triggerRect.top - menuRect.height - 4;
                } else if (position === 'bottom-end' || position === 'top-end') {
                    left = triggerRect.right - menuRect.width;
                    top = isBottomPosition ? triggerRect.bottom + 4 : triggerRect.top - menuRect.height - 4;
                } else if (position === 'bottom-center' || position === 'top-center') {
                    left = triggerRect.left + (triggerRect.width / 2) - (menuRect.width / 2);
                    top = isBottomPosition ? triggerRect.bottom + 4 : triggerRect.top - menuRect.height - 4;
                }

                // Apply viewport constraints
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                // Prevent horizontal overflow
                if (left + menuRect.width > viewportWidth - padding) {
                    left = viewportWidth - padding - menuRect.width;
                } else if (left < padding) {
                    left = padding;
                }

                // Prevent vertical overflow
                if (top + menuRect.height > viewportHeight - padding) {
                    top = viewportHeight - padding - menuRect.height;
                } else if (top < padding) {
                    top = padding;
                }

                // Apply position
                menuEl.style.top = `${top}px`;
                menuEl.style.left = `${left}px`;

                // Check for dialog container overflow
                const container = menuEl.closest('[role="dialog"]');
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const menuRight = left + menuRect.width;
                    
                    // Adjust if still overflowing dialog container
                    if (menuRight > containerRect.right - padding) {
                        const overflow = menuRight - (containerRect.right - padding);
                        horizontalShift = -overflow;
                    } else if (left < containerRect.left + padding) {
                        const overflow = containerRect.left + padding - left;
                        horizontalShift = overflow;
                    }
                }

                horizontalShift = shift;
            });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);
    });
</script>

<div bind:this={rootEl} class="dropdown-root">
    {#if trigger}
        {@render trigger({ toggle, isOpen })}
    {:else}
        <Button
            id={triggerId}
            variant="ghost"
            size="icon"
            onclick={toggle}
            aria-label={triggerLabel}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={listId}
        >
            {#if triggerIcon}
                {@const Icon = triggerIcon}
                <Icon size={16} />
            {/if}
        </Button>
    {/if}

    {#if isOpen}
        <div
            bind:this={menuEl}
            id={listId}
            class="dropdown-menu {sizeClass} {positionClass} {menuClass}"
            style="--horizontal-shift: {horizontalShift}px"
            role="menu"
            aria-orientation="vertical"
        >
            {#each items as entry, i (entryKey(entry, i))}
                {#if entry === 'separator'}
                    <div class="dropdown-separator" role="separator"></div>
                {:else}
                    <div
                        class="dropdown-item"
                        class:destructive={entry.variant === 'destructive'}
                        class:disabled={entry.disabled}
                        role="menuitem"
                        tabindex="0"
                        onclick={() => handleItemClick(entry)}
                        onkeydown={(e) => e.key === 'Enter' && handleItemClick(entry)}
                    >
                        {#if entry.icon}
                            {@const Icon = entry.icon}
                            <span class="dropdown-item-icon">
                                <Icon size={14} />
                            </span>
                        {/if}
                        <span class="dropdown-item-label">{entry.label}</span>
                    </div>
                {/if}
            {/each}
        </div>
    {/if}
</div>

<style>
    .dropdown-root {
        position: relative;
        display: inline-block;
    }

    .dropdown-menu {
        position: fixed;
        background: var(--surface);
        border: 1px solid var(--hairline);
        border-radius: 6px;
        padding: 4px;
        box-shadow:
            0 4px 6px -1px rgb(0 0 0 / 0.1),
            0 2px 4px -2px rgb(0 0 0 / 0.1);
        z-index: 1000000;
        outline: none;
        min-width: fit-content;
        transform: translateX(var(--horizontal-shift, 0px));
        max-height: 50vh;
        overflow-y: auto;
    }

    .dropdown-menu--size-sm {
        min-width: 120px;
    }

    .dropdown-menu--size-default {
        min-width: 160px;
    }

    .dropdown-menu--size-lg {
        min-width: 200px;
    }

    /* Passed via menuClass from parents; :global so dynamic class names still match */
    .dropdown-root :global(.dropdown-menu--min-12rem) {
        min-width: 12rem;
    }

    .dropdown-menu--pos-bottom-start {
        top: 100%;
        left: 0;
        margin-top: 4px;
    }

    .dropdown-menu--pos-bottom-end {
        top: 100%;
        right: 0;
        margin-top: 4px;
    }

    .dropdown-menu--pos-bottom-center {
        top: 100%;
        left: 50%;
        transform: translateX(calc(-50% + var(--horizontal-shift, 0px)));
        margin-top: 4px;
    }

    .dropdown-menu--pos-top-start {
        bottom: 100%;
        left: 0;
        margin-bottom: 4px;
    }

    .dropdown-menu--pos-top-end {
        bottom: 100%;
        right: 0;
        margin-bottom: 4px;
    }

    .dropdown-menu--pos-top-center {
        bottom: 100%;
        left: 50%;
        transform: translateX(calc(-50% + var(--horizontal-shift, 0px)));
        margin-bottom: 4px;
    }

    .dropdown-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        color: var(--ink-1);
        transition:
            background-color 0.15s ease,
            color 0.15s ease;
        outline: none;
        text-decoration: none;
        user-select: none;
        white-space: nowrap;
        width: 100%;
        text-align: left;
        border: none;
        background: transparent;
    }

    .dropdown-item:hover,
    .dropdown-item:focus {
        background: var(--surface-2);
        color: var(--ink-1);
    }

    .dropdown-item:active {
        background: var(--surface-3);
        transform: scale(0.98);
    }

    .dropdown-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .dropdown-item.destructive {
        color: var(--destructive, #dc2626);
    }

    .dropdown-item.destructive:hover,
    .dropdown-item.destructive:focus {
        background: color-mix(in srgb, var(--destructive, #dc2626) 12%, transparent);
        color: var(--destructive, #991b1b);
    }

    .dropdown-item-icon {
        margin-right: 8px;
        flex-shrink: 0;
    }

    .dropdown-item-label {
        flex: 1;
    }

    .dropdown-separator {
        height: 1px;
        background: var(--hairline);
        margin: 4px 0;
    }
</style>
