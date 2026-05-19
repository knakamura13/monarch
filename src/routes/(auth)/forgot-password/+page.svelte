<script lang="ts">
    import AuthShell from '$lib/components/layout/AuthShell.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import Label from '$lib/components/ui/Label.svelte';
    import { authClient } from '$lib/client/auth-client';
    import { MailCheck } from 'lucide-svelte';

    let email = $state('');
    let loading = $state(false);
    let error = $state<string | null>(null);
    let success = $state(false);

    async function handleForgotPassword(e: SubmitEvent) {
        e.preventDefault();
        loading = true;
        error = null;
        const res = await authClient.requestPasswordReset({
            email,
            redirectTo: '/reset-password'
        });
        loading = false;
        if (res.error) {
            error = res.error.message ?? 'Failed to send reset link';
            return;
        }
        success = true;
    }
</script>

<AuthShell title="Forgot password" subtitle="Enter your email and we'll send you a link to reset your password.">
    {#if success}
        <div class="auth-form" style="text-align: center;">
            <div style="display: flex; justify-content: center; margin-bottom: 16px;">
                <div style="background: var(--ink-3); opacity: 0.1; border-radius: 9999px; padding: 12px;">
                    <MailCheck style="height: 24px; width: 24px; color: var(--ink);" />
                </div>
            </div>
            <h3 style="font-size: 18px; font-weight: 600;">Check your email</h3>
            <p style="font-size: 13px; color: var(--ink-2); margin-top: 8px;">
                We've sent a password reset link to <strong>{email}</strong>.
            </p>
            <div style="margin-top: 24px;">
                <Button variant="outline" class="auth-w-full" onclick={() => (success = false)}>
                    Try another email
                </Button>
            </div>
        </div>
    {:else}
        <form class="auth-form" onsubmit={handleForgotPassword}>
            <div>
                <Label for="email">Email</Label>
                <Input id="email" type="email" autocomplete="email" bind:value={email} required placeholder="name@example.com" />
            </div>
            {#if error}<p class="auth-text-sm auth-text-destructive">{error}</p>{/if}
            <Button type="submit" {loading} class="auth-w-full">
                Send Reset Link
            </Button>
        </form>
    {/if}
    <p class="auth-footer">
        Remember your password?
        <a class="auth-text-primary auth-underline-offset-4 auth-hover-underline" href="/login">Back to sign in</a>
    </p>
</AuthShell>
