<script lang="ts">
    import { page } from '$app/state';
    import { navigation, getPageNumber as _getPageNumber } from '$lib/constants/navigation';
    import Settings from "lucide-svelte/icons/settings";
    import Clock from "lucide-svelte/icons/clock";
    import Download from "lucide-svelte/icons/download";;
    import { PHASE_ORDER } from '$lib/constants/phases';
    import type { MilestoneItem } from '$lib/server/dynamo/types';
    import { canInstall, promptInstall } from '$lib/stores/pwa';
    import logo from '$lib/assets/logo.png?enhanced';

    let { workspaceName: _workspaceName, onNavigate }: { workspaceName: string; onNavigate?: () => void } = $props();
</script>

<div class="sidebar">
    <!-- Header -->
    <div style="display: flex; align-items: center; gap: 12px; padding: 0 8px;">
        <a href="/" style="display: block; line-height: 0;">
            <enhanced:img
                src={logo}
                alt="Monarch"
                width="40"
                height="32"
                style="flex-shrink: 0; display: block; object-fit: contain;"
            />
        </a>
        <div class="display" style="font-size: 24px; line-height: 1; letter-spacing: -0.01em;">monarch</div>
    </div>

    <!-- Navigation Section -->
    <div>
        <div class="eyebrow" style="padding: 0 12px 8px;">Our case</div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
            {#each navigation as item (item.href)}
                {@const active = page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`)}
                <a
                    href={item.href}
                    onclick={() => onNavigate?.()}
                    class="nav-item {active ? 'active' : ''}"
                    style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 12px; font-size: 14px; font-weight: 500; text-decoration: none; transition: all 120ms; color: {active
                        ? 'var(--surface)'
                        : 'var(--ink-2)'}; background: {active ? 'var(--ink)' : 'transparent'};"
                >
                    <item.icon size={18} />
                    <span style="flex: 1;">{item.label}</span>
                </a>
            {/each}
            <!-- Settings nav item -->
            {#if true}
                {@const active = page.url.pathname.startsWith('/settings')}
                <a
                    href="/settings"
                    class="nav-item {active ? 'active' : ''}"
                    style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 12px; font-size: 14px; font-weight: 500; text-decoration: none; color: {active
                        ? 'var(--surface)'
                        : 'var(--ink-2)'}; background: {active ? 'var(--ink)' : 'transparent'};"
                    onclick={() => onNavigate?.()}
                >
                    <Settings size={18} />
                    <span style="flex: 1;">Settings</span>
                </a>
            {/if}
        </div>
    </div>
    <!-- Footer -->
    <div style="margin-top: auto;">
        <!-- Next Step Widget -->
        {#await page.data.streamed?.milestones}
            <!-- Loading state optional, or just wait -->
        {:then milestones}
            {@const next = (() => {
                if (!milestones) return null;
                const ms = milestones as MilestoneItem[];
                for (const phase of PHASE_ORDER) {
                    const inPhase = ms.filter((m) => m.phase === phase);
                    const incomplete = inPhase.find((m) => m.status !== 'Done');
                    if (incomplete) return incomplete;
                }
                return null;
            })()}

            {#if next}
                <div
                    class="card-tight"
                    style="background: var(--peri); border: 1px solid transparent; padding: 14px; border-radius: var(--r-sm); margin-bottom: 12px;"
                >
                    <div class="eyebrow" style="margin-bottom: 6px;">Next step</div>
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px; line-height: 1.3;">
                        {next.title}
                    </div>
                    <div class="mono" style="font-size: 11px; color: oklch(0.32 0.13 265);">
                        <Clock size={11} style="vertical-align: -2px; margin-right: 4px;" />
                        {#if next.dueDate}
                            {new Date(next.dueDate).toLocaleDateString()}
                        {:else}
                            {next.status.toLowerCase().replace('_', ' ')}
                        {/if}
                    </div>
                </div>
            {/if}
        {/await}
    </div>
</div>

<style>
    .sidebar {
        width: 200px;
        padding: 20px 16px;
        background: var(--bg);
        border-right: 1px solid var(--hairline);
        display: flex;
        flex-direction: column;
        gap: 28px;
        height: 100%;
        min-height: 0;
        box-sizing: border-box;
        overflow-x: hidden;
        overflow-y: auto;
        flex-shrink: 0;
    }

    .sidebar .mono,
    .sidebar .eyebrow {
        padding: 0;
    }

    .nav-item {
        transition: background 0.2s ease;
        overflow-x: hidden;
        overflow-y: auto;
    }

    .nav-item:not(.active):hover {
        background: var(--surface-2) !important;
    }

    /* Compact layout for shorter screens */
    @media (max-height: 800px) {
        .sidebar {
            padding: 20px 16px;
            gap: 20px;
        }

        .sidebar .display {
            font-size: 20px !important;
        }

        .sidebar .eyebrow {
            font-size: 10px !important;
            margin-bottom: 6px !important;
        }

        .sidebar .nav-item {
            padding: 8px 12px !important;
            font-size: 13px !important;
            gap: 10px !important;
        }

        .sidebar .nav-item:not(.active):hover {
            background: var(--surface-2) !important;
        }

        .sidebar .nav-item span {
            font-size: 13px !important;
        }

        .sidebar .mono {
            font-size: 10px !important;
        }
    }

    /* Very compact layout for very short screens */
    @media (max-height: 700px) {
        .sidebar {
            padding: 16px 12px;
            gap: 16px;
        }

        .sidebar .display {
            font-size: 18px !important;
        }

        .sidebar .eyebrow {
            font-size: 9px !important;
            margin-bottom: 4px !important;
        }

        .sidebar .nav-item {
            padding: 6px 10px !important;
            font-size: 12px !important;
            gap: 8px !important;
        }

        .sidebar .nav-item span {
            font-size: 12px !important;
        }

        .sidebar .mono {
            font-size: 9px !important;
        }

        /* Compact footer section */
        .sidebar > div:last-child {
            margin-top: auto;
            padding-top: 8px !important;
        }

        .sidebar .card-tight {
            padding: 10px !important;
            margin-bottom: 8px !important;
        }

        .sidebar .card-tight .eyebrow {
            margin-bottom: 4px !important;
        }

        .sidebar .card-tight div[style*='font-size: 13px'] {
            font-size: 12px !important;
            margin-bottom: 3px !important;
        }

        .sidebar .card-tight .mono {
            font-size: 9px !important;
        }
    }

    /* Reduce gap beneath Settings route */
    .sidebar .nav-item[href='/settings'] {
        margin-bottom: -8px;
    }

    /* Ultra compact for extremely short screens */
    @media (max-height: 600px) {
        .sidebar {
            padding: 12px 8px;
            gap: 12px;
        }

        .sidebar .display {
            font-size: 16px !important;
        }

        .sidebar .eyebrow {
            font-size: 8px !important;
            margin-bottom: 3px !important;
        }

        .sidebar .nav-item {
            padding: 4px 8px !important;
            font-size: 11px !important;
            gap: 6px !important;
        }

        .sidebar .nav-item span {
            font-size: 11px !important;
        }

        .sidebar .mono {
            font-size: 8px !important;
        }

        /* Hide or minimize less critical elements */
        .sidebar .card-tight {
            padding: 6px !important;
        }

        .sidebar .card-tight .eyebrow {
            display: none;
        }

        /* Further reduce Settings gap on ultra short screens */
        .sidebar .nav-item[href='/settings'] {
            margin-bottom: -12px;
        }
    }
</style>
