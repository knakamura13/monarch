<script lang="ts">
    import { flip } from 'svelte/animate';
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import MilestoneModal from '$lib/components/timeline/MilestoneModal.svelte';
    import { Plus, MapPin, Check, Clock, GripVertical, Pause } from 'lucide-svelte';
    import { fmtDate } from '$lib/utils/dates';
    import { PHASE_ORDER, PHASE_LABELS, PHASE_DESCRIPTIONS } from '$lib/constants/phases';
    import { page } from '$app/state';
    import { onDestroy, onMount } from 'svelte';
    import { getPageNumber } from '$lib/constants/navigation';
    import { goto, invalidateAll } from '$app/navigation';
    import { showErrorToast, showSuccessToast } from '$lib/stores/toast';
    import type { PageData } from './$types';
    import type { MilestoneItem } from '$lib/server/dynamo/types';
    import type { MilestonePhase } from '$lib/types/enums';

    interface TimelinePageData extends PageData {
        members: { id: string; name: string | null; email: string }[];
    }

    type DragState = {
        id: string;
        phase: MilestonePhase;
        item: MilestoneItem;
        pointerOffsetY: number;
        railTop: number;
        railBottom: number;
        left: number;
        width: number;
        height: number;
        currentTop: number;
    };

    const REORDER_FLIP_DURATION_MS = 180;
    const REORDER_SAVE_DEBOUNCE_MS = 700;

    let { data, form }: { data: TimelinePageData; form: { error?: string; errorId?: string } } = $props();

    let showCreateModal = $state(false);
    let defaultPhase = $state<string | undefined>(undefined);
    let milestones = $state<MilestoneItem[]>([]);
    let dragState = $state<DragState | null>(null);
    let lastSyncedMilestoneSignature = '';

    const confirmedOrders = new Map<MilestonePhase, string[]>();
    const reorderTimeouts = new Map<MilestonePhase, ReturnType<typeof setTimeout>>();
    const savingPhases = new Set<MilestonePhase>();
    const dirtyWhileSaving = new Set<MilestonePhase>();

    const editParam = $derived(page.url.searchParams.get('edit'));
    const editingMilestone = $derived(editParam && milestones.some((m) => m.id === editParam) ? { id: editParam } : null);

    async function updateUrl(id: string | null) {
        const scrollContainer = document.querySelector<HTMLElement>('main#main');
        const scrollTop = scrollContainer?.scrollTop ?? 0;
        const url = new URL(page.url.href);
        if (id) {
            url.searchParams.set('edit', id);
        } else {
            url.searchParams.delete('edit');
        }
        url.hash = '';
        await goto(url.toString(), { replaceState: true, noScroll: true });
        const restoreScroll = () => {
            const nextScrollContainer = document.querySelector<HTMLElement>('main#main');
            if (nextScrollContainer) nextScrollContainer.scrollTop = scrollTop;
        };
        requestAnimationFrame(() => {
            restoreScroll();
            requestAnimationFrame(restoreScroll);
        });
        setTimeout(restoreScroll, 50);
    }

    const grouped = $derived(
        PHASE_ORDER.map((p) => ({
            phase: p,
            items: milestones.filter((m) => m.phase === p)
        }))
    );

    function phaseProgress(items: { status: string }[]) {
        if (items.length === 0) return 0;
        const done = items.filter((i) => i.status === 'Done').length;
        return Math.round((done / items.length) * 100);
    }

    function phaseStatus(items: { status: string }[]) {
        if (items.length === 0) return 'future';
        const hasActive = items.some((i) => i.status === 'Doing' || i.status === 'To do');
        const allDone = items.every((i) => i.status === 'Done');
        if (allDone) return 'done';
        if (hasActive) return 'active';
        return 'future';
    }

    function milestoneNodeStatus(status: string) {
        switch (status) {
            case 'Done':
                return 'done';
            case 'Doing':
            case 'To do':
                return 'active';
            case 'On hold':
                return 'blocked';
            default:
                return 'future';
        }
    }

    function statusPillClass(status: string) {
        switch (status) {
            case 'To do':
                return 's-note';
            case 'Doing':
                return 's-active';
            case 'On hold':
                return 's-waiting';
            case 'Done':
                return 's-done';
            default:
                return '';
        }
    }

    function statusLabel(status: string) {
        if (status === 'Done') return 'Done';
        if (status === 'Doing') return 'Doing';
        if (status === 'To do') return 'To do';
        if (status === 'On hold') return 'On hold';
        return status;
    }

    function generateGoogleMapsUrl(address: string | null | undefined) {
        if (!address?.trim()) return '#';
        const query = encodeURIComponent(address.trim());
        return `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    function syncMilestonesFromData(nextMilestones: MilestoneItem[]) {
        milestones = nextMilestones;
        lastSyncedMilestoneSignature = milestoneDataSignature(nextMilestones);
        for (const phase of PHASE_ORDER) {
            confirmedOrders.set(
                phase,
                nextMilestones.filter((m) => m.phase === phase).map((m) => m.id)
            );
        }
    }

    function removeMilestoneFromPage(id: string) {
        const deletedMilestone = milestones.find((m) => m.id === id);
        milestones = milestones.filter((m) => m.id !== id);
        lastSyncedMilestoneSignature = milestoneDataSignature(milestones);

        if (deletedMilestone) {
            confirmedOrders.set(
                deletedMilestone.phase,
                milestones.filter((m) => m.phase === deletedMilestone.phase).map((m) => m.id)
            );
        }
    }

    $effect(() => {
        const signature = milestoneDataSignature(data.milestones);
        if (!dragState && signature !== lastSyncedMilestoneSignature) {
            syncMilestonesFromData(data.milestones);
        }
    });

    function milestoneDataSignature(nextMilestones: MilestoneItem[]) {
        return nextMilestones.map((m) => `${m.id}:${m.phase}:${m.order}:${m.updatedAt}`).join('|');
    }

    function phaseMilestoneIds(phase: MilestonePhase) {
        return milestones.filter((m) => m.phase === phase).map((m) => m.id);
    }

    function arraysEqual(left: string[], right: string[]) {
        return left.length === right.length && left.every((value, index) => value === right[index]);
    }

    function replacePhaseMilestonesByIds(phase: MilestonePhase, orderedIds: string[]) {
        const phaseMilestones = new Map(milestones.filter((m) => m.phase === phase).map((m) => [m.id, m]));
        const nextPhaseMilestones = orderedIds.map((id) => phaseMilestones.get(id)).filter((m): m is MilestoneItem => Boolean(m));
        milestones = [...milestones.filter((m) => m.phase !== phase), ...nextPhaseMilestones];
    }

    function clamp(value: number, min: number, max: number) {
        return Math.min(Math.max(value, min), max);
    }

    function getDragIndex(phase: MilestonePhase, activeId: string, pointerY: number) {
        const wrappers = Array.from(
            document.querySelectorAll<HTMLElement>(
                `.milestone-wrapper[data-phase="${phase}"][data-milestone-id]:not([data-milestone-id="${activeId}"])`
            )
        );
        const index = wrappers.findIndex((wrapper) => {
            const rect = wrapper.getBoundingClientRect();
            return pointerY < rect.top + rect.height / 2;
        });
        return index === -1 ? wrappers.length : index;
    }

    function updateDraggedMilestonePosition(event: PointerEvent) {
        if (!dragState) return;

        const pointerY = clamp(event.clientY, dragState.railTop, dragState.railBottom);
        const nextTop = clamp(event.clientY - dragState.pointerOffsetY, dragState.railTop, dragState.railBottom - dragState.height);
        const targetIndex = getDragIndex(dragState.phase, dragState.id, pointerY);
        const orderedIds = phaseMilestoneIds(dragState.phase).filter((id) => id !== dragState?.id);
        orderedIds.splice(targetIndex, 0, dragState.id);

        dragState = { ...dragState, currentTop: nextTop };
        if (!arraysEqual(orderedIds, phaseMilestoneIds(dragState.phase))) {
            replacePhaseMilestonesByIds(dragState.phase, orderedIds);
        }
    }

    function handleWindowPointerMove(event: PointerEvent) {
        event.preventDefault();
        updateDraggedMilestonePosition(event);
    }

    function handleWindowPointerUp(event: PointerEvent) {
        event.preventDefault();
        const phase = dragState?.phase;
        dragState = null;
        document.body.style.removeProperty('user-select');
        window.removeEventListener('pointermove', handleWindowPointerMove);
        window.removeEventListener('pointerup', handleWindowPointerUp);
        if (phase) schedulePhaseSave(phase);
    }

    function beginMilestoneDrag(event: PointerEvent, milestone: MilestoneItem, phase: MilestonePhase) {
        if (event.button !== 0) return;
        const handle = event.currentTarget as HTMLElement;
        const wrapper = handle.closest<HTMLElement>('.milestone-wrapper');
        const rail = handle.closest<HTMLElement>('.timeline-milestone-rail');
        if (!wrapper || !rail) return;

        event.preventDefault();
        event.stopPropagation();

        const wrapperRect = wrapper.getBoundingClientRect();
        const railRect = rail.getBoundingClientRect();
        dragState = {
            id: milestone.id,
            phase,
            item: milestone,
            pointerOffsetY: event.clientY - wrapperRect.top,
            railTop: railRect.top,
            railBottom: railRect.bottom,
            left: wrapperRect.left,
            width: wrapperRect.width,
            height: wrapperRect.height,
            currentTop: wrapperRect.top
        };

        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
        window.addEventListener('pointerup', handleWindowPointerUp, { passive: false });
    }

    async function persistPhaseOrder(phase: MilestonePhase, milestoneIds: string[]) {
        const formData = new FormData();
        formData.append('phase', phase);
        formData.append('milestoneIds', JSON.stringify(milestoneIds));
        const response = await fetch('?/reorder', { method: 'POST', body: formData });
        if (!response.ok) {
            throw new Error(`Failed to reorder milestones (${response.status})`);
        }
    }

    function schedulePhaseSave(phase: MilestonePhase) {
        const existingTimeout = reorderTimeouts.get(phase);
        if (existingTimeout) clearTimeout(existingTimeout);

        const timeout = setTimeout(async () => {
            reorderTimeouts.delete(phase);
            const currentIds = phaseMilestoneIds(phase);
            const confirmed = confirmedOrders.get(phase) ?? [];

            if (arraysEqual(currentIds, confirmed)) return;

            if (savingPhases.has(phase)) {
                dirtyWhileSaving.add(phase);
                return;
            }

            savingPhases.add(phase);
            try {
                await persistPhaseOrder(phase, currentIds);
                confirmedOrders.set(phase, currentIds);
            } catch (error) {
                console.error(error);
                showErrorToast('Failed to save milestone order');
                await invalidateAll();
                return;
            } finally {
                savingPhases.delete(phase);
            }

            const latestIds = phaseMilestoneIds(phase);
            if (dirtyWhileSaving.delete(phase) || !arraysEqual(latestIds, confirmedOrders.get(phase) ?? [])) {
                schedulePhaseSave(phase);
            }
        }, REORDER_SAVE_DEBOUNCE_MS);

        reorderTimeouts.set(phase, timeout);
    }

    const totalPhases = $derived(PHASE_ORDER.length);
    const completedPhases = $derived(grouped.filter((g) => phaseStatus(g.items) === 'done').length);
    const currentPhaseIndex = $derived(grouped.findIndex((g) => phaseStatus(g.items) === 'active'));
    const currentPhase = $derived(grouped.at(currentPhaseIndex) ?? null);

    onMount(() => {
        // Handle scrolling to milestone when URL contains hash fragment
        if (window.location.hash) {
            const milestoneId = window.location.hash.slice(1); // Remove #
            const element = document.getElementById(milestoneId);
            if (element) {
                // Small delay to ensure page is fully rendered
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    });

    onDestroy(() => {
        for (const timeout of reorderTimeouts.values()) clearTimeout(timeout);
        if (typeof window !== 'undefined') {
            window.removeEventListener('pointermove', handleWindowPointerMove);
            window.removeEventListener('pointerup', handleWindowPointerUp);
        }
        if (typeof document !== 'undefined') {
            document.body.style.removeProperty('user-select');
        }
    });
</script>

<PageHeader title="Timeline" sub="Case phases from preparation through final outcome." number={getPageNumber('/timeline')} />

<div class="timeline-page">
    <!-- Left: Phase Rail -->
    <div class="timeline-phase-rail">
        {#each grouped as g, i (g.phase)}
            {@const status = phaseStatus(g.items)}
            {@const progress = phaseProgress(g.items)}
            <section>
                <!-- Phase Header -->
                <div
                    class="timeline-phase-header {status === 'done' ? 'timeline-phase-header-done' : ''} {status === 'active'
                        ? 'timeline-phase-header-active'
                        : ''}"
                >
                    <div class="timeline-phase-number">0{i + 1}</div>
                    <h2 class="timeline-phase-title">{PHASE_LABELS[g.phase]}</h2>
                    <p class="timeline-phase-subtitle">{PHASE_DESCRIPTIONS[g.phase]}</p>
                    <div class="timeline-phase-meta">
                        {#if g.items.length > 0}
                            <span class="pill {statusPillClass(g.items[0]?.status ?? 'To do')}">{progress}% complete</span>
                            <span class="mono milestone-count">{g.items.length} milestones</span>
                        {/if}
                    </div>
                </div>

                <!-- Milestone Rail -->
                {#if g.items.length > 0}
                    <div class="timeline-milestone-rail" aria-label={`Milestones in ${PHASE_LABELS[g.phase]}`}>
                        <div class="timeline-rail-line"></div>
                        {#each g.items as m, _mi (m.id)}
                            {@const nodeStatus = milestoneNodeStatus(m.status)}
                            <div
                                class="milestone-wrapper {dragState?.id === m.id ? 'milestone-wrapper-placeholder' : ''}"
                                animate:flip={{ duration: REORDER_FLIP_DURATION_MS }}
                                data-milestone-id={m.id}
                                data-phase={g.phase}
                                aria-label={m.title}
                            >
                                <div
                                    class="timeline-milestone-node {nodeStatus === 'done'
                                        ? 'timeline-milestone-node-done'
                                        : ''} {nodeStatus === 'active' ? 'timeline-milestone-node-active' : ''} {nodeStatus === 'blocked'
                                        ? 'timeline-milestone-node-blocked'
                                        : ''} {nodeStatus === 'future' ? 'timeline-milestone-node-future' : ''}"
                                >
                                    {#if nodeStatus === 'done'}
                                        <Check style="width: 14px; height: 14px; color: var(--surface);" />
                                    {:else if nodeStatus === 'active'}
                                        <Clock style="width: 14px; height: 14px; color: var(--surface);" />
                                    {:else if nodeStatus === 'blocked'}
                                        <Pause style="width: 12px; height: 12px; color: var(--surface);" fill="currentColor" />
                                    {/if}
                                </div>
                                <button
                                    type="button"
                                    class="milestone-drag-handle"
                                    aria-label={`Reorder ${m.title}`}
                                    tabindex={dragState?.id === m.id ? -1 : 0}
                                    onpointerdown={(event) => beginMilestoneDrag(event, m, g.phase)}
                                >
                                    <GripVertical style="width: 14px; height: 14px;" />
                                </button>
                                <button
                                    type="button"
                                    id={m.id}
                                    data-milestone-card-id={m.id}
                                    onclick={async (e) => {
                                        e.currentTarget.blur();
                                        await updateUrl(m.id);
                                    }}
                                    class="milestone-btn"
                                >
                                    <div class="timeline-milestone-card {nodeStatus === 'active' ? 'timeline-milestone-card-active' : ''}">
                                        {#if m.dueDate}
                                            <div class="timeline-milestone-date">{fmtDate(m.dueDate)}</div>
                                        {/if}
                                        <h3 class="timeline-milestone-title">{m.title}</h3>
                                        {#if m.description}
                                            <div class="timeline-milestone-body">
                                                <div class="timeline-milestone-description">{m.description}</div>
                                            </div>
                                        {/if}
                                        <div class="timeline-milestone-footer">
                                            <span class="pill {statusPillClass(m.status)}">{statusLabel(m.status)}</span>
                                            {#if m.subTasks && m.subTasks.length > 0}
                                                <span class="subtask-count">
                                                    {m.subTasks.filter((st) => st.done).length}/{m.subTasks.length} subtasks
                                                </span>
                                            {/if}
                                            {#if (m as MilestoneItem).location}
                                                <a
                                                    href={generateGoogleMapsUrl((m as MilestoneItem).location)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="location-link"
                                                >
                                                    <MapPin style="width: 12px; height: 12px;" />
                                                    {(m as MilestoneItem).location}
                                                </a>
                                            {/if}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}

                <!-- Add Milestone Button -->
                <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => {
                        defaultPhase = g.phase;
                        showCreateModal = true;
                    }}
                    class="timeline-add-milestone-btn"
                >
                    <Plus style="width: 14px; height: 14px;" /> Add milestone to {PHASE_LABELS[g.phase]}
                </Button>
            </section>
        {/each}
    </div>

    <!-- Right: Sticky Sidebar -->
    <div class="timeline-sidebar">
        <!-- Phases Complete Card -->
        <div class="timeline-sidebar-card timeline-sidebar-card-tinted-sage">
            <div class="timeline-sidebar-number">{completedPhases}/{totalPhases}</div>
            <div class="timeline-sidebar-label">Phases complete</div>
        </div>

        <!-- Phase Progress Card -->
        <div class="timeline-sidebar-card">
            <div class="timeline-phase-list">
                {#each grouped as g (g.phase)}
                    {@const status = phaseStatus(g.items)}
                    <div class="timeline-phase-list-item {status === 'active' ? 'timeline-phase-list-item-active' : ''}">
                        <div
                            class="timeline-phase-dot {status === 'done' ? 'timeline-phase-dot-done' : ''} {status === 'active'
                                ? 'timeline-phase-dot-active'
                                : ''}"
                        ></div>
                        <span class="timeline-phase-name">{PHASE_LABELS[g.phase]}</span>
                        <span class="timeline-phase-count">{g.items.length}</span>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Now Card -->
        {#if currentPhase}
            <div class="timeline-sidebar-card timeline-sidebar-card-tinted-peri">
                <div class="now-heading">Now</div>
                <div class="timeline-sidebar-label">{PHASE_LABELS[currentPhase.phase]}</div>
                <p class="now-description">{PHASE_DESCRIPTIONS[currentPhase.phase]}</p>
            </div>
        {/if}
    </div>
</div>

{#if dragState}
    {@const ghost = dragState.item}
    {@const ghostNodeStatus = milestoneNodeStatus(ghost.status)}
    <div
        class="milestone-drag-ghost"
        style={`left: ${dragState.left}px; top: ${dragState.currentTop}px; width: ${dragState.width}px; height: ${dragState.height}px;`}
        aria-hidden="true"
    >
        <div class="timeline-milestone-card {ghostNodeStatus === 'active' ? 'timeline-milestone-card-active' : ''}">
            {#if ghost.dueDate}
                <div class="timeline-milestone-date">{fmtDate(ghost.dueDate)}</div>
            {/if}
            <h3 class="timeline-milestone-title">{ghost.title}</h3>
            {#if ghost.description}
                <div class="timeline-milestone-body">
                    <div class="timeline-milestone-description">{ghost.description}</div>
                </div>
            {/if}
            <div class="timeline-milestone-footer">
                <span class="pill {statusPillClass(ghost.status)}">{statusLabel(ghost.status)}</span>
                {#if ghost.subTasks && ghost.subTasks.length > 0}
                    <span class="subtask-count">
                        {ghost.subTasks.filter((st) => st.done).length}/{ghost.subTasks.length} subtasks
                    </span>
                {/if}
                {#if ghost.location}
                    <span class="location-link">
                        <MapPin style="width: 12px; height: 12px;" />
                        {ghost.location}
                    </span>
                {/if}
            </div>
        </div>
    </div>
{/if}

{#if editingMilestone}
    {@const milestone = milestones.find((m) => m.id === editingMilestone?.id)}
    {#if milestone}
        <MilestoneModal
            mode="edit"
            open={true}
            onClose={async () => {
                await updateUrl(null);
            }}
            action="?/update"
            onenhance={({ formData, cancel }: { formData: FormData; cancel: () => void }) => {
                return async () => {
                    const response = await fetch('?/update', { method: 'POST', body: formData });
                    if (response.ok) {
                        await invalidateAll();
                        showSuccessToast('Milestone updated successfully');
                        await updateUrl(null);
                    } else {
                        cancel();
                    }
                };
            }}
            initial={{
                id: milestone.id,
                title: milestone.title,
                description: milestone.description,
                phase: milestone.phase,
                status: milestone.status,
                priority: milestone.priority,
                dueDate: milestone.dueDate,
                scheduledAt: milestone.scheduledAt,
                notes: (milestone as { notes?: string }).notes,
                subTasks: milestone.subTasks,
                location: (milestone as MilestoneItem).location
            }}
            error={form?.error}
            errorId={form?.errorId}
            onDeleteSuccess={removeMilestoneFromPage}
        />
    {/if}
{/if}

{#if showCreateModal}
    <MilestoneModal
        mode="create"
        open={true}
        onClose={() => {
            showCreateModal = false;
            defaultPhase = undefined;
        }}
        action="?/create"
        {defaultPhase}
        error={form?.error}
        errorId={form?.errorId}
        onenhance={() => {
            return async ({
                result,
                update
            }: {
                result: import('@sveltejs/kit').ActionResult;
                update: () => Promise<void>;
            }) => {
                if (result.type === 'success' || result.type === 'redirect') {
                    await update();
                    showSuccessToast('Milestone created successfully');
                    showCreateModal = false;
                    defaultPhase = undefined;
                }
            };
        }}
    />
{/if}

<style>
    .milestone-count {
        font-size: 11px;
        color: var(--ink-3);
    }
    .milestone-wrapper {
        position: relative;
        margin-bottom: 12px;
    }
    .milestone-wrapper-placeholder {
        opacity: 0.22;
    }
    .milestone-wrapper-placeholder .milestone-drag-handle {
        visibility: hidden;
    }
    .milestone-btn {
        background: none;
        border: none;
        cursor: pointer;
        width: 100%;
        text-align: left;
        padding: 0;
    }
    .milestone-drag-handle {
        position: absolute;
        top: 18px;
        right: 18px;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: 1px solid color-mix(in srgb, var(--line) 75%, transparent);
        border-radius: 999px;
        background: transparent;
        color: var(--ink-3);
        touch-action: none;
        cursor: grab;
    }
    .milestone-drag-handle:hover {
        color: var(--ink-1);
        border-color: color-mix(in srgb, var(--ink-2) 22%, transparent);
    }
    .milestone-drag-handle:active {
        cursor: grabbing;
    }
    .milestone-drag-ghost {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        cursor: grabbing;
        box-shadow: 0 18px 45px color-mix(in srgb, var(--ink-1) 18%, transparent);
    }
    .milestone-drag-ghost .timeline-milestone-card {
        height: 100%;
    }
    .subtask-count {
        font-size: 11px;
        color: var(--ink-3);
    }
    .location-link {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--ink-2);
        text-decoration: none;
    }
    .now-heading {
        font-family: var(--font-display);
        font-size: 22px;
        font-weight: 500;
        margin-bottom: 4px;
    }
    .now-description {
        font-size: 12px;
        color: var(--ink-2);
        margin-top: 8px;
    }
</style>
