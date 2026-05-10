<script lang="ts">
    import Input from '$lib/components/ui/Input.svelte';
    import Textarea from '$lib/components/ui/Textarea.svelte';
    import Select from '$lib/components/ui/Select.svelte';
    import Label from '$lib/components/ui/Label.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';

    let {
        initial = {},
        submitLabel = 'Save',
        error,
        action,
        onenhance
    }: {
        initial?: Record<string, unknown>;
        submitLabel?: string;
        error?: string | null;
        action?: string;
        onenhance?: SubmitFunction;
    } = $props();

    function val(name: string, fallback = '') {
        const v = initial[name as keyof typeof initial];
        if (v == null) return fallback;
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return String(v);
    }

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

    let priorityField = $state(val('priority', 'MEDIUM'));
    let statusField = $state(val('status', 'OPEN'));
    let sourceTypeField = $state(val('sourceType', 'OTHER'));

    $effect(() => {
        void initial;
        priorityField = val('priority', 'MEDIUM');
        statusField = val('status', 'OPEN');
        sourceTypeField = val('sourceType', 'OTHER');
    });
</script>

<form method="post" {action} use:enhance={onenhance} class="form-grid">
    <div class="form-grid-full">
        <Label for="question">Question</Label>
        <Textarea id="question" name="question" required rows={3} value={val('question')} />
    </div>
    <div>
        <Label for="category">Category</Label>
        <Input id="category" name="category" value={val('category')} />
    </div>
    <div>
        <Label for="priority">Priority</Label>
        <Select id="priority" name="priority" bind:value={priorityField} options={questionPriorityOptions} />
    </div>
    <div>
        <Label for="status">Status</Label>
        <Select id="status" name="status" bind:value={statusField} options={questionStatusOptions} />
    </div>
    <div>
        <Label for="sourceType">Source type</Label>
        <Select id="sourceType" name="sourceType" bind:value={sourceTypeField} options={questionSourceTypeOptions} />
    </div>
    <div class="form-grid-full">
        <Label for="citationUrl">Citation URL</Label>
        <Input id="citationUrl" name="citationUrl" type="url" value={val('citationUrl')} />
    </div>
    <div class="form-grid-full">
        <Label for="answer">Answer</Label>
        <Textarea id="answer" name="answer" rows={5} value={val('answer')} />
    </div>
    <div>
        <Label for="answeredAt">Answered on</Label>
        <Input id="answeredAt" name="answeredAt" type="date" value={val('answeredAt')} />
    </div>
    {#if error}<p class="form-grid-full form-error">{error}</p>{/if}
    <div class="form-grid-full form-actions">
        <Button type="submit">{submitLabel}</Button>
        <Button type="button" variant="outline" onclick={() => history.back()}>Cancel</Button>
    </div>
</form>
