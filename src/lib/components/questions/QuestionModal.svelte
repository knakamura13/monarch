<script lang="ts">
    import Input from '$lib/components/ui/Input.svelte';
    import Textarea from '$lib/components/ui/Textarea.svelte';
    import Select from '$lib/components/ui/Select.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Dialog from '$lib/components/ui/Dialog.svelte';
    import ErrorDetails from '$lib/components/ErrorDetails.svelte';
    import { fieldFromInitial } from '$lib/utils/initialFields';
    import { createFormState } from '$lib/utils/formState.svelte';
    import { questionStatusLabel, questionStatusPillClass } from '$lib/questions/questionStatusDisplay';
    import type { ManualEnhanceHandler } from '$lib/utils/enhanceSubmit';
    import { HelpCircle, Trash2, Calendar, X } from 'lucide-svelte';
    import { showSuccessToast, showErrorToast } from '$lib/stores/toast';
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';
    import ThreeDotsMenu from '$lib/components/ui/ThreeDotsMenu.svelte';
    import { parseISO } from 'date-fns';
    import { fmtDate } from '$lib/utils/dates';

    let {
        mode,
        open,
        onClose,
        action,
        members: _members,
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
        members?: { id: string; name: string | null; email: string }[];
        initial?: Record<string, unknown>;
        error?: string;
        errorId?: string;
        onenhance?: SubmitFunction | ManualEnhanceHandler;
        onDeleteSuccess?: (id: string) => void | Promise<void>;
    } = $props();

    const formState = createFormState();

    const submitEnhance = $derived<SubmitFunction>((args) => {
        formState.start();
        const handler = (onenhance as SubmitFunction) || (() => async ({ update }) => { await update(); });
        const innerPromise = handler(args);
        return async (resultArgs) => {
            try {
                const inner = await innerPromise;
                if (inner) await (inner as any)(resultArgs);
                if (resultArgs.result.type === 'success' && mode === 'create') {
                    showSuccessToast('Question created');
                }
            } finally {
                formState.stop();
            }
        };
    });

    const QUESTION_ALLOWED = [
        'id',
        'question',
        'category',
        'priority',
        'status',
        'sourceType',
        'citationUrl',
        'answer',
        'answeredAt'
    ] as const;

    const questionPriorityOptions = [
        { value: 'LOW', label: 'Low' },
        { value: 'MEDIUM', label: 'Medium' },
        { value: 'HIGH', label: 'High' },
        { value: 'CRITICAL', label: 'Critical' }
    ];
    const questionStatusOptions = [
        { value: 'OPEN', label: 'Open' },
        { value: 'RESEARCHING', label: 'Researching' },
        { value: 'ANSWERED', label: 'Answered' },
        { value: 'WONT_FIX', label: "Won't pursue" }
    ];
    const questionSourceTypeOptions = [
        { value: 'ATTORNEY', label: 'Attorney' },
        { value: 'NONPROFIT', label: 'Nonprofit' },
        { value: 'USCIS_SITE', label: 'USCIS site' },
        { value: 'COUNTY_SITE', label: 'County site' },
        { value: 'COMMUNITY', label: 'Community' },
        { value: 'OTHER', label: 'Other' }
    ];

    function val(name: string, fallback = '') {
        return fieldFromInitial(initial, QUESTION_ALLOWED, name, fallback);
    }

    let questionValue = $state('');
    let priorityValue = $state('MEDIUM');
    let statusValue = $state('OPEN');
    let sourceTypeValue = $state('OTHER');
    let answerValue = $state('');
    let answeredAtValue = $state('');

    let dateInput = $state<HTMLInputElement>();

    const statusPillClass = $derived(() => questionStatusPillClass(statusValue));
    const statusLabel = $derived(() => questionStatusLabel(statusValue));

    const answeredAtLabel = $derived(() => {
        if (!answeredAtValue) return 'Answered on';
        const date = parseISO(answeredAtValue);
        return `Ans. ${fmtDate(date)}`;
    });

    const priorityPillClass = $derived(() => {
        switch (priorityValue) {
            case 'LOW':
                return 's-note';
            case 'MEDIUM':
                return 's-active';
            case 'HIGH':
                return 's-waiting';
            case 'CRITICAL':
                return 's-urgent';
            default:
                return '';
        }
    });

    const sourceTypePillClass = $derived(() => {
        switch (sourceTypeValue) {
            case 'ATTORNEY':
            case 'NONPROFIT':
                return 's-active';
            case 'USCIS_SITE':
            case 'COUNTY_SITE':
                return 's-waiting';
            case 'COMMUNITY':
            case 'OTHER':
                return 's-note';
            default:
                return '';
        }
    });

    async function handleDelete() {
        const id = val('id');
        if (!id) return;

        if (!confirm('Are you sure you want to delete this question?')) return;

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
                showErrorToast('Failed to delete question');
                return;
            }

            if (result.type === 'success' || (result.type === 'redirect' && !result.error)) {
                void onClose();
                await onDeleteSuccess?.(id);
                showSuccessToast('Question deleted');
            } else {
                const data = result.data ? (typeof result.data === 'string' ? JSON.parse(result.data) : result.data) : {};
                showErrorToast(data.error || 'Failed to delete question');
            }
        } catch {
            showErrorToast('Failed to delete question');
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
                questionValue = '';
                priorityValue = 'MEDIUM';
                statusValue = 'OPEN';
                sourceTypeValue = 'OTHER';
                answerValue = '';
                answeredAtValue = '';
            } else {
                questionValue = val('question');
                priorityValue = val('priority', 'MEDIUM');
                statusValue = val('status', 'OPEN');
                sourceTypeValue = val('sourceType', 'OTHER');
                answerValue = val('answer');
                answeredAtValue = val('answeredAt');
            }
        }
    });
</script>

{#snippet questionHeader()}
    <div class="modal-header-pills">
        <Select
            id="question-status"
            bind:value={statusValue}
            options={questionStatusOptions}
            ariaLabel="Question status"
            size="sm"
            menuClass="dropdown-menu--min-12rem"
            triggerClass={`header-pill-trigger ${statusPillClass()}`}
        />
        <Select
            id="question-priority"
            bind:value={priorityValue}
            options={questionPriorityOptions}
            ariaLabel="Question priority"
            size="sm"
            menuClass="dropdown-menu--min-12rem"
            triggerClass={`header-pill-trigger ${priorityPillClass()}`}
        />
        <Select
            id="question-source"
            bind:value={sourceTypeValue}
            options={questionSourceTypeOptions}
            ariaLabel="Source type"
            size="sm"
            menuClass="dropdown-menu--min-12rem"
            triggerClass={`header-pill-trigger ${sourceTypePillClass()}`}
        />

        <div class="date-picker-wrapper">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                class="header-pill-trigger date-pill-trigger"
                onclick={() => dateInput?.showPicker()}
            >
                <Calendar size={14} class="date-icon" />
                <span class="select-trigger-label">{answeredAtLabel()}</span>
                {#if answeredAtValue}
                    <button
                        type="button"
                        class="date-clear"
                        onclick={(e) => {
                            e.stopPropagation();
                            answeredAtValue = '';
                        }}
                        aria-label="Clear date"
                    >
                        <X size={12} />
                    </button>
                {/if}
            </Button>
            <input bind:this={dateInput} type="date" class="hidden-date-input" bind:value={answeredAtValue} />
        </div>
    </div>
{/snippet}

{#snippet questionHeaderActions()}
    {#if mode === 'edit'}
        <ThreeDotsMenu items={menuItems} menuId="question-options" />
    {/if}
{/snippet}

{#snippet questionFooter()}
    <Button type="button" variant="ghost" onclick={onClose} disabled={formState.submitting}>Cancel</Button>
    <Button type="submit" form="question-form" class="modal-footer-save" loading={formState.submitting}>
        {mode === 'create' ? 'Add question' : 'Save changes'}
    </Button>
{/snippet}

<Dialog
    {open}
    {onClose}
    ariaLabel={mode === 'create' ? 'New question' : 'Edit question'}
    header={questionHeader}
    headerActions={questionHeaderActions}
    footer={questionFooter}
    submitting={formState.submitting}
>
    <form id="question-form" method="post" {action} use:enhance={submitEnhance!} class="modal-form">
        <input type="hidden" name="id" value={val('id')} />
        <input type="hidden" name="status" value={statusValue} />
        <input type="hidden" name="priority" value={priorityValue} />
        <input type="hidden" name="sourceType" value={sourceTypeValue} />
        <input type="hidden" name="answeredAt" value={answeredAtValue} />

        <div class="modal-title-row">
            <HelpCircle class="modal-icon-sm" />
            <Input name="question" bind:value={questionValue} class="modal-title-input display" placeholder="Question" required />
        </div>

        <div class="modal-description-section">
            <span class="modal-metadata-label">Answer</span>
            <Textarea
                name="answer"
                bind:value={answerValue}
                placeholder="Enter answer..."
                rows={5}
                class="modal-description-textarea"
            />
        </div>

        {#if error}
            <div class="modal-error">
                <ErrorDetails status={400} message={error} errorId={errorId ?? undefined} />
            </div>
        {/if}
    </form>
</Dialog>

<style>
    .modal-header-pills {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }

    .date-picker-wrapper {
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

    :global(button.header-pill-trigger) {
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

    :global(button.header-pill-trigger .select-trigger-label) {
        text-transform: none;
    }

    :global(button.header-pill-trigger .select-trigger-chevron) {
        opacity: 0.75;
        width: 12px;
        height: 12px;
    }

    :global(button.header-pill-trigger.s-active) {
        background: var(--peri);
        color: var(--peri-d);
        border-color: color-mix(in srgb, var(--peri-d) 18%, transparent);
    }

    :global(button.header-pill-trigger.s-active:hover) {
        background: color-mix(in srgb, var(--peri) 82%, var(--peri-d) 18%);
        border-color: color-mix(in srgb, var(--peri-d) 24%, transparent);
    }

    :global(button.header-pill-trigger.s-done) {
        background: var(--sage);
        color: var(--sage-d);
        border-color: color-mix(in srgb, var(--sage-d) 18%, transparent);
    }

    :global(button.header-pill-trigger.s-done:hover) {
        background: color-mix(in srgb, var(--sage) 80%, var(--sage-d) 20%);
        border-color: color-mix(in srgb, var(--sage-d) 24%, transparent);
    }

    :global(button.header-pill-trigger.s-note) {
        background: var(--surface-3);
        color: var(--ink-2);
        border-color: color-mix(in srgb, var(--ink-2) 10%, transparent);
    }

    :global(button.header-pill-trigger.s-note:hover) {
        background: color-mix(in srgb, var(--surface-3) 86%, var(--ink-2) 14%);
        border-color: color-mix(in srgb, var(--ink-2) 16%, transparent);
    }

    :global(button.header-pill-trigger.s-waiting) {
        background: var(--butter);
        color: var(--butter-d);
        border-color: color-mix(in srgb, var(--butter-d) 18%, transparent);
    }

    :global(button.header-pill-trigger.s-waiting:hover) {
        background: color-mix(in srgb, var(--butter) 80%, var(--butter-d) 20%);
        border-color: color-mix(in srgb, var(--butter-d) 24%, transparent);
    }

    :global(button.header-pill-trigger.s-urgent) {
        background: var(--blush);
        color: var(--blush-d);
        border-color: color-mix(in srgb, var(--blush-d) 18%, transparent);
    }

    :global(button.header-pill-trigger.s-urgent:hover) {
        background: color-mix(in srgb, var(--blush) 80%, var(--blush-d) 20%);
        border-color: color-mix(in srgb, var(--blush-d) 24%, transparent);
    }

    :global(button.header-pill-trigger.date-pill-trigger) {
        border-color: var(--hairline);
        background: var(--surface-2);
        color: var(--ink-2);
        font-weight: 500;
    }

    :global(button.header-pill-trigger.date-pill-trigger:hover) {
        background: var(--surface-3);
        border-color: var(--ink-3);
    }

    .date-icon {
        flex-shrink: 0;
        opacity: 0.65;
    }

    .date-clear {
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

    .date-clear:hover {
        opacity: 1;
        background: color-mix(in srgb, currentColor 10%, transparent);
    }
</style>
