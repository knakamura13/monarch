<script lang="ts">
    import Card from '$lib/components/ui/Card.svelte';
    import { fmtDate } from '$lib/utils/dates';
    import { Calendar } from 'lucide-svelte';

    let {
        task,
        onEdit,
        onPointerDown,
        isDragging = false,
        isAnyDragging = false
    }: {
        task: {
            id: string;
            title: string;
            description: string | null;
            status: string;
            priority: string;
            dueDate: string | null;
            checklist?: Array<{ id: string; text: string; done: boolean }>;
        };
        onEdit?: (id: string) => void;
        onPointerDown?: (e: PointerEvent, id: string) => void;
        isDragging?: boolean;
        isAnyDragging?: boolean;
    } = $props();

    function hasMeaningfulDescription(description: string | null) {
        return /[\p{L}\p{N}]/u.test(description?.trim() ?? '');
    }

    const isOverdue = $derived(
        task.dueDate && task.status !== 'DONE' && new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0))
    );

    const taskCardClasses = $derived(
        `task-card-inner ${!isAnyDragging ? 'task-card-hoverable' : ''} ${isDragging ? 'task-card-dragging' : ''} ${task.status === 'DONE' ? 'task-card-done' : ''}`.trim()
    );
</script>

<div class="task-card" role="listitem" data-task-id={task.id} data-status={task.status}>
    <div
        class={taskCardClasses}
        onpointerdown={(e) => onPointerDown && onPointerDown(e, task.id)}
        onclick={(e) => {
            if (isAnyDragging) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            onEdit && onEdit(task.id);
        }}
        onkeydown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isAnyDragging && onEdit) {
                e.preventDefault();
                onEdit(task.id);
            }
        }}
        role="button"
        tabindex="0"
        aria-label={task.title}
    >
        <Card class="task-card-body task-card-border-none task-card-shadow-none task-card-bg-transparent">
            {#if isOverdue}
                <div class="task-card-overdue">● overdue</div>
            {/if}
            <p class="task-card-title">{task.title}</p>
            {#if hasMeaningfulDescription(task.description)}
                <div class="task-card-description task-card-description--clamped">{task.description}</div>
            {/if}
            {#if task.checklist && task.checklist.length > 0}
                <div class="task-card-checklist">
                    <div class="task-card-checklist-summary">
                        {task.checklist.filter((ci) => ci.done).length}/{task.checklist.length}
                    </div>
                </div>
            {/if}
            <div class="task-card-footer">
                {#if task.dueDate}
                    <div class="task-card-due mono">
                        <Calendar class="task-card-icon-xs" />
                        {fmtDate(task.dueDate)}
                    </div>
                {/if}
                {#if task.checklist && task.checklist.length > 0}
                    <span class="task-card-subtask-count mono">{task.checklist.filter((ci) => ci.done).length}/{task.checklist.length}</span
                    >
                {/if}
            </div>
        </Card>
    </div>

</div>
