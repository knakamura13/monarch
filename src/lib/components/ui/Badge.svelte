<script lang="ts" module>
    const badgeVariants = {
        variant: {
            default: 'badge-default',
            secondary: 'badge-secondary',
            success: 'badge-success',
            warning: 'badge-warning',
            destructive: 'badge-destructive',
            outline: 'badge-outline'
        }
    } as const;

    export type BadgeVariant = keyof typeof badgeVariants.variant;
</script>

<script lang="ts">
    /* eslint-disable svelte/valid-compile */
    import type { HTMLAttributes } from 'svelte/elements';

    let {
        class: klass = '',
        variant = 'default',
        children,
        ...rest
    }: HTMLAttributes<HTMLSpanElement> & {
        class?: string;
        variant?: BadgeVariant;
        children?: import('svelte').Snippet;
    } = $props();
    /* eslint-enable svelte/valid-compile */

    const badgeClass = $derived(`badge ${badgeVariants.variant[variant as keyof typeof badgeVariants.variant]} ${klass}`.trim());
</script>

<span class={badgeClass} {...rest}>
    {#if children}{@render children()}{/if}
</span>
