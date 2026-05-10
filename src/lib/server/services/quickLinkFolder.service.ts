import { logActivity } from '$lib/server/activity';
import { randomUUID } from 'node:crypto';
import { ddbGet, ddbPut, ddbQuery, ddbTransactWrite, ddbUpdate, type TransactItem } from '$lib/server/dynamo/ops';
import { entitySk, wsPk } from '$lib/server/dynamo/keys';
import type { QuickLinkFolderItem, QuickLinkItem } from '$lib/server/dynamo/types';
import { extractHostname } from '$lib/server/utils/url';


export async function listQuickLinkFolders(workspaceId: string, limit?: number) {
    const rows = await ddbQuery<QuickLinkFolderItem>({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': wsPk(workspaceId), ':prefix': 'QuickLinkFolder#' },
        Limit: limit ?? 1000
    });

    return rows.filter((r) => !r.deletedAt).sort((a, b) => a.order - b.order);
}

export async function createQuickLinkFolder(workspaceId: string, actorId: string, name?: string | null) {
    const existing = await listQuickLinkFolders(workspaceId);
    const order = (existing.at(-1)?.order ?? -1) + 1;
    const now = new Date().toISOString();
    const folder = {
        id: randomUUID(),
        workspaceId,
        name: name ?? null,
        order,
        deletedAt: null as string | null,
        createdAt: now,
        updatedAt: now
    };
    await ddbPut({
        PK: wsPk(workspaceId),
        SK: entitySk('QuickLinkFolder', folder.id),
        ...folder
    });
    const label = folder.name ?? 'Folder';
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'QUICK_LINK_FOLDER_CREATED',
        entityType: 'QuickLinkFolder',
        entityId: folder.id,
        summary: `Quick link folder "${label}" created`
    });
    return folder;
}

export async function updateQuickLinkFolder(workspaceId: string, actorId: string, id: string, name?: string | null) {
    const existing = await ddbGet<QuickLinkFolderItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('QuickLinkFolder', id)
    });
    if (!existing) throw new Error('Quick link folder not found');
    if (existing.deletedAt) throw new Error('Quick link folder not found');

    const patch: Partial<typeof existing> = {};
    if (name !== undefined) patch.name = name ?? null;
    patch.updatedAt = new Date().toISOString();

    const exprParts: string[] = [];
    const values: Record<string, unknown> = {};
    const names: Record<string, string> = {};
    for (const [k, v] of Object.entries(patch)) {
        const nk = `#${k}`;
        const vk = `:${k}`;
        Reflect.set(names, nk, k);
        Reflect.set(values, vk, v);
        exprParts.push(`${nk} = ${vk}`);
    }
    const updated =
        exprParts.length === 0
            ? existing
            : ((await ddbUpdate<typeof existing>(
                  { PK: wsPk(workspaceId), SK: entitySk('QuickLinkFolder', id) },
                  `SET ${exprParts.join(', ')}`,
                  values,
                  names
              )) ?? existing);
    const folder = updated;
    const label = folder.name ?? 'Folder';
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'QUICK_LINK_FOLDER_UPDATED',
        entityType: 'QuickLinkFolder',
        entityId: folder.id,
        summary: `Quick link folder "${label}" updated`
    });
    return folder;
}

export async function deleteQuickLinkFolder(workspaceId: string, actorId: string, id: string) {
    const existing = await ddbGet<QuickLinkFolderItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('QuickLinkFolder', id)
    });
    if (!existing) throw new Error('Quick link folder not found');
    if (existing.deletedAt) throw new Error('Quick link folder not found');

    // Un-group all links in this folder
    const linksInFolder = await ddbQuery<QuickLinkItem>({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': wsPk(workspaceId), ':prefix': 'QuickLink#' },
        Limit: 1000
    });

    const linksToUpdate = linksInFolder.filter((l) => !l.deletedAt && l.folderId === id);

    for (const link of linksToUpdate) {
        await ddbUpdate(
            { PK: wsPk(workspaceId), SK: entitySk('QuickLink', link.id) },
            'SET #folderId = :f, #updatedAt = :u',
            { ':f': null, ':u': new Date().toISOString() },
            { '#folderId': 'folderId', '#updatedAt': 'updatedAt' }
        );
    }

    // Soft delete the folder
    await ddbUpdate(
        { PK: wsPk(workspaceId), SK: entitySk('QuickLinkFolder', id) },
        'SET #deletedAt = :d, #updatedAt = :u',
        { ':d': new Date().toISOString(), ':u': new Date().toISOString() },
        { '#deletedAt': 'deletedAt', '#updatedAt': 'updatedAt' }
    );

    const label = existing.name ?? 'Folder';
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'QUICK_LINK_FOLDER_DELETED',
        entityType: 'QuickLinkFolder',
        entityId: id,
        summary: `Quick link folder "${label}" deleted`
    });
}

/**
 * Atomically creates a new folder and assigns the given links to it in a single
 * DynamoDB transaction. Either every write succeeds or none do, so we never
 * leave behind an empty orphan folder if a link reassignment fails.
 */
export async function createFolderWithLinks(workspaceId: string, actorId: string, linkIds: string[], name?: string | null) {
    if (linkIds.length === 0) throw new Error('linkIds must contain at least one link');

    const links = await Promise.all(
        linkIds.map((id) =>
            ddbGet<QuickLinkItem>({
                PK: wsPk(workspaceId),
                SK: entitySk('QuickLink', id)
            })
        )
    );
    for (const [i, link] of links.entries()) {
        if (!link || link.deletedAt) {
            const linkId = linkIds.at(i);
            throw new Error(`Quick link not found: ${linkId}`);
        }
    }

    const existingFolders = await listQuickLinkFolders(workspaceId);
    const order = (existingFolders.at(-1)?.order ?? -1) + 1;
    const now = new Date().toISOString();
    const folder = {
        id: randomUUID(),
        workspaceId,
        name: name ?? null,
        order,
        deletedAt: null as string | null,
        createdAt: now,
        updatedAt: now
    };

    const items: TransactItem[] = [
        {
            Put: {
                Item: {
                    PK: wsPk(workspaceId),
                    SK: entitySk('QuickLinkFolder', folder.id),
                    ...folder
                }
            }
        },
        ...linkIds.map<TransactItem>((linkId) => ({
            Update: {
                Key: { PK: wsPk(workspaceId), SK: entitySk('QuickLink', linkId) },
                UpdateExpression: 'SET #folderId = :f, #updatedAt = :u',
                ExpressionAttributeValues: { ':f': folder.id, ':u': now, ':null': null },
                ExpressionAttributeNames: { '#folderId': 'folderId', '#updatedAt': 'updatedAt', '#deletedAt': 'deletedAt' },
                // Links store deletedAt as null on create (the attribute is
                // always present), so attribute_not_exists wouldn't match.
                // Compare equality with null instead.
                ConditionExpression: 'attribute_exists(PK) AND #deletedAt = :null'
            }
        }))
    ];

    await ddbTransactWrite(items);

    const label = folder.name ?? 'Folder';
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'QUICK_LINK_FOLDER_CREATED',
        entityType: 'QuickLinkFolder',
        entityId: folder.id,
        summary: `Quick link folder "${label}" created from ${linkIds.length} link${linkIds.length === 1 ? '' : 's'}`
    });

    return folder;
}

export async function moveLinkToFolder(workspaceId: string, actorId: string, linkId: string, folderId: string | null) {
    const existing = await ddbGet<QuickLinkItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('QuickLink', linkId)
    });
    if (!existing) throw new Error('Quick link not found');
    if (existing.deletedAt) throw new Error('Quick link not found');

    await ddbUpdate(
        { PK: wsPk(workspaceId), SK: entitySk('QuickLink', linkId) },
        'SET #folderId = :f, #updatedAt = :u',
        { ':f': folderId, ':u': new Date().toISOString() },
        { '#folderId': 'folderId', '#updatedAt': 'updatedAt' }
    );

    const label = existing.title ?? extractHostname(existing.url);
    const action = folderId ? 'moved to folder' : 'moved to root';
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'QUICK_LINK_MOVED_TO_FOLDER',
        entityType: 'QuickLink',
        entityId: linkId,
        summary: `Quick link "${label}" ${action}`
    });
}

// DynamoDB TransactWriteItems caps at 100 items per call. Reorder operations
// chunk into batches that respect that limit while still landing each batch
// atomically.
const TRANSACT_WRITE_LIMIT = 100;

function buildOrderUpdate(
    workspaceId: string,
    type: 'QuickLink' | 'QuickLinkFolder',
    id: string,
    order: number,
    now: string
): TransactItem {
    return {
        Update: {
            Key: { PK: wsPk(workspaceId), SK: entitySk(type, id) },
            UpdateExpression: 'SET #order = :o, #updatedAt = :u',
            ExpressionAttributeValues: { ':o': order, ':u': now },
            ExpressionAttributeNames: { '#order': 'order', '#updatedAt': 'updatedAt' }
        }
    };
}

export async function reorderQuickLinks(workspaceId: string, actorId: string, linkIds: string[]) {
    const ids = linkIds.filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;

    const now = new Date().toISOString();
    const items: TransactItem[] = ids.map((linkId, i) => buildOrderUpdate(workspaceId, 'QuickLink', linkId, i, now));

    for (let i = 0; i < items.length; i += TRANSACT_WRITE_LIMIT) {
        await ddbTransactWrite(items.slice(i, i + TRANSACT_WRITE_LIMIT));
    }

    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'QUICK_LINK_REORDERED',
        entityType: 'QuickLink',
        entityId: workspaceId,
        summary: 'Quick links reordered'
    });
}

export async function reorderQuickLinkFolders(workspaceId: string, actorId: string, folderIds: string[]) {
    const ids = folderIds.filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;

    const now = new Date().toISOString();
    const items: TransactItem[] = ids.map((folderId, i) => buildOrderUpdate(workspaceId, 'QuickLinkFolder', folderId, i, now));

    for (let i = 0; i < items.length; i += TRANSACT_WRITE_LIMIT) {
        await ddbTransactWrite(items.slice(i, i + TRANSACT_WRITE_LIMIT));
    }

    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'QUICK_LINK_FOLDER_REORDERED',
        entityType: 'QuickLinkFolder',
        entityId: workspaceId,
        summary: 'Quick link folders reordered'
    });
}

