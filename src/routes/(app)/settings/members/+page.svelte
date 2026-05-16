<script lang="ts">
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import { showSuccessToast } from '$lib/stores/toast';
    import Button from '$lib/components/ui/Button.svelte';
    import Select from '$lib/components/ui/Select.svelte';
    import { Trash2, Copy, Shield, UserPlus } from 'lucide-svelte';
    import { enhance } from '$app/forms';
    import { getPageNumber } from '$lib/constants/navigation';
    import type { ActionData, PageData } from './$types';
    import { page } from '$app/state';

    let { data, form }: { data: PageData; form: ActionData } = $props();
    const isOwner = $derived(page.data.workspace?.role === 'OWNER');
    const inviteError = $derived(form?.error ?? null);

    const inviteRoleOptions = [
        { value: 'COLLABORATOR', label: 'Collaborator' },
        { value: 'OWNER', label: 'Owner' }
    ];
    let inviteRole = $state('COLLABORATOR');

    async function copyToClipboard(url: string) {
        await navigator.clipboard.writeText(url);
        showSuccessToast('Invite link copied to clipboard');
    }
</script>

<PageHeader title="Settings" sub="Manage members, case access, and security." number={getPageNumber('/settings')} />

<div style="max-width: 880px; display: flex; flex-direction: column; gap: 24px;">
    <div class="card" style="padding: 24px;">
        <h2 class="display" style="font-size: 24px; margin-top: 0; margin-bottom: 20px;">Members</h2>
        <div style="display: flex; flex-direction: column; gap: 16px;">
            {#each data.members as m (m.id)}
                <div
                    style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--surface-2); border-radius: var(--r-md);"
                >
                    <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                        <div style="min-width: 0;">
                            <p class="text-ellipsis" style="font-size: 14px; font-weight: 500;">{m.user.name ?? m.user.email}</p>
                            <p class="text-ellipsis" style="font-size: 12px; color: var(--ink-3);">{m.user.email}</p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="pill {m.role === 'OWNER' ? 's-active' : 's-note'}" style="font-size: 10px;">{m.role}</span>
                        {#if isOwner && m.user.id !== page.data.user?.id}
                            <form
                                method="post"
                                action="?/removeMember"
                                use:enhance={() => {
                                    return async ({ result, update }) => {
                                        await update();
                                        if (result.type === 'success') {
                                            showSuccessToast('Member removed');
                                        }
                                    };
                                }}
                            >
                                <input type="hidden" name="userId" value={m.user.id} />
                                <button type="submit" style="background: none; border: none; cursor: pointer; color: var(--blush-d);">
                                    <Trash2 style="width: 16px; height: 16px;" />
                                </button>
                            </form>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
        <div
            style="margin-top: 16px; padding: 12px; border: 1px solid var(--lilac-d); border-radius: var(--r-sm); background: var(--lilac); display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-2);"
        >
            <Shield style="width: 16px; height: 16px;" />
            This case is private. Only invited members can sign in.
        </div>
    </div>

    {#if isOwner}
        <div class="card" style="padding: 24px;">
            <h2 class="display" style="font-size: 24px; margin-top: 0; margin-bottom: 20px;">Invite a user</h2>
            <form
                method="post"
                action="?/invite"
                use:enhance={() => {
                    return async ({ result, update }) => {
                        await update();
                        if (result.type === 'success') {
                            showSuccessToast('Invite link created');
                        }
                    };
                }}
                class="invite-form"
            >
                <div>
                    <label for="invite-email" style="display: block; font-size: 13px; margin-bottom: 4px;">Email</label>
                    <input
                        id="invite-email"
                        name="email"
                        type="email"
                        class="input"
                        style={`width: 100%; ${inviteError ? 'border-color: var(--blush-d);' : ''}`}
                        aria-invalid={inviteError ? 'true' : undefined}
                        required
                    />
                </div>
                <div>
                    <label for="invite-role" style="display: block; font-size: 13px; margin-bottom: 4px;">Role</label>
                    <Select id="invite-role" name="role" bind:value={inviteRole} options={inviteRoleOptions} fluid position="bottom-end" />
                </div>
                <Button type="submit"><UserPlus style="width: 14px; height: 14px; margin-right: 4px;" /> Create link</Button>
            </form>

            {#if inviteError}
                <p style="margin-top: 12px; font-size: 13px; color: var(--blush-d);">{inviteError}</p>
            {/if}

            {#if form?.ok && form?.inviteUrl}
                <div
                    style="margin-top: 20px; padding: 16px; background: var(--surface-2); border-radius: var(--r-md); border: 1px dashed var(--hairline);"
                >
                    <p style="font-size: 13px; margin-bottom: 8px;">Invite link created</p>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <code
                            style="font-family: var(--font-mono); font-size: 12px; padding: 6px; background: var(--surface); border: 1px solid var(--hairline); flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap;"
                            >{form.inviteUrl}</code
                        >
                        <Button onclick={() => copyToClipboard(form.inviteUrl)} size="sm" variant="outline"
                            ><Copy style="width: 14px; height: 14px;" /></Button
                        >
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .invite-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    @media (min-width: 960px) {
        .invite-form {
            display: grid;
            grid-template-columns: 1fr 160px auto;
            align-items: end;
        }
    }

    .text-ellipsis {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
