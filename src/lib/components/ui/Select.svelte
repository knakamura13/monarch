<script lang="ts">
    import Button from './Button.svelte';
    import { ChevronDown } from 'lucide-svelte';

    export type SelectOption = { value: string; label: string };

    let {
        options,
        value = $bindable(''),
        name,
        id,
        disabled = false,
        class: klass = '',
        triggerClass = '',
        ariaLabel,
        position = 'bottom-start',
        fluid = false,
        menuClass = '',
        onValueChange,
        size = 'default'
    }: {
        options: SelectOption[];
        value?: string;
        name?: string;
        id?: string;
        disabled?: boolean;
        class?: string;
        /** Merged onto the trigger button (e.g. `modal-metadata-btn`) */
        triggerClass?: string;
        ariaLabel?: string;
        position?: 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
        fluid?: boolean;
        menuClass?: string;
        onValueChange?: (next: string) => void;
        size?: 'default' | 'sm' | 'lg';
    } = $props();

    let isOpen = $state(false);
    let rootEl = $state<HTMLDivElement>();
    const listIdBase = `sel-${Math.random().toString(36).slice(2, 11)}`;
    const listId = $derived(id ? `${id}-listbox` : `${listIdBase}-listbox`);

    const displayLabel = $derived(options.find((o) => o.value === value)?.label ?? value ?? '');

    const sizeClass = $derived(() => {
        const sizeMap = {
            default: 'select-menu--size-default',
            sm: 'select-menu--size-sm',
            lg: 'select-menu--size-lg'
        } as const;
        return sizeMap[size as keyof typeof sizeMap] ?? 'select-menu--size-default';
    });

    const positionClass = $derived(() => {
        const positionMap = {
            'top-start': 'select-menu--pos-top-start',
            'top-end': 'select-menu--pos-top-end',
            'bottom-start': 'select-menu--pos-bottom-start',
            'bottom-end': 'select-menu--pos-bottom-end'
        } as const;
        return positionMap[position as keyof typeof positionMap] ?? 'select-menu--pos-bottom-start';
    });

    function toggle(e?: MouseEvent) {
        e?.stopPropagation();
        if (disabled) return;
        isOpen = !isOpen;
    }

    function close() {
        isOpen = false;
    }

    function pick(next: string) {
        value = next;
        onValueChange?.(next);
        close();
    }

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

    $effect(() => {
        if (!isOpen) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };

        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    });
</script>

<div bind:this={rootEl} class="select-root {klass}" class:select-root--fluid={fluid}>
    {#if name}<input type="hidden" {name} {value} />{/if}

    <Button
        type="button"
        {id}
        variant="ghost"
        size="sm"
        class="select-trigger {triggerClass}"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={ariaLabel}
        {disabled}
        onclick={toggle}
    >
        <span class="select-trigger-label">{displayLabel}</span>
        <ChevronDown class="select-trigger-chevron" size={14} aria-hidden="true" />
    </Button>

    {#if isOpen}
        <div id={listId} class="select-menu {sizeClass} {positionClass} {menuClass}" role="listbox" aria-orientation="vertical">
            {#each options as o (o.value)}
                <div
                    class="select-item"
                    class:selected={o.value === value}
                    role="option"
                    aria-selected={o.value === value}
                    tabindex="0"
                    onclick={() => pick(o.value)}
                    onkeydown={(e) => e.key === 'Enter' && pick(o.value)}
                >
                    <span class="select-item-label">{o.label}</span>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .select-root {
        position: relative;
        display: inline-block;
        max-width: 100%;
    }

    .select-root--fluid {
        display: block;
        width: 100%;
    }

    .select-root--fluid :global(button.select-trigger) {
        width: 100%;
        justify-content: space-between;
    }

    .select-root :global(button.select-trigger) {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-width: 100%;
        font-weight: 400;
    }

    .select-trigger-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
    }

    .select-trigger-chevron {
        flex-shrink: 0;
        opacity: 0.65;
    }

    .select-menu {
        position: absolute;
        background: var(--surface);
        border: 1px solid var(--hairline);
        border-radius: 6px;
        padding: 4px;
        box-shadow:
            0 4px 6px -1px rgb(0 0 0 / 0.1),
            0 2px 4px -2px rgb(0 0 0 / 0.1);
        z-index: 9999;
        outline: none;
        min-width: fit-content;
    }

    .select-menu--size-sm {
        min-width: 120px;
    }

    .select-menu--size-default {
        min-width: 160px;
    }

    .select-menu--size-lg {
        min-width: 200px;
    }

    .select-menu--pos-bottom-start {
        top: 100%;
        left: 0;
        margin-top: 4px;
    }

    .select-menu--pos-bottom-end {
        top: 100%;
        right: 0;
        margin-top: 4px;
    }

    .select-menu--pos-top-start {
        bottom: 100%;
        left: 0;
        margin-bottom: 4px;
    }

    .select-menu--pos-top-end {
        bottom: 100%;
        right: 0;
        margin-bottom: 4px;
    }

    .select-item {
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
        user-select: none;
        width: 100%;
        text-align: left;
        border: none;
        background: transparent;
        white-space: nowrap;
    }

    .select-item:hover,
    .select-item:focus {
        background: var(--surface-2);
        color: var(--ink-1);
    }

    .select-item:active {
        background: var(--surface-3);
        transform: scale(0.98);
    }

    .select-item.selected {
        font-weight: 500;
    }
</style>
