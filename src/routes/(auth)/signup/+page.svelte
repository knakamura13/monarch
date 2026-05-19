<script lang="ts">
    import AuthShell from '$lib/components/layout/AuthShell.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import Label from '$lib/components/ui/Label.svelte';
    import { authClient } from '$lib/client/auth-client';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    let email = $state('');
    let password = $state('');
    let name = $state('');
    let workspaceName = $state('Our case');
    let loading = $state(false);
    let error = $state<string | null>(null);

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        loading = true;
        error = null;
        const res = await authClient.signUp.email({ email, password, name });
        if (res.error) {
            loading = false;
            error = res.error.message ?? 'Sign-up failed';
            return;
        }
        const formData = new FormData();
        formData.set('workspaceName', workspaceName || 'Our case');
        const inviteToken = page.url.searchParams.get('invite');
        if (inviteToken) formData.set('inviteToken', inviteToken);
        const setup = await fetch('/api/post-signup', { method: 'POST', body: formData });
        loading = false;
        if (!setup.ok) {
            const body = (await setup.json().catch(() => ({}))) as { error?: string };
            error = body.error ?? 'Workspace setup failed';
            return;
        }
        await goto('/dashboard', { invalidateAll: true });
    }
</script>

<AuthShell
    title={data.isFirstUser ? 'Create owner account' : 'Create your account'}
    subtitle={data.isFirstUser
        ? 'You are the first user — this account will own the workspace.'
        : 'Complete your signup to join the workspace.'}
>
    <form class="auth-form" onsubmit={handleSubmit}>
        <div>
            <Label for="name">Your name</Label>
            <Input id="name" autocomplete="name" bind:value={name} required />
        </div>
        <div>
            <Label for="email">Email</Label>
            <Input id="email" type="email" autocomplete="email" bind:value={email} required />
        </div>
        <div>
            <Label for="password">Password (min 8 chars)</Label>
            <Input id="password" type="password" autocomplete="new-password" bind:value={password} minlength={8} required />
        </div>
        {#if data.isFirstUser}
            <div>
                <Label for="ws">Workspace name</Label>
                <Input id="ws" bind:value={workspaceName} required />
            </div>
        {/if}
        {#if error}<p class="auth-text-sm auth-text-destructive">{error}</p>{/if}
        <Button type="submit" disabled={loading} class="auth-w-full">{loading ? 'Creating…' : 'Create account'}</Button>
    </form>
    <p class="auth-footer">
        Already have an account?
        <a class="auth-text-primary auth-underline-offset-4 auth-hover-underline" href="/login">Sign in</a>
    </p>
</AuthShell>
