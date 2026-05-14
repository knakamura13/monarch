<script lang="ts">
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import QuestionModal from '$lib/components/questions/QuestionModal.svelte';
    import { Plus } from 'lucide-svelte';
    import { page } from '$app/state';
    import { invalidateAll, goto } from '$app/navigation';
    import { showSuccessToast } from '$lib/stores/toast';
    import { getPageNumber } from '$lib/constants/navigation';
    import type { PageData } from './$types';

    interface QuestionsPageData extends PageData {
        members: { id: string; name: string | null; email: string }[];
    }

    let { data, form }: { data: QuestionsPageData; form: { error?: string; errorId?: string } } = $props();

    let showCreateModal = $state(false);
    const editParam = $derived(page.url.searchParams.get('edit'));
    const editingQuestion = $derived(editParam && data.items.some((q) => q.id === editParam) ? { id: editParam } : null);

    async function updateUrl(id: string | null) {
        const url = new URL(window.location.href);
        if (id) {
            url.searchParams.set('edit', id);
        } else {
            url.searchParams.delete('edit');
        }
        await goto(url.toString(), { replaceState: true, noScroll: true });
    }

    const sections = $derived([
        { label: 'Official sources', items: data.official, class: 's-waiting' },
        { label: 'Community / anecdotal', items: data.community, class: 's-active' },
        { label: 'Other', items: data.other, class: 's-note' }
    ]);
</script>

<PageHeader title="Questions" sub="Track unresolved questions, their sources, and answers." number={getPageNumber('/questions')} />

<div class="questions-grid">
    {#each sections as section (section.label)}
        <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 16px; background: var(--surface);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span class="pill {section.class}">{section.label}</span>
                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--ink-3);">{section.items.length}</span>
            </div>

            {#each section.items as q (q.id)}
                <button type="button" onclick={async () => await updateUrl(q.id)} class="question-card">
                    <p class="question-text">{q.question}</p>
                </button>
            {/each}

            <Button
                variant="ghost"
                size="sm"
                onclick={() => (showCreateModal = true)}
                class="ask-button"
            >
                <Plus style="width: 14px; height: 14px;" /> Ask a question
            </Button>
        </div>
    {/each}
</div>

{#if editingQuestion}
    {@const question = data.items.find((q) => q.id === editingQuestion?.id)}
    {#if question}
        <QuestionModal
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
                        showSuccessToast('Question updated successfully');
                        await updateUrl(null);
                    } else {
                        cancel();
                    }
                };
            }}
            initial={{
                id: question.id,
                question: question.question,
                priority: question.priority,
                status: question.status,
                sourceType: question.sourceType,
                answer: question.answer,
                answeredAt: question.answeredAt
            }}
            onDeleteSuccess={async () => {
                await invalidateAll();
                await updateUrl(null);
            }}
            error={form?.error}
            errorId={form?.errorId}
        />
    {/if}
{/if}

{#if showCreateModal}
    <QuestionModal
        mode="create"
        open={true}
        onClose={() => {
            showCreateModal = false;
        }}
        action="?/create"
        members={data.members}
        error={form?.error}
        errorId={form?.errorId}
        onenhance={() => {
            return async ({ result }: { result: { type: string } }) => {
                if (result.type === 'success') {
                    showCreateModal = false;
                    await invalidateAll();
                    showSuccessToast('Question created successfully');
                }
            };
        }}
    />
{/if}

<style>
    .questions-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        padding-bottom: max(32px, env(safe-area-inset-bottom, 0px));
    }

    @media (min-width: 768px) {
        .questions-grid {
            grid-template-columns: repeat(3, 1fr);
        }
    }

    .question-card {
        background: var(--surface-2);
        padding: 12px;
        border-radius: 12px;
        border: 1px solid transparent;
        text-align: left;
        transition: all 120ms ease;
        cursor: pointer;
        display: block;
        width: 100%;
    }

    .question-card:hover {
        background: var(--surface-3);
        border-color: var(--hairline);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px color-mix(in srgb, var(--ink-1) 5%, transparent);
    }

    .question-card:active {
        transform: translateY(0);
        background: var(--surface-3);
    }

    .question-text {
        font-size: 13px;
        color: var(--ink-1);
        line-height: 1.4;
    }

    :global(.ask-button) {
        justify-content: flex-start !important;
        margin-top: auto !important;
    }
</style>
