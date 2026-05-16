<script lang="ts">
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import { page } from '$app/state';
    import { Activity, Cpu, Database, GitBranch, ExternalLink } from 'lucide-svelte';

    type Row = {
        id: string;
        occurredAt: string | Date;
        source: string;
        status: number | null;
        route: string | null;
        method: string | null;
        message: string;
        requestId: string | null;
    };

    const data = page.data as unknown as {
        errors: Row[];
        errorsLoadFailed: boolean;
        railwayProjectUrl: string;
        processInfo: {
            node: string;
            uptimeSec: number;
            uptimeLabel: string;
            commitSha: string | null;
            environment: string | null;
            serviceName: string | null;
        };
        dbHealth: { ok: boolean; ms: number };
    };
</script>

<PageHeader title="Diagnostics" sub="Owner-only system health, process info, and error logs." />

<div class="dev-page">
    <!-- Stats Grid -->
    <div class="dev-stats-grid">
        <div class="card dev-stat-card">
            <div class="dev-stat-label">
                <Activity style="width: 14px; height: 14px;" />
                <span class="eyebrow">Uptime</span>
            </div>
            <div class="display dev-stat-value">{data.processInfo.uptimeSec}s</div>
            <div class="mono dev-stat-caption">{data.processInfo.uptimeLabel}</div>
        </div>
        <div class="card dev-stat-card">
            <div class="dev-stat-label">
                <Cpu style="width: 14px; height: 14px;" />
                <span class="eyebrow">Node</span>
            </div>
            <div class="display dev-stat-value">{data.processInfo.node}</div>
        </div>
        <div class="card dev-stat-card">
            <div class="dev-stat-label">
                <GitBranch style="width: 14px; height: 14px;" />
                <span class="eyebrow">Commit</span>
            </div>
            <div class="display dev-stat-value dev-stat-value--compact">{data.processInfo.commitSha?.slice(0, 7) ?? '—'}</div>
        </div>
        <div class="card dev-stat-card">
            <div class="dev-stat-label">
                <Database style="width: 14px; height: 14px;" />
                <span class="eyebrow">DB Latency</span>
            </div>
            <div class="display dev-stat-value" style="color: {data.dbHealth.ok ? 'var(--sage-fill)' : 'var(--blush-fill)'};">
                {data.dbHealth.ok ? `${data.dbHealth.ms}ms` : 'Down'}
            </div>
        </div>
    </div>

    <!-- Logs Link -->
    <a
        href={data.railwayProjectUrl}
        target="_blank"
        rel="noreferrer"
        class="card logs-link-card"
        style="padding: 16px; background: var(--surface-2); border-style: dashed; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--ink); text-decoration: none; font-size: 13px; font-weight: 600; transition: all 150ms ease; cursor: pointer;"
    >
        <ExternalLink style="width: 14px; height: 14px;" /> Open Railway Cloud Logs
    </a>

    <!-- Error Table -->
    <div class="card" style="padding: 0; overflow: hidden;">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--hairline); background: var(--surface);">
            <h2 class="display" style="font-size: 20px; margin: 0;">Recent Errors</h2>
        </div>

        <div class="dev-table-wrap">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead style="background: var(--surface-2); color: var(--ink-3); border-bottom: 1px solid var(--hairline);">
                    <tr>
                        <th style="padding: 12px 20px; font-weight: 600;" class="eyebrow">Time</th>
                        <th style="padding: 12px 20px; font-weight: 600;" class="eyebrow">Status</th>
                        <th style="padding: 12px 20px; font-weight: 600;" class="eyebrow">Source</th>
                        <th style="padding: 12px 20px; font-weight: 600;" class="eyebrow">Message</th>
                        <th style="padding: 12px 20px; font-weight: 600;" class="eyebrow"></th>
                    </tr>
                </thead>
                <tbody>
                    {#if data.errorsLoadFailed}
                        <tr>
                            <td colspan="5" style="padding: 40px; text-align: center; color: var(--ink-3);">
                                Could not load errors{data.dbHealth.ok ? '' : ' — database is unreachable'}.
                            </td>
                        </tr>
                    {:else if data.errors.length === 0}
                        <tr>
                            <td colspan="5" style="padding: 40px; text-align: center; color: var(--ink-3);">
                                No errors logged in the last 24 hours.
                            </td>
                        </tr>
                    {:else}
                        {#each data.errors as e (e.id)}
                            <tr
                                style="border-bottom: 1px solid var(--hairline); transition: background 120ms ease;"
                                onmouseenter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                                onmouseleave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                <td
                                    style="padding: 12px 20px;"
                                    class="mono"
                                    title={(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`)(new Date(e.occurredAt))}
                                >
                                    {new Date(e.occurredAt).toLocaleTimeString()}
                                </td>
                                <td style="padding: 12px 20px;">
                                    <span class="pill {e.status && e.status >= 500 ? 's-urgent' : 's-note'}">
                                        {e.status ?? 'ERR'}
                                    </span>
                                </td>
                                <td style="padding: 12px 20px;" class="mono">{e.source}</td>
                                <td
                                    style="padding: 12px 20px; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                                    title={e.message}
                                >
                                    <span title={e.message}>{e.message}</span>
                                </td>
                                <td style="padding: 12px 20px; text-align: right;">
                                    <a
                                        href={`/settings/dev/errors/${e.id}`}
                                        style="color: var(--ink); font-weight: 600; text-decoration: none;">View</a
                                    >
                                </td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>
        </div>
    </div>
</div>

<style>
    .logs-link-card {
        padding: 16px;
        background: var(--surface-2);
        border-style: dashed;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: var(--ink);
        text-decoration: none;
        font-size: 13px;
        font-weight: 600;
        transition: all 150ms ease;
        cursor: pointer;
    }

    .dev-page {
        max-width: 1000px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        min-width: 0;
    }

    .dev-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 16px;
        min-width: 0;
    }

    .dev-stat-card {
        padding: 16px;
        min-width: 0;
    }

    .dev-stat-label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--ink-3);
        margin-bottom: 10px;
        min-width: 0;
    }

    .dev-stat-value {
        font-size: 20px;
        min-width: 0;
        line-height: 1.1;
        word-break: break-word;
    }

    .dev-stat-value--compact {
        font-size: 16px;
    }

    .dev-stat-caption {
        font-size: 10px;
        color: var(--ink-3);
        margin-top: 6px;
        line-height: 1.3;
    }

    .dev-table-wrap {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }

    @media (max-width: 768px) {
        .dev-table-wrap table {
            min-width: 640px;
        }
    }

    @media (max-width: 480px) {
        .dev-stat-card {
            padding: 14px;
        }

        .dev-stat-value {
            font-size: 18px;
        }
    }
</style>
