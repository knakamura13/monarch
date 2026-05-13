<script lang="ts">
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import { showSuccessToast, showErrorToast } from '$lib/stores/toast';
    import { authClient } from '$lib/client/auth-client';
    import Fingerprint from 'lucide-svelte/icons/fingerprint';
    import ShieldCheck from 'lucide-svelte/icons/shield-check';
    import Trash2 from 'lucide-svelte/icons/trash-2';
    import Plus from 'lucide-svelte/icons/plus';

    let passkeyMsg = $state<string | null>(null);
    let passkeys = $state<Array<{ id: string; name?: string }>>([]);
    let totpMsg = $state<string | null>(null);
    let totpSecret = $state<{ totpURI?: string; backupCodes?: string[] } | null>(null);
    let totpCode = $state('');

    async function addPasskey() {
        passkeyMsg = 'Launching passkey ceremony…';
        try {
            const res = await authClient.passkey.addPasskey();
            if (res?.error) {
                passkeyMsg = res.error.message ?? 'Failed';
                showErrorToast(passkeyMsg);
            } else {
                passkeyMsg = 'Passkey added.';
                showSuccessToast('Passkey added');
                await loadPasskeys();
            }
        } catch (err) {
            passkeyMsg = (err as Error).message;
        }
    }

    async function loadPasskeys() {
        const res = await authClient.passkey.listUserPasskeys();
        if (res.data) {
            passkeys = res.data;
        }
    }

    async function deletePasskey(id: string) {
        const res = await authClient.passkey.deletePasskey({ id });
        if (res.error) {
            passkeyMsg = res.error.message ?? 'Failed to delete passkey';
            showErrorToast(passkeyMsg);
        } else {
            passkeyMsg = 'Passkey deleted.';
            showSuccessToast('Passkey deleted');
            await loadPasskeys();
        }
    }

    $effect(() => {
        loadPasskeys();
    });

    async function enableTotp() {
        totpMsg = null;
        const password = prompt('Confirm your password');
        if (!password) return;
        const res = await authClient.twoFactor.enable({ password });
        if (res.error) {
            totpMsg = res.error.message ?? 'Failed';
            showErrorToast(totpMsg);
        } else {
            totpSecret = res.data ?? null;
        }
    }

    async function verifyTotp() {
        const res = await authClient.twoFactor.verifyTotp({ code: totpCode });
        if (res.error) {
            totpMsg = res.error.message ?? 'Invalid code';
            showErrorToast(totpMsg);
        } else {
            totpMsg = 'Two-factor enabled.';
            showSuccessToast('Two-factor authentication enabled');
            totpSecret = null;
        }
    }
</script>

<PageHeader title="Security" sub="Protect your case with passkeys and multi-factor authentication." />

<div style="max-width: 880px; display: flex; flex-direction: column; gap: 24px;">
    <!-- Passkeys Card -->
    <div class="card" style="padding: 24px;">
        <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px;">
            <div
                style="width: 44px; height: 44px; border-radius: 50%; background: var(--peri); color: var(--peri-d); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"
            >
                <Fingerprint style="width: 24px; height: 24px;" />
            </div>
            <div>
                <h2 class="display" style="font-size: 24px; margin: 0 0 4px 0;">Passkeys</h2>
                <p style="font-size: 13px; color: var(--ink-2); margin: 0;">
                    Use Face ID, Touch ID, or a hardware key for secure, passwordless sign-in.
                </p>
            </div>
        </div>

        {#if passkeys.length > 0}
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
                {#each passkeys as pk (pk.id)}
                    <div
                        style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface-2); border-radius: var(--r-md);"
                    >
                        <span style="font-size: 14px; font-weight: 500;">{pk.name || 'Unnamed passkey'}</span>
                        <button
                            onclick={() => deletePasskey(pk.id)}
                            style="background: none; border: none; cursor: pointer; color: var(--blush-d); display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500;"
                            type="button"
                        >
                            <Trash2 style="width: 14px; height: 14px;" /> Delete
                        </button>
                    </div>
                {/each}
            </div>
        {/if}

        <Button onclick={addPasskey}>
            <Plus style="width: 14px; height: 14px; margin-right: 6px;" /> Add a passkey
        </Button>

        {#if passkeyMsg}
            <p style="margin-top: 16px; font-size: 13px; color: var(--ink-3);">{passkeyMsg}</p>
        {/if}
    </div>

    <!-- 2FA Card -->
    <div class="card" style="padding: 24px;">
        <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px;">
            <div
                style="width: 44px; height: 44px; border-radius: 50%; background: var(--sage); color: var(--sage-d); display: flex; align-items: center; justify-content: center; flex-shrink: 0;"
            >
                <ShieldCheck style="width: 24px; height: 24px;" />
            </div>
            <div>
                <h2 class="display" style="font-size: 24px; margin: 0 0 4px 0;">Two-factor auth</h2>
                <p style="font-size: 13px; color: var(--ink-2); margin: 0;">
                    Add an extra layer of security with a TOTP app like 1Password, Authy, or Google Authenticator.
                </p>
            </div>
        </div>

        {#if !totpSecret}
            <Button variant="outline" onclick={enableTotp}>Enable two-factor</Button>
        {:else}
            <div style="padding: 20px; background: var(--surface-2); border-radius: var(--r-md); border: 1px dashed var(--hairline);">
                <p style="font-size: 13px; font-weight: 600; margin-bottom: 12px;">1. Scan this URI in your app</p>
                <code
                    style="display: block; font-family: var(--font-mono); font-size: 11px; padding: 12px; background: var(--surface); border: 1px solid var(--hairline); border-radius: var(--r-sm); overflow-x: auto; margin-bottom: 20px;"
                >
                    {totpSecret.totpURI}
                </code>

                {#if totpSecret.backupCodes}
                    <p style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">2. Save your backup codes</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px;">
                        {#each totpSecret.backupCodes as c (c)}
                            <code
                                style="font-family: var(--font-mono); font-size: 12px; padding: 4px 8px; background: var(--surface); border-radius: 4px;"
                                >{c}</code
                            >
                        {/each}
                    </div>
                {/if}

                <p style="font-size: 13px; font-weight: 600; margin-bottom: 12px;">3. Verify the setup</p>
                <div style="display: flex; gap: 12px;">
                    <input
                        bind:value={totpCode}
                        placeholder="6-digit code"
                        class="input"
                        style="width: 140px;"
                        maxlength="6"
                        inputmode="numeric"
                        pattern="[0-9]*"
                    />
                    <Button onclick={verifyTotp}>Verify & Enable</Button>
                </div>
            </div>
        {/if}

        {#if totpMsg}
            <p style="margin-top: 16px; font-size: 13px; color: var(--ink-3);">{totpMsg}</p>
        {/if}
    </div>
</div>
