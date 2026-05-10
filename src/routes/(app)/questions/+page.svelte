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

<PageHeader title="Questions" sub="Track unresolved questions, their sources, and answers." number={getPageNumber('/questions')}>
    {#snippet actions()}
        <Button onclick={() => (showCreateModal = true)}>
            {#snippet children()}<Plus style="width: 14px; height: 14px;" /> New question{/snippet}
        </Button>
    {/snippet}
</PageHeader>

<div class="questions-grid">
    {#each sections as section (section.label)}
        <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 16px; background: var(--surface);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span class="pill {section.class}">{section.label}</span>
                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--ink-3);">{section.items.length}</span>
            </div>

            {#each section.items as q (q.id)}
                <button
                    type="button"
                    onclick={async () => await updateUrl(q.id)}
                    class="card"
                    style="background: var(--surface-2); padding: 12px; border-radius: 12px; border: none; text-align: left; transition: opacity 120ms;"
                >
                    <p style="font-size: 13px; margin-bottom: 8px;">{q.question}</p>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        {#if q.category}<span class="pill s-note" style="font-size: 10px;">{q.category}</span>{/if}
                    </div>
                </button>
            {/each}

            <Button
                variant="ghost"
                size="sm"
                onclick={() => (showCreateModal = true)}
                style="justify-content: flex-start; margin-top: auto;"
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
                category: question.category,
                priority: question.priority,
                status: question.status,
                sourceType: question.sourceType,
                citationUrl: question.citationUrl,
                answer: question.answer,
                answeredAt: question.answeredAt
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
</style>
