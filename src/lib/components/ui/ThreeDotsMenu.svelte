<script lang="ts">
    import MoreHorizontal from 'lucide-svelte/icons/more-horizontal';
    import DropdownMenu from './DropdownMenu.svelte';
    import type { DropdownMenuItem } from './menuTypes';

    let {
        items,
        menuId,
        position = 'bottom-center'
    }: {
        items: DropdownMenuItem[];
        menuId: string;
        position?: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-center';
    } = $props();

    const dropdownPosition = $derived.by((): 'bottom-end' | 'bottom-start' | 'bottom-center' | 'top-center' => {
        if (position === 'bottom-left') return 'bottom-start';
        if (position === 'bottom-right') return 'bottom-end';
        return position;
    });
</script>

<DropdownMenu {items} {menuId} position={dropdownPosition} size="sm" triggerLabel="More options" triggerIcon={MoreHorizontal} />
