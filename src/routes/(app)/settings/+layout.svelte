<script lang="ts">
    import type { LayoutData } from './$types';
    let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

    const sections = [
        { href: '/settings/profile', label: 'Profile' },
        { href: '/settings/security', label: 'Security' },
        { href: '/settings/members', label: 'Members' },
        { href: '/settings/data', label: 'Data & privacy' },
        { href: '/settings/dev', label: 'Dev' }
    ];

    function sectionActive(pathname: string, href: string) {
        return pathname === href || pathname.startsWith(`${href}/`);
    }
</script>

<div class="settings-shell">
    <aside class="settings-nav" aria-label="Settings sections">
        <nav>
            <ul class="settings-nav-list">
                {#each sections as s (s.href)}
                    {@const active = sectionActive(data.pathname, s.href)}
                    <li>
                        <a
                            href={s.href}
                            class="settings-nav-link"
                            class:settings-nav-link-active={active}
                            aria-current={active ? 'page' : undefined}
                        >
                            {s.label}
                        </a>
                    </li>
                {/each}
            </ul>
        </nav>
    </aside>
    <div class="settings-panel">
        {@render children()}
    </div>
</div>

<style>
    .settings-shell {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        gap: 32px;
        flex: 1;
        min-height: 0;
        min-width: 0;
    }

    .settings-nav {
        flex-shrink: 0;
        width: auto;
        min-width: max-content;
        align-self: flex-start;
    }

    .settings-nav-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .settings-nav-link {
        display: block;
        padding: 10px 16px;
        border-radius: var(--r-sm);
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        transition:
            background 120ms ease,
            color 120ms ease;
        background: transparent;
        color: var(--ink-2);
    }

    .settings-nav-link:hover {
        color: var(--ink);
        background: var(--surface-2);
    }

    .settings-nav-link-active {
        background: var(--ink);
        color: var(--surface);
    }

    .settings-nav-link-active:hover {
        color: var(--surface);
        background: var(--ink);
    }

    .settings-panel {
        flex: 1;
        min-width: 0;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        padding-bottom: max(32px, env(safe-area-inset-bottom, 0px));
    }

    @media (max-width: 768px) {
        .settings-shell {
            flex-direction: column;
            gap: 20px;
        }

        .settings-nav {
            width: auto;
            min-width: 0;
            align-self: stretch;
        }

        .settings-nav-list {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 6px;
            padding-bottom: 0;
        }

        .settings-nav-list li {
            flex-shrink: 0;
        }

        .settings-nav-link {
            white-space: nowrap;
            padding: 8px 12px;
        }

        .settings-panel {
            flex: 1;
            min-height: 12rem;
        }
    }
</style>
