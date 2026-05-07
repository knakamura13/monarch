import { describe, it, expect, beforeEach } from 'vitest';
import {
    quickLinkCreateSchema,
    quickLinkCreateFolderFromLinksSchema,
    quickLinkReorderSchema,
    quickLinkFolderReorderSchema
} from '$lib/schemas/quickLink';
import { createQuickLink, listQuickLinks, softDeleteQuickLink } from '$lib/server/services/quickLink.service';
import { createQuickLinkFolder } from '$lib/server/services/quickLinkFolder.service';

const actorId = 'test-user';

function workspaceId() {
    return `ws_${Math.random().toString(36).slice(2, 10)}`;
}

describe('quickLinkCreateSchema', () => {
    it('prepends https for bare host', () => {
        const r = quickLinkCreateSchema.safeParse({
            url: 'example.com/path',
            title: '',
            description: '',
            notes: ''
        });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data.url).toBe('https://example.com/path');
    });

    it('accepts explicit https URL', () => {
        const r = quickLinkCreateSchema.safeParse({
            url: 'https://example.com',
            title: 'Ex',
            description: '',
            notes: ''
        });
        expect(r.success).toBe(true);
        if (r.success) {
            expect(r.data.url).toBe('https://example.com');
            expect(r.data.title).toBe('Ex');
        }
    });

    it('rejects javascript URLs', () => {
        const r = quickLinkCreateSchema.safeParse({
            url: 'javascript:alert(1)',
            description: '',
            notes: ''
        });
        expect(r.success).toBe(false);
    });

    it('rejects non-http(s) protocols', () => {
        const r = quickLinkCreateSchema.safeParse({
            url: 'ftp://example.com',
            description: '',
            notes: ''
        });
        expect(r.success).toBe(false);
    });

    it('coerces empty title to null', () => {
        const r = quickLinkCreateSchema.safeParse({
            url: 'https://a.test',
            title: '   ',
            description: '',
            notes: ''
        });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data.title).toBeNull();
    });
});

describe('softDeleteQuickLink', () => {
    beforeEach(() => {
        (globalThis as unknown as { __ddbMem?: Map<string, unknown> }).__ddbMem = new Map();
    });

    it('rejects folder IDs with a clear error instead of "not found"', async () => {
        const ws = workspaceId();
        const folder = await createQuickLinkFolder(ws, actorId, 'A folder');

        await expect(softDeleteQuickLink(ws, actorId, folder.id)).rejects.toThrow(/Cannot delete folder/);
    });

    it('soft-deletes a link and clears its folderId so it no longer references the folder', async () => {
        const ws = workspaceId();
        const folder = await createQuickLinkFolder(ws, actorId, 'Parent');
        const link = await createQuickLink(ws, actorId, {
            url: 'https://example.com',
            title: 'Example',
            description: null,
            notes: null,
            folderId: folder.id
        } as Parameters<typeof createQuickLink>[2]);

        await softDeleteQuickLink(ws, actorId, link.id);

        // Listing root links should not return the deleted link
        const all = await listQuickLinks(ws);
        expect(all.find((l) => l.id === link.id)).toBeUndefined();
    });

    it('throws when the link does not exist', async () => {
        const ws = workspaceId();
        await expect(softDeleteQuickLink(ws, actorId, 'nonexistent-id')).rejects.toThrow('Quick link not found');
    });
});

describe('batch-operation schema caps', () => {
    it('quickLinkCreateFolderFromLinksSchema rejects > 99 link IDs (DDB tx limit headroom)', () => {
        const ids = Array.from({ length: 100 }, (_, i) => `link-${i}`);
        expect(quickLinkCreateFolderFromLinksSchema.safeParse({ linkIds: ids }).success).toBe(false);
    });

    it('quickLinkCreateFolderFromLinksSchema accepts exactly 99 link IDs', () => {
        const ids = Array.from({ length: 99 }, (_, i) => `link-${i}`);
        expect(quickLinkCreateFolderFromLinksSchema.safeParse({ linkIds: ids }).success).toBe(true);
    });

    it('quickLinkReorderSchema rejects > 1000 IDs', () => {
        const ids = Array.from({ length: 1001 }, (_, i) => `link-${i}`);
        expect(quickLinkReorderSchema.safeParse({ linkIds: ids }).success).toBe(false);
    });

    it('quickLinkFolderReorderSchema rejects > 1000 IDs', () => {
        const ids = Array.from({ length: 1001 }, (_, i) => `folder-${i}`);
        expect(quickLinkFolderReorderSchema.safeParse({ folderIds: ids }).success).toBe(false);
    });
});
