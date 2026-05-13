<script lang="ts">
    import PageHeader from '$lib/components/shared/PageHeader.svelte';
    import Button from '$lib/components/ui/Button.svelte';
    import Shield from 'lucide-svelte/icons/shield';
    import Download from 'lucide-svelte/icons/download';
    import FileJson from 'lucide-svelte/icons/file-json';
    import Activity from 'lucide-svelte/icons/activity';
</script>

<PageHeader title="Settings" sub="Data, privacy, and workspace management." />

<div style="max-width: 880px; display: flex; flex-direction: column; gap: 24px;">
    <!-- Privacy & Export Card (Tinted Sage as per Phase 9) -->
    <div class="card tinted-sage" style="padding: 24px;">
        <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px;">
            <div
                style="width: 44px; height: 44px; border-radius: 50%; background: var(--sage-fill); color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"
            >
                <Shield style="width: 24px; height: 24px;" />
            </div>
            <div>
                <h2 class="display" style="font-size: 24px; margin: 0 0 4px 0;">Privacy & Backups</h2>
                <p style="font-size: 13px; color: var(--sage-d); margin: 0;">
                    Your data is encrypted and private to your workspace members.
                </p>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="card" style="padding: 16px; background: rgba(255, 255, 255, 0.5); border-color: var(--sage-d);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <FileJson style="width: 18px; height: 18px; color: var(--sage-fill);" />
                    <span style="font-size: 14px; font-weight: 600;">JSON Snapshot</span>
                </div>
                <p style="font-size: 12px; color: var(--ink-2); margin-bottom: 12px;">
                    Download all your records in a machine-readable format.
                </p>
                <Button variant="outline" size="sm" href="/api/export">
                    <Download style="width: 14px; height: 14px; margin-right: 6px;" /> Download JSON
                </Button>
            </div>

            <div class="card" style="padding: 16px; background: rgba(255, 255, 255, 0.5); border-color: var(--sage-d);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <Activity style="width: 18px; height: 18px; color: var(--sage-fill);" />
                    <span style="font-size: 14px; font-weight: 600;">Audit Feed</span>
                </div>
                <p style="font-size: 12px; color: var(--ink-2); margin-bottom: 12px;">
                    Review a timeline of important changes and access logs.
                </p>
                <Button variant="outline" size="sm" href="/settings/data/activity">Open activity feed</Button>
            </div>
        </div>
    </div>
</div>
