<script lang="ts">
    import AuthShell from '$lib/components/layout/AuthShell.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Input from '$lib/components/ui/Input.svelte';
    import Label from '$lib/components/ui/Label.svelte';
    import { authClient } from '$lib/client/auth-client';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { CheckCircle2 } from 'lucide-svelte';

    let password = $state('');
    let confirmPassword = $state('');
    let loading = $state(false);
    let error = $state<string | null>(null);
    let success = $state(false);

    async function handleResetPassword(e: SubmitEvent) {
        e.preventDefault();
        if (password !== confirmPassword) {
            error = 'Passwords do not match';
            return;
        }

        loading = true;
        error = null;
        const token = page.url.searchParams.get('token');
        if (!token) {
            error = 'Invalid or missing reset token';
            loading = false;
            return;
        }
        const res = await authClient.resetPassword({
            newPassword: password,
            token
        });
        loading = false;
        if (res.error) {
            error = res.error.message ?? 'Failed to reset password';
            return;
        }
        success = true;
        setTimeout(() => {
            goto('/login');
        }, 3000);
    }
</script>

<AuthShell title="Reset password" subtitle="Enter your new password below.">
    {#if success}
        <div class="auth-form" style="text-align: center;">
            <div style="display: flex; justify-content: center; margin-bottom: 16px;">
                <div style="background: var(--ink-3); opacity: 0.1; border-radius: 9999px; padding: 12px;">
                    <CheckCircle2 style="height: 24px; width: 24px; color: var(--ink);" />
                </div>
            </div>
            <h3 style="font-size: 18px; font-weight: 600;">Password reset!</h3>
            <p style="font-size: 13px; color: var(--ink-2); margin-top: 8px;">
                Your password has been successfully reset. Redirecting you to sign in...
            </p>
            <div style="margin-top: 24px;">
                <Button class="auth-w-full" onclick={() => goto('/login')}>
                    Sign in now
                </Button>
            </div>
        </div>
    {:else}
        <form class="auth-form" onsubmit={handleResetPassword}>
            <div>
                <Label for="password">New Password</Label>
                <Input id="password" type="password" autocomplete="new-password" bind:value={password} required minlength={8} />
            </div>
            <div>
                <Label for="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" autocomplete="new-password" bind:value={confirmPassword} required minlength={8} />
            </div>
            {#if error}<p class="auth-text-sm auth-text-destructive">{error}</p>{/if}
            <Button type="submit" {loading} class="auth-w-full">
                Reset Password
            </Button>
        </form>
    {/if}
</AuthShell>
