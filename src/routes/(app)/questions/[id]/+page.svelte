<script lang="ts">
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import QuestionForm from '$lib/components/questions/QuestionForm.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Badge from '$lib/components/ui/Badge.svelte';
    import Card from '$lib/components/ui/Card.svelte';
    import { Trash2, ExternalLink } from 'lucide-svelte';
    import { enhance } from '$app/forms';
    import { showSuccessToast } from '$lib/stores/toast';
    import { fmtDate } from '$lib/utils/dates';
    import { titleCase } from '$lib/utils/format';
    import type { ActionData, PageData } from './$types';
    let { data, form }: { data: PageData; form: ActionData } = $props();
    let editing = $state(false);
</script>

<PageHeader title="Question">
    {#snippet actions()}
        <Badge>{titleCase(data.question.status)}</Badge>
        <Badge variant="outline">{titleCase(data.question.sourceType)}</Badge>
        <Button variant="outline" onclick={() => (editing = !editing)}>{editing ? 'Cancel' : 'Edit'}</Button>
        <form
            method="post"
            action="?/delete"
            use:enhance={() => {
                return async ({ result, update }) => {
                    await update();
                    if (result.type === 'redirect' || result.type === 'success') {
                        showSuccessToast('Question deleted');
                    }
                };
            }}
        >
            <Button type="submit" variant="destructive">
                {#snippet children()}<Trash2 class="qdetail-icon-sm" /> Delete{/snippet}
            </Button>
        </form>
    {/snippet}
</PageHeader>

{#if editing}
    <QuestionForm
        action="?/update"
        onenhance={() =>
            async ({ result, update }) => {
                await update();
                if (result.type === 'success') {
                    showSuccessToast('Question updated');
                    editing = false;
                }
            }}
        initial={{
            question: data.question.question,
            category: data.question.category,
            priority: data.question.priority,
            status: data.question.status,
            answer: data.question.answer,
            sourceType: data.question.sourceType,
            citationUrl: data.question.citationUrl,
            answeredAt: data.question.answeredAt
        }}
        submitLabel="Save changes"
        error={form?.error}
    />
{:else}
    <Card class="question-detail-card">
        <h2>{data.question.question}</h2>
        {#if data.question.category}
            <p class="question-detail-category">{data.question.category}</p>
        {/if}
    </Card>
    <Card class="question-detail-answer-card">
        <h3>Answer</h3>
        {#if data.question.answer}
            <p class="question-detail-answer-text">{data.question.answer}</p>
        {:else}
            <p class="qdetail-text-muted qdetail-italic">No answer yet.</p>
        {/if}
        {#if data.question.citationUrl}
            <a href={data.question.citationUrl} target="_blank" rel="noreferrer noopener" class="question-detail-source-link">
                <ExternalLink class="qdetail-icon-xs" /> Source
            </a>
        {/if}
        {#if data.question.answeredAt}
            <p class="qdetail-mt-2 qdetail-text-xs qdetail-text-muted">Answered {fmtDate(data.question.answeredAt)}</p>
        {/if}
    </Card>
{/if}
