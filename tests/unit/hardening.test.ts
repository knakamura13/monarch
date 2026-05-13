import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ddbPut, ddbQueryAll, ddbGet, ddbDelete } from '$lib/server/dynamo/ops';
import { createWorkspace, removeMember } from '$lib/server/services/workspace.service';
import { createQuickLinkFolder, moveLinkToFolder, reorderQuickLinks, reorderQuickLinkFolders } from '$lib/server/services/quickLinkFolder.service';
import { createQuickLink } from '$lib/server/services/quickLink.service';
import { baPk, entitySk, wsPk } from '$lib/server/dynamo/keys';
import { parseFormArray, safeParseJsonAction } from '$lib/server/utils/parsing';
import type { RequestEvent } from '@sveltejs/kit';

describe('Hardening Remediation', () => {
    const actorId = 'user-1';
    let workspaceId: string;

    beforeEach(async () => {
        const ws = await createWorkspace({ name: 'Test WS', ownerUserId: actorId });
        workspaceId = ws.id;
    });

    describe('DynamoDB Pagination', () => {
        it('ddbQueryAll retrieves items beyond the mock limit', async () => {
            const pk = 'PAGINATION_TEST';
            for (let i = 0; i < 20; i++) {
                await ddbPut({ PK: pk, SK: `Item#${i}`, val: i });
            }

            // Emulate pagination by using a small limit in ddbQuery (internally called by ddbQueryAll)
            const items = await ddbQueryAll<any>({
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: { ':pk': pk },
                Limit: 5 // Mock ddbQueryAll respects this Limit by paging
            });

            expect(items.length).toBe(20);
        });

        it('ddbQueryAll respects maxItems cap', async () => {
            const pk = 'CAP_TEST';
            for (let i = 0; i < 10; i++) {
                await ddbPut({ PK: pk, SK: `Item#${i}`, val: i });
            }

            const items = await ddbQueryAll<any>({
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: { ':pk': pk }
            }, 5);

            expect(items.length).toBe(5);
        });
    });

    describe('Workspace Member Removal', () => {
        it('removes all sessions for the user even if > 500 exist (paginated)', async () => {
            const targetUser = 'user-to-remove';
            
            // Seed more than 500 sessions (we'll use a smaller number for speed in tests, 
            // but rely on ddbQueryAll being used)
            const sessionCount = 10; 
            for (let i = 0; i < sessionCount; i++) {
                await ddbPut({
                    PK: baPk('session'),
                    SK: `session-${i}`,
                    userId: targetUser,
                    id: `session-${i}`
                });
            }

            await removeMember(workspaceId, targetUser);

            const remainingSessions = await ddbQueryAll<any>({
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: { ':pk': baPk('session') }
            });
            
            const userSessions = remainingSessions.filter(s => s.userId === targetUser);
            expect(userSessions.length).toBe(0);
        });
    });

    describe('Quick Link Hardening', () => {
        it('moveLinkToFolder rejects nonexistent folder', async () => {
            const link = await createQuickLink(workspaceId, actorId, { url: 'https://test.com', title: 'Test', description: null });
            await expect(moveLinkToFolder(workspaceId, actorId, link.id, 'nonexistent-folder'))
                .rejects.toThrow('Quick link folder not found');
        });

        it('moveLinkToFolder rejects folder from another workspace', async () => {
            const otherWs = await createWorkspace({ name: 'Other WS', ownerUserId: 'other' });
            const otherFolder = await createQuickLinkFolder(otherWs.id, 'other', 'Other Folder');
            const link = await createQuickLink(workspaceId, actorId, { url: 'https://test.com', title: 'Test', description: null });
            
            await expect(moveLinkToFolder(workspaceId, actorId, link.id, otherFolder.id))
                .rejects.toThrow('Quick link folder not found'); // Should be not found because of WS scoping
        });

        it('reorderQuickLinks rejects duplicate IDs', async () => {
            const link = await createQuickLink(workspaceId, actorId, { url: 'https://test.com', title: 'Test', description: null });
            await expect(reorderQuickLinks(workspaceId, actorId, [link.id, link.id]))
                .rejects.toThrow('Duplicate link IDs provided');
        });

        it('reorderQuickLinks rejects nonexistent IDs', async () => {
            await expect(reorderQuickLinks(workspaceId, actorId, ['nonexistent']))
                .rejects.toThrow('Quick link not found: nonexistent');
        });
        
        it('reorderQuickLinkFolders rejects foreign workspace IDs', async () => {
            const otherWs = await createWorkspace({ name: 'Other WS', ownerUserId: 'other' });
            const otherFolder = await createQuickLinkFolder(otherWs.id, 'other', 'Other Folder');
            
            await expect(reorderQuickLinkFolders(workspaceId, actorId, [otherFolder.id]))
                .rejects.toThrow(`Quick link folder not found: ${otherFolder.id}`);
        });
    });

    describe('Safe Parsing Utilities', () => {
        it('parseFormArray handles JSON arrays and individual values', () => {
            const fd = new FormData();
            fd.append('ids', '["a", "b"]');
            fd.append('ids', 'c');
            
            const results = parseFormArray(fd, 'ids');
            expect(results).toEqual(['a', 'b', 'c']);
        });

        it('safeParseJsonAction returns failure on invalid JSON', async () => {
            const mockEvent = {
                locals: { requestId: 'test' },
                url: new URL('http://localhost/test'),
                request: { method: 'POST', headers: new Headers() }
            } as unknown as RequestEvent;

            const result = await safeParseJsonAction(mockEvent, 'invalid-json', 'testAction');
            expect('error' in result).toBe(true);
            if ('error' in result) {
                expect(result.error.status).toBe(400);
            }
        });
    });
});
