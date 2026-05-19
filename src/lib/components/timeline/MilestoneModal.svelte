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
    import type { ManualEnhanceHandler } from '$lib/utils/enhanceSubmit';
    import type { TaskChecklistItem } from '$lib/tasks/taskChecklist';
    import { PHASE_LABELS } from '$lib/constants/phases';
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';
    import ThreeDotsMenu from '$lib/components/ui/ThreeDotsMenu.svelte';
    import { Trash2 } from 'lucide-svelte';
    import { showSuccessToast, showErrorToast } from '$lib/stores/toast';

    let {
        mode,
        open,
        onClose,
        action,
        defaultPhase,
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
        defaultPhase?: string;
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

    function onFormSubmit(_e: SubmitEvent) {
        if (newSubTaskDraft.trim()) {
            editableSubTasks = [
                ...editableSubTasks,
                {
                    id: crypto.randomUUID(),
                    text: newSubTaskDraft.trim(),
                    done: false,
                    order: editableSubTasks.length
                }
            ];
            newSubTaskDraft = '';
        }
    }

    const MILESTONE_ALLOWED = [
        'id',
        'title',
        'description',
        'phase',
        'status',
        'priority',
        'dueDate',
        'scheduledAt',
        'subTasks',
        'location'
    ] as const;

    const milestoneStatusOptions = [
        { value: 'To do', label: 'To do' },
        { value: 'Doing', label: 'Doing' },
        { value: 'On hold', label: 'On hold' },
        { value: 'Done', label: 'Done' }
    ];

    function val(name: string, fallback = '') {
        return fieldFromInitial(initial, MILESTONE_ALLOWED, name, fallback);
    }

    function milestoneStatusPillClass(status: string) {
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

    let editableSubTasks = $state<TaskChecklistItem[]>([]);
    let subTasksJson = $derived(JSON.stringify(editableSubTasks));
    let newSubTaskDraft = $state('');

    async function handleClose() {
        if (newSubTaskDraft.trim()) {
            editableSubTasks = [
                ...editableSubTasks,
                {
                    id: crypto.randomUUID(),
                    text: newSubTaskDraft.trim(),
                    done: false,
                    order: editableSubTasks.length
                }
            ];
            newSubTaskDraft = '';
            // Give a tiny bit of time for state to sync before close
            await new Promise((r) => setTimeout(r, 0));
        }
        await onClose();
    }

    let showLocationInput = $state(false);
    let showDueDatePicker = $state(false);
    let showAppointmentDatePicker = $state(false);
    let isEditingLocation = $state(false);

    let locationAddress = $state('');
    let dueDateValue = $state('');
    let appointmentDateValue = $state('');
    let currentLocation = $state('');

    let titleValue = $state('');
    let descriptionValue = $state('');
    let phaseValue = $state('PREPARATION');
    let statusValue = $state('To do');
    let priorityValue = $state('MEDIUM');

    let dueDateInputEl = $state<HTMLInputElement | null>(null);
    let scheduledAtInputEl = $state<HTMLInputElement | null>(null);

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
                showErrorToast('Failed to delete milestone');
                return;
            }

            if (result.type === 'success' || (result.type === 'redirect' && !result.error)) {
                void onClose();
                await onDeleteSuccess?.(id);
                showSuccessToast('Milestone deleted');
            } else {
                const data = result.data ? (typeof result.data === 'string' ? JSON.parse(result.data) : result.data) : {};
                showErrorToast(data.error || 'Failed to delete milestone');
            }
        } catch {
            showErrorToast('Failed to delete milestone');
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
                phaseValue = defaultPhase || 'PREPARATION';
                statusValue = 'To do';
                priorityValue = 'MEDIUM';
                editableSubTasks = [];
                newSubTaskDraft = '';
                dueDateValue = '';
                appointmentDateValue = '';
                currentLocation = '';
                locationAddress = '';
                showLocationInput = false;
                showDueDatePicker = false;
                showAppointmentDatePicker = false;
            } else {
                titleValue = val('title');
                descriptionValue = val('description');
                phaseValue = val('phase', 'PREPARATION');
                statusValue = val('status', 'To do');
                priorityValue = val('priority', 'MEDIUM');
                editableSubTasks = (initial.subTasks as TaskChecklistItem[]) || [];
                newSubTaskDraft = '';
                dueDateValue = val('dueDate');
                appointmentDateValue = val('scheduledAt');
                currentLocation = val('location', '');
                showLocationInput = false;
                showDueDatePicker = false;
                showAppointmentDatePicker = false;
                isEditingLocation = false;
            }
        } else if (mode === 'edit') {
            showLocationInput = false;
            showDueDatePicker = false;
            showAppointmentDatePicker = false;
            isEditingLocation = false;
        }
    });

    function handleLocationSave() {
        if (!locationAddress.trim()) return;
        currentLocation = locationAddress.trim();
        locationAddress = '';
        showLocationInput = false;
        isEditingLocation = false;
    }

    function handleDueDateSave() {
        if (dueDateInputEl) {
            dueDateInputEl.value = dueDateValue;
        }
        showDueDatePicker = false;
    }

    function handleAppointmentDateSave() {
        if (scheduledAtInputEl) {
            scheduledAtInputEl.value = appointmentDateValue;
        }
        showAppointmentDatePicker = false;
    }
</script>

{#snippet milestoneInlinePickers()}
    {#if showDueDatePicker}
        <div class="modal-mt-2 modal-flex modal-gap-2">
            <Input bind:value={dueDateValue} type="date" class="modal-text-sm" />
            <Button type="button" size="sm" onclick={handleDueDateSave}>Save</Button>
            <Button type="button" variant="ghost" size="sm" onclick={() => (showDueDatePicker = false)}>Cancel</Button>
        </div>
    {/if}
    {#if showAppointmentDatePicker}
        <div class="modal-mt-2 modal-flex modal-gap-2">
            <Input bind:value={appointmentDateValue} type="date" class="modal-text-sm" />
            <Button type="button" size="sm" onclick={handleAppointmentDateSave}>Save</Button>
            <Button type="button" variant="ghost" size="sm" onclick={() => (showAppointmentDatePicker = false)}>Cancel</Button>
        </div>
    {/if}
    {#if showLocationInput || isEditingLocation}
        <div class="modal-mt-2 modal-flex modal-gap-2">
            <Input
                bind:value={locationAddress}
                placeholder="Enter address..."
                class="modal-flex-1 modal-text-sm"
                onkeydown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLocationSave();
                    }
                }}
            />
            <Button type="button" size="sm" onclick={handleLocationSave}>Save</Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => {
                    showLocationInput = false;
                    isEditingLocation = false;
                    locationAddress = '';
                }}>Cancel</Button
            >
        </div>
    {/if}
{/snippet}

{#snippet milestoneEditHeader()}
    <span class="pill s-note">{PHASE_LABELS[phaseValue as keyof typeof PHASE_LABELS]}</span>
    <Select
        id="milestone-status"
        bind:value={statusValue}
        options={milestoneStatusOptions}
        ariaLabel="Milestone status"
        size="sm"
        menuClass="dropdown-menu--min-12rem"
        triggerClass={`milestone-status-trigger ${milestoneStatusPillClass(statusValue)}`}
    />
{/snippet}

{#snippet milestoneHeaderActions()}
    {#if mode === 'edit'}
        <ThreeDotsMenu items={menuItems} menuId="milestone-options" />
    {/if}
{/snippet}

{#snippet milestoneEditFooter()}
    <Button type="button" variant="ghost" onclick={handleClose} disabled={formState.submitting}>Cancel</Button>
    <Button type="submit" form="milestone-edit-form" class="modal-footer-save" loading={formState.submitting}>Save changes</Button>
{/snippet}

{#if mode === 'create'}
    <Dialog
        {open}
        onClose={handleClose}
        ariaLabel="Create milestone"
        header={milestoneEditHeader}
        footerFormId="milestone-create-form"
        cancelLabel="Cancel"
        submitLabel="Create milestone"
        submitting={formState.submitting}
    >
        <form
            id="milestone-create-form"
            method="post"
            {action}
            use:enhance={submitEnhance!}
            onsubmit={onFormSubmit}
            class="modal-form"
        >
            <div class="modal-title-row">
                <Input name="title" bind:value={titleValue} class="modal-title-input display" placeholder="Milestone title" required />
            </div>

            {@render milestoneInlinePickers()}

            <div class="modal-description-section">
                <Textarea
                    name="description"
                    bind:value={descriptionValue}
                    placeholder="Add a more detailed description..."
                    rows={4}
                    class="modal-description-textarea"
                />
            </div>

            <TaskChecklistEditor bind:items={editableSubTasks} bind:newChecklistText={newSubTaskDraft} />

            {#if error}
                <div class="modal-error">
                    <ErrorDetails status={400} message={error} errorId={errorId ?? undefined} />
                </div>
            {/if}
            <input type="hidden" name="subTasks" value={subTasksJson} />
            <input type="hidden" name="location" value={currentLocation} />
            <input type="hidden" name="dueDate" value={dueDateValue} />
            <input type="hidden" name="scheduledAt" value={appointmentDateValue} />
            <input type="hidden" name="phase" value={phaseValue} />
            <input type="hidden" name="status" value={statusValue} />
            <input type="hidden" name="priority" value={priorityValue} />
        </form>
    </Dialog>
{:else}
    <Dialog
        {open}
        onClose={handleClose}
        ariaLabel="Edit milestone"
        header={milestoneEditHeader}
        headerActions={milestoneHeaderActions}
        footer={milestoneEditFooter}
        submitting={formState.submitting}
    >
        <form id="milestone-edit-form" method="post" {action} use:enhance={submitEnhance!} onsubmit={onFormSubmit} class="modal-form">
            <div class="modal-title-row">
                <Input name="title" bind:value={titleValue} class="modal-title-input display" placeholder="Milestone title" />
            </div>

            {@render milestoneInlinePickers()}

            <div class="modal-description-section">
                <Textarea
                    name="description"
                    bind:value={descriptionValue}
                    placeholder="Add a more detailed description..."
                    rows={4}
                    class="modal-description-textarea"
                />
            </div>

            <TaskChecklistEditor bind:items={editableSubTasks} bind:newChecklistText={newSubTaskDraft} />

            {#if error}<ErrorDetails status={400} message={error} errorId={errorId ?? undefined} />{/if}
            <input type="hidden" name="subTasks" value={subTasksJson} />
            <input type="hidden" name="id" value={val('id')} />
            <input type="hidden" name="dueDate" value={dueDateValue} bind:this={dueDateInputEl} />
            <input type="hidden" name="scheduledAt" value={appointmentDateValue} bind:this={scheduledAtInputEl} />
            <input type="hidden" name="location" value={currentLocation} />
            <input type="hidden" name="phase" value={phaseValue} />
            <input type="hidden" name="status" value={statusValue} />
            <input type="hidden" name="priority" value={priorityValue} />
        </form>
    </Dialog>
{/if}

<style>
    :global(button.milestone-status-trigger) {
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

    :global(button.milestone-status-trigger .select-trigger-label) {
        text-transform: none;
    }

    :global(button.milestone-status-trigger .select-trigger-chevron) {
        opacity: 0.75;
        width: 12px;
        height: 12px;
    }

    :global(button.milestone-status-trigger.s-active) {
        background: var(--peri);
        color: var(--peri-d);
        border-color: color-mix(in srgb, var(--peri-d) 18%, transparent);
    }

    :global(button.milestone-status-trigger.s-active:hover) {
        background: color-mix(in srgb, var(--peri) 82%, var(--peri-d) 18%);
        border-color: color-mix(in srgb, var(--peri-d) 24%, transparent);
    }

    :global(button.milestone-status-trigger.s-done) {
        background: var(--sage);
        color: var(--sage-d);
        border-color: color-mix(in srgb, var(--sage-d) 18%, transparent);
    }

    :global(button.milestone-status-trigger.s-done:hover) {
        background: color-mix(in srgb, var(--sage) 80%, var(--sage-d) 20%);
        border-color: color-mix(in srgb, var(--sage-d) 24%, transparent);
    }

    :global(button.milestone-status-trigger.s-note) {
        background: var(--surface-3);
        color: var(--ink-2);
        border-color: color-mix(in srgb, var(--ink-2) 10%, transparent);
    }

    :global(button.milestone-status-trigger.s-note:hover) {
        background: color-mix(in srgb, var(--surface-3) 86%, var(--ink-2) 14%);
        border-color: color-mix(in srgb, var(--ink-2) 16%, transparent);
    }

    :global(button.milestone-status-trigger.s-waiting) {
        background: var(--butter);
        color: var(--butter-d);
        border-color: color-mix(in srgb, var(--butter-d) 18%, transparent);
    }

    :global(button.milestone-status-trigger.s-waiting:hover) {
        background: color-mix(in srgb, var(--butter) 80%, var(--butter-d) 20%);
        border-color: color-mix(in srgb, var(--butter-d) 24%, transparent);
    }

    :global(button.milestone-status-trigger.s-urgent) {
        background: var(--blush);
        color: var(--blush-d);
        border-color: color-mix(in srgb, var(--blush-d) 18%, transparent);
    }

    :global(button.milestone-status-trigger.s-urgent:hover) {
        background: color-mix(in srgb, var(--blush) 80%, var(--blush-d) 20%);
        border-color: color-mix(in srgb, var(--blush-d) 24%, transparent);
    }
</style>
