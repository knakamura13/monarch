<script lang="ts">
    import Input from '$lib/components/ui/Input.svelte';
    import Textarea from '$lib/components/ui/Textarea.svelte';
    import Select from '$lib/components/ui/Select.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Dialog from '$lib/components/ui/Dialog.svelte';
    import ErrorDetails from '$lib/components/ErrorDetails.svelte';
    import TaskChecklistEditor from '$lib/components/tasks/TaskChecklistEditor.svelte';
    import { fieldFromInitial } from '$lib/utils/initialFields';
    import { createFormState } from '$lib/utils/formState.svelte';
    import { taskStatusPillClass } from '$lib/tasks/taskStatusDisplay';
    import { parseTaskChecklist, type TaskChecklistItem } from '$lib/tasks/taskChecklist';
    import type { ManualEnhanceHandler } from '$lib/utils/enhanceSubmit';
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';
    import ThreeDotsMenu from '$lib/components/ui/ThreeDotsMenu.svelte';
    import { Trash2, Calendar, X } from 'lucide-svelte';
    import { showSuccessToast, showErrorToast } from '$lib/stores/toast';
    import { parseISO, differenceInCalendarDays } from 'date-fns';
    import { fmtDate } from '$lib/utils/dates';

    let {
        mode,
        open,
        onClose,
        action,
        defaultStatus,
        initial = {},
        error,
        errorId,
        onenhance,
        onDeleteSuccess
    }: {
        mode: 'create' | 'edit';
        open: boolean;
        onClose: () => void | Promise<void>;
        action: string;
        defaultStatus?: string;
        initial?: Record<string, unknown>;
        error?: string;
        errorId?: string;
        onenhance?: SubmitFunction | ManualEnhanceHandler;
        onDeleteSuccess?: (id: string) => void | Promise<void>;
    } = $props();

    const formState = createFormState();

    const submitEnhance = $derived<SubmitFunction | undefined>(
        onenhance
            ? (args) => {
                  formState.start();
                  const resultHandler = (onenhance as SubmitFunction)(args);
                  return async (resultArgs) => {
                      try {
                          if (resultHandler) {
                              const inner = await resultHandler;
                              if (typeof inner === 'function') {
                                  await inner(resultArgs);
                              }
                          }
                      } finally {
                          formState.stop();
                      }
                  };
              }
            : undefined
    );

    const TASK_ALLOWED = ['id', 'title', 'description', 'status', 'priority', 'dueDate', 'checklist'] as const;

    const taskStatusOptions = [
        { value: 'To do', label: 'To do' },
        { value: 'Doing', label: 'Doing' },
        { value: 'On hold', label: 'On hold' },
        { value: 'Done', label: 'Done' }
    ];

    function val(name: string, fallback = '') {
        return fieldFromInitial(initial, TASK_ALLOWED, name, fallback);
    }

    let editableChecklist = $state<TaskChecklistItem[]>([]);
    let checklistJson = $derived(JSON.stringify(editableChecklist));

    let dueDateValue = $state('');
    let titleValue = $state('');
    let descriptionValue = $state('');
    let statusValue = $state('To do');
    let priorityValue = $state('MEDIUM');

    let dateInput: HTMLInputElement;

    const statusPillClass = $derived(() => taskStatusPillClass(statusValue));

    const dueDateLabel = $derived(() => {
        if (!dueDateValue) return 'Due date';
        const date = parseISO(dueDateValue);
        const today = new Date();
        const diff = differenceInCalendarDays(date, today);

        if (diff < 0) return 'Overdue';
        if (diff === 0) return 'Due today';
        if (diff === 1) return 'Due tomorrow';
        if (diff > 0 && diff < 14) return `Due in ${diff} days`;
        return `Due ${fmtDate(date)}`;
    });

    const dueDateClass = $derived(() => {
        if (!dueDateValue) return '';
        const date = parseISO(dueDateValue);
        const diff = differenceInCalendarDays(date, new Date());
        if (diff < 0) return 'is-overdue';
        if (diff === 0) return 'is-due-today';
        if (diff <= 3) return 'is-due-soon';
        return '';
    });

    async function handleDelete() {
        const id = val('id');
        if (!id) return;

        formState.start();

        try {
            const formData = new FormData();
            formData.set('id', id);

            const response = await fetch(`${action.split('?')[0]}?/delete`, {
                method: 'POST',
                body: formData
            });

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch {
                // SvelteKit might return a non-JSON response in some error cases
                showErrorToast('Failed to delete task');
                return;
            }

            if (result.type === 'success' || (result.type === 'redirect' && !result.error)) {
                void onClose();
                await onDeleteSuccess?.(id);
                showSuccessToast('Task deleted');
            } else {
                const data = result.data ? (typeof result.data === 'string' ? JSON.parse(result.data) : result.data) : {};
                showErrorToast(data.error || 'Failed to delete task');
            }
        } catch {
            showErrorToast('Failed to delete task');
        } finally {
            formState.stop();
        }
    }

    const menuItems = $derived([
        {
            label: 'Delete',
            icon: Trash2,
            variant: 'destructive' as const,
            action: handleDelete
        }
    ]);

    $effect(() => {
        if (open) {
            if (mode === 'create') {
                titleValue = '';
                descriptionValue = '';
                statusValue = defaultStatus || 'To do';
                priorityValue = 'MEDIUM';
                dueDateValue = '';
                editableChecklist = [];
            } else {
                titleValue = val('title');
                descriptionValue = val('description');
                statusValue = val('status', 'To do');
                priorityValue = val('priority', 'MEDIUM');
                editableChecklist = parseTaskChecklist(initial.checklist);
                dueDateValue = val('dueDate');
            }
        }
    });
</script>

{#snippet taskHeader()}
    <Select
        id="task-status"
        bind:value={statusValue}
        options={taskStatusOptions}
        ariaLabel="Task status"
        size="sm"
        menuClass="dropdown-menu--min-12rem"
        triggerClass={`task-status-trigger ${statusPillClass()}`}
    />
    <div class="task-date-picker-wrapper">
        <Button
            type="button"
            variant="ghost"
            size="sm"
            class={`task-date-trigger ${dueDateClass()}`}
            onclick={() => dateInput.showPicker()}
        >
            <Calendar size={14} class="task-date-icon" />
            <span class="select-trigger-label">{dueDateLabel()}</span>
            {#if dueDateValue}
                <button
                    type="button"
                    class="task-date-clear"
                    onclick={(e) => {
                        e.stopPropagation();
                        dueDateValue = '';
                    }}
                    aria-label="Clear date"
                >
                    <X size={12} />
                </button>
            {/if}
        </Button>
        <input bind:this={dateInput} type="date" class="hidden-date-input" bind:value={dueDateValue} />
    </div>
{/snippet}

{#snippet taskHeaderActions()}
    {#if mode === 'edit'}
        <ThreeDotsMenu items={menuItems} menuId="task-options" />
    {/if}
{/snippet}

{#snippet taskEditFooter()}
    <Button type="button" variant="ghost" onclick={onClose} disabled={formState.submitting}>Cancel</Button>
    <Button type="submit" form="task-edit-form" class="modal-footer-save" loading={formState.submitting}>Save changes</Button>
{/snippet}

{#if mode === 'create'}
    <Dialog
        {open}
        {onClose}
        ariaLabel="Create task"
        header={taskHeader}
        footerFormId="task-create-form"
        cancelLabel="Cancel"
        cancelVariant="ghost"
        submitLabel="Create task"
        submitClass="modal-footer-save"
        submitting={formState.submitting}
    >
        <form id="task-create-form" method="post" {action} use:enhance={submitEnhance!} class="modal-form">
            <input type="hidden" name="status" value={statusValue} />
            <input type="hidden" name="priority" value={priorityValue} />
            <input type="hidden" name="checklist" value={checklistJson} />
            <input type="hidden" name="dueDate" value={dueDateValue} />

            <div class="modal-title-row">
                <Input name="title" bind:value={titleValue} class="modal-title-input display" placeholder="Task title" required />
            </div>

            <div class="modal-description-section">
                <Textarea
                    name="description"
                    bind:value={descriptionValue}
                    placeholder="Add a more detailed description..."
                    rows={4}
                    class="modal-description-textarea"
                />
            </div>

            <TaskChecklistEditor bind:items={editableChecklist} />

            {#if error}
                <ErrorDetails status={400} message={error} errorId={errorId ?? undefined} />
            {/if}
        </form>
    </Dialog>
{:else}
    <Dialog
        {open}
        {onClose}
        ariaLabel="Edit task"
        header={taskHeader}
        headerActions={taskHeaderActions}
        footer={taskEditFooter}
        submitting={formState.submitting}
    >
        <form id="task-edit-form" method="post" {action} use:enhance={submitEnhance!} class="modal-form">
            <input type="hidden" name="status" value={statusValue} />
            <input type="hidden" name="priority" value={priorityValue} />
            <input type="hidden" name="checklist" value={checklistJson} />
            <input type="hidden" name="dueDate" value={dueDateValue} />
            <input type="hidden" name="id" value={val('id')} />

            <div class="modal-title-row">
                <Input name="title" bind:value={titleValue} class="modal-title-input display" placeholder="Task title" />
            </div>

            <div class="modal-description-section">
                <Textarea
                    name="description"
                    bind:value={descriptionValue}
                    placeholder="Add a more detailed description..."
                    rows={4}
                    class="modal-description-textarea"
                />
            </div>

            <TaskChecklistEditor bind:items={editableChecklist} />

            {#if error}<ErrorDetails status={400} message={error} errorId={errorId ?? undefined} />{/if}
        </form>
    </Dialog>
{/if}

<style>
    :global(button.task-status-trigger) {
        height: 24px;
        min-height: 24px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid transparent;
        font-size: 11px;
        font-weight: 600;
        gap: 6px;
        box-shadow: none;
    }

    :global(button.task-status-trigger .select-trigger-label) {
        text-transform: none;
    }

    :global(button.task-status-trigger .select-trigger-chevron) {
        opacity: 0.75;
        width: 12px;
        height: 12px;
    }

    :global(button.task-status-trigger.s-active) {
        background: var(--peri);
        color: var(--peri-d);
        border-color: color-mix(in srgb, var(--peri-d) 18%, transparent);
    }

    :global(button.task-status-trigger.s-active:hover) {
        background: color-mix(in srgb, var(--peri) 82%, var(--peri-d) 18%);
        border-color: color-mix(in srgb, var(--peri-d) 24%, transparent);
    }

    :global(button.task-status-trigger.s-done) {
        background: var(--sage);
        color: var(--sage-d);
        border-color: color-mix(in srgb, var(--sage-d) 18%, transparent);
    }

    :global(button.task-status-trigger.s-done:hover) {
        background: color-mix(in srgb, var(--sage) 80%, var(--sage-d) 20%);
        border-color: color-mix(in srgb, var(--sage-d) 24%, transparent);
    }

    :global(button.task-status-trigger.s-note) {
        background: var(--surface-3);
        color: var(--ink-2);
        border-color: color-mix(in srgb, var(--ink-2) 10%, transparent);
    }

    :global(button.task-status-trigger.s-note:hover) {
        background: color-mix(in srgb, var(--surface-3) 86%, var(--ink-2) 14%);
        border-color: color-mix(in srgb, var(--ink-2) 16%, transparent);
    }

    :global(button.task-status-trigger.s-waiting) {
        background: var(--blush);
        color: var(--blush-d);
        border-color: color-mix(in srgb, var(--blush-d) 18%, transparent);
    }

    :global(button.task-status-trigger.s-waiting:hover) {
        background: color-mix(in srgb, var(--blush) 80%, var(--blush-d) 20%);
        border-color: color-mix(in srgb, var(--blush-d) 24%, transparent);
    }

    .task-date-picker-wrapper {
        position: relative;
        display: inline-block;
    }

    .hidden-date-input {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        pointer-events: none;
        visibility: hidden;
    }

    :global(button.task-date-trigger) {
        height: 24px;
        min-height: 24px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid var(--hairline);
        font-size: 11px;
        font-weight: 600;
        gap: 6px;
        background: var(--surface-2);
        color: var(--ink-2);
        box-shadow: none;
        display: inline-flex;
        align-items: center;
    }

    :global(button.task-date-trigger:hover) {
        background: var(--surface-3);
        border-color: var(--ink-3);
    }

    :global(button.task-date-trigger.is-overdue) {
        background: var(--blush);
        color: var(--blush-d);
        border-color: color-mix(in srgb, var(--blush-d) 18%, transparent);
    }

    :global(button.task-date-trigger.is-overdue:hover) {
        background: color-mix(in srgb, var(--blush) 82%, var(--blush-d) 18%);
    }

    :global(button.task-date-trigger.is-due-today) {
        background: var(--peri);
        color: var(--peri-d);
        border-color: color-mix(in srgb, var(--peri-d) 18%, transparent);
    }

    :global(button.task-date-trigger.is-due-today:hover) {
        background: color-mix(in srgb, var(--peri) 82%, var(--peri-d) 18%);
    }

    :global(button.task-date-trigger.is-due-soon) {
        background: var(--surface-3);
        color: var(--ink-1);
        border-color: var(--ink-3);
    }

    .task-date-clear {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2px;
        margin-right: -4px;
        border-radius: 4px;
        color: inherit;
        opacity: 0.5;
        transition: opacity 0.2s;
        border: none;
        outline: none;
        background: transparent;
        cursor: pointer;
    }

    .task-date-clear:hover {
        opacity: 1;
        background: color-mix(in srgb, currentColor 10%, transparent);
    }
</style>
