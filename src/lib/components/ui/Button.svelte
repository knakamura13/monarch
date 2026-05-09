<script lang="ts" module>
    const buttonVariants = {
        variant: {
            default: 'primary',
            destructive: 'destructive',
            outline: 'outline',
            secondary: 'secondary',
            ghost: 'ghost',
            link: 'link'
        },
        size: {
            default: '',
            sm: 'sm',
            lg: 'lg',
            icon: 'icon'
        }
    } as const;

    export type ButtonVariant = keyof typeof buttonVariants.variant;
    export type ButtonSize = keyof typeof buttonVariants.size;
</script>

<script lang="ts">
    /* eslint-disable svelte/valid-compile */
    import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';

    type Props = (HTMLButtonAttributes & { href?: undefined }) | (HTMLAnchorAttributes & { href: string });

    let {
        class: klass = '',
        variant = 'default',
        size = 'default',
        loading = false,
        disabled = false,
        href,
        children,
        ...rest
    }: Props & {
        variant?: ButtonVariant;
        size?: ButtonSize;
        loading?: boolean;
        disabled?: boolean;
        class?: string;
        children?: import('svelte').Snippet;
    } = $props();
    /* eslint-enable svelte/valid-compile */

    const isDisabled = $derived(disabled || loading);

    // eslint-disable-next-line security/detect-object-injection
    const classes = $derived(
        `btn ${buttonVariants.variant[variant]} ${buttonVariants.size[size]} ${loading ? 'loading' : ''} ${isDisabled ? 'disabled' : ''} ${klass}`.trim()
    );

    const title = $derived(rest.title || (size === 'icon' ? (rest['aria-label'] as string) : undefined));
</script>

{#if href}
    <a {href} class={classes} {title} {...rest as HTMLAnchorAttributes}>
        {#if children}{@render children()}{/if}
    </a>
{:else}
    <button class={classes} {title} disabled={isDisabled} {...rest as HTMLButtonAttributes}>
        {#if loading}
            <span class="btn-spinner"></span>
        {/if}
        {#if children}{@render children()}{/if}
    </button>
{/if}

<style>
    .btn-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: btn-spin 0.75s linear infinite;
        flex-shrink: 0;
    }

    @keyframes btn-spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .btn.loading {
        pointer-events: none;
        opacity: 0.8;
    }
</style>
