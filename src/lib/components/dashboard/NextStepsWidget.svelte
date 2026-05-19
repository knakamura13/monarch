<script lang="ts">
    import type { MilestoneItem } from '$lib/server/dynamo/types';
    import { PHASE_LABELS } from '$lib/constants/phases';
    import { Clock, Play, ChevronRight } from 'lucide-svelte';
    import { goto } from '$app/navigation';

    let { milestones }: { milestones: MilestoneItem[] } = $props();
</script>

<div class="next-steps-list">
    {#each milestones as m (m.id)}
        <div
            class="milestone-item"
            role="button"
            tabindex="0"
            aria-label={`Milestone: ${m.title}`}
            onclick={() => goto(`/timeline#${m.id}`)}
            onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goto(`/timeline#${m.id}`);
                }
            }}
        >
            <div class="milestone-icon">
                {#if m.status === 'Doing'}
                    <div class="status-icon s-doing">
                        <Play size={16} fill="currentColor" />
                    </div>
                {:else}
                    <div class="status-icon s-todo">
                        <Clock size={16} />
                    </div>
                {/if}
            </div>
            <div class="milestone-info">
                <div class="eyebrow phase-label">{PHASE_LABELS[m.phase]}</div>
                <div class="milestone-title">{m.title}</div>
            </div>
            <div class="milestone-action">
                <div class="pill {m.status === 'Doing' ? 's-doing' : ''}">{m.status}</div>
                <ChevronRight size={18} style="color: var(--ink-4);" />
            </div>
        </div>
    {:else}
        <div class="empty-state">No upcoming milestones.</div>
    {/each}
</div>

<style>
    .next-steps-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .milestone-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: var(--surface-2);
        border-radius: var(--r-md);
        cursor: pointer;
        transition: all 120ms ease;
        border: 1px solid transparent;
    }
    .milestone-item:hover {
        background: var(--surface-3);
        transform: translateY(-1px);
        border-color: var(--hairline);
    }
    .status-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }
    .status-icon.s-doing {
        background: var(--lilac);
        color: oklch(0.35 0.12 305);
    }
    .status-icon.s-todo {
        background: var(--surface-3);
        color: var(--ink-3);
    }
    .milestone-info {
        flex: 1;
        min-width: 0;
    }
    .phase-label {
        margin-bottom: 2px;
        font-size: 10px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .milestone-title {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .milestone-action {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .empty-state {
        padding: 24px;
        text-align: center;
        color: var(--ink-3);
        font-size: 14px;
        background: var(--surface-2);
        border-radius: var(--r-md);
        border: 1px dashed var(--hairline);
    }
</style>
