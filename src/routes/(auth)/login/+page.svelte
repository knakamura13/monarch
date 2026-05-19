<script lang="ts">
    import AuthShell from '$lib/components/layout/AuthShell.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import Label from '$lib/components/ui/Label.svelte';
    import { authClient } from '$lib/client/auth-client';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { KeyRound, Fingerprint } from 'lucide-svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    let email = $state('');
    let password = $state('');
    let loading = $state(false);
    let error = $state<string | null>(null);
    let needsTwoFactor = $state(false);
    let totpCode = $state('');

    async function handleLogin(e: SubmitEvent) {
        e.preventDefault();
        loading = true;
        error = null;
        const res = await authClient.signIn.email({ email, password });
        loading = false;
        if (res.error) {
            error = res.error.message ?? 'Sign-in failed';
            return;
        }
        if ((res.data as { twoFactorRedirect?: boolean } | undefined)?.twoFactorRedirect) {
            needsTwoFactor = true;
            return;
        }
        const next = page.url.searchParams.get('next') ?? '/dashboard';
        await goto(next, { invalidateAll: true });
    }

    async function handleTotp(e: SubmitEvent) {
        e.preventDefault();
        loading = true;
        error = null;
        const res = await authClient.twoFactor.verifyTotp({ code: totpCode });
        loading = false;
        if (res.error) {
            error = res.error.message ?? 'Invalid code';
            return;
        }
        const next = page.url.searchParams.get('next') ?? '/dashboard';
        await goto(next, { invalidateAll: true });
    }

    async function handlePasskey() {
        loading = true;
        error = null;
        const res = await authClient.signIn.passkey();
        loading = false;
        if (res?.error) {
            error = res.error.message ?? 'Passkey sign-in failed';
            return;
        }
        const next = page.url.searchParams.get('next') ?? '/dashboard';
        await goto(next, { invalidateAll: true });
    }
</script>

<AuthShell title="Sign in" subtitle="Sign in to your private case workspace.">
    {#if needsTwoFactor}
        <form class="auth-form" onsubmit={handleTotp}>
            <div>
                <Label for="totp">Authenticator code</Label>
                <Input id="totp" inputmode="numeric" type="text" autocomplete="one-time-code" bind:value={totpCode} required />
            </div>
            {#if error}<p class="auth-text-sm auth-text-destructive">{error}</p>{/if}
            <Button type="submit" {loading} class="auth-w-full">Verify</Button>
        </form>
    {:else}
        <form class="auth-form" onsubmit={handleLogin}>
            <div>
                <Label for="email">Email</Label>
                <Input id="email" type="email" autocomplete="email" bind:value={email} required />
            </div>
            <div>
                <Label for="password">Password</Label>
                <Input id="password" type="password" autocomplete="current-password" bind:value={password} required />
            </div>
            {#if error === 'Invalid email or password'}
                <p class="auth-text-sm auth-text-destructive" style="text-align: right; margin-top: -12px; margin-bottom: 24px;">
                    {error}
                    <br />
                    <a
                        href="/forgot-password"
                        class="auth-text-primary auth-underline-offset-4 auth-hover-underline"
                        style="font-weight: 400; font-size: 12px;">Reset it here</a
                    >
                </p>
            {:else}
                <div style="display: flex; justify-content: flex-end; margin-top: -12px; margin-bottom: 24px;">
                    <a
                        href="/forgot-password"
                        class="auth-text-sm auth-text-primary auth-underline-offset-4 auth-hover-underline"
                        style="font-weight: 400; font-size: 12px; color: var(--ink-2);">Forgot password?</a
                    >
                </div>
                {#if error}
                    <p class="auth-text-sm auth-text-destructive">{error}</p>
                {/if}
            {/if}
            <Button type="submit" {loading} class="auth-w-full">
                {#snippet children()}<KeyRound class="auth-icon-sm" /> Sign in{/snippet}
            </Button>
        </form>
        <div class="auth-divider">
            <div class="auth-divider-line"><span></span></div>
            <div class="auth-divider-text"><span>or</span></div>
        </div>
        <Button variant="outline" class="auth-w-full" onclick={handlePasskey} disabled={loading}>
            {#snippet children()}<Fingerprint class="auth-icon-sm" /> Sign in with passkey{/snippet}
        </Button>
        {#if data.allowSignup}
            <p class="auth-footer">
                Need to create the first account?
                <a class="auth-text-primary auth-underline-offset-4 auth-hover-underline" href="/signup">Create owner account</a>
            </p>
        {/if}
    {/if}
</AuthShell>
