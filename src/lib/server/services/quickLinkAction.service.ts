import { fail, isHttpError, isRedirect, redirect, type RequestEvent } from '@sveltejs/kit';
import { logActionError } from '$lib/server/services/actionError.service';
import { createQuickLink, updateQuickLink, softDeleteQuickLink } from '$lib/server/services/quickLink.service';
import {
    createFolderWithLinks,
    createQuickLinkFolder,
    updateQuickLinkFolder,
    deleteQuickLinkFolder,
    moveLinkToFolder,
    reorderQuickLinks,
    reorderQuickLinkFolders
} from '$lib/server/services/quickLinkFolder.service';
import {
    quickLinkCreateSchema,
    quickLinkUpdateSchema,
    quickLinkDeleteSchema,
    quickLinkFolderCreateSchema,
    quickLinkFolderUpdateSchema,
    quickLinkFolderDeleteSchema,
    quickLinkMoveToFolderSchema,
    quickLinkReorderSchema,
    quickLinkFolderReorderSchema,
    quickLinkCreateFolderFromLinksSchema
} from '$lib/schemas/quickLink';
import { parseFormArray } from '$lib/server/utils/parsing';
import type { WorkspaceItem } from '$lib/server/dynamo/types';
import type { User } from 'better-auth';

export async function handleQuickLinkAction(
    event: RequestEvent,
    workspace: { id: string; name: string; role: any },
    user: { id: string; email: string; name: string | null; image: string | null },
    action: string,
    redirectTarget: string
) {
    const formData = await event.request.formData();
    const raw = Object.fromEntries(formData);

    try {
        switch (action) {
            case 'create': {
                const parsed = quickLinkCreateSchema.safeParse(raw);
                if (!parsed.success) return await logAndFail(event, parsed.error.message, 400);
                await createQuickLink(workspace.id, user.id, parsed.data);
                throw redirect(303, redirectTarget);
            }
            case 'update': {
                const parsed = quickLinkUpdateSchema.safeParse(raw);
                if (!parsed.success) return await logAndFail(event, parsed.error.message, 400);
                await updateQuickLink(workspace.id, user.id, parsed.data.id, parsed.data);
                throw redirect(303, redirectTarget);
            }
            case 'delete': {
                const parsed = quickLinkDeleteSchema.safeParse(raw);
                if (!parsed.success) return await logAndFail(event, parsed.error.message, 400);
                await softDeleteQuickLink(workspace.id, user.id, parsed.data.id);
                throw redirect(303, redirectTarget);
            }
            case 'createFolder': {
                const parsed = quickLinkFolderCreateSchema.safeParse(raw);
                if (!parsed.success) return await logAndFail(event, parsed.error.message, 400);
                await createQuickLinkFolder(workspace.id, user.id, parsed.data.name);
                throw redirect(303, redirectTarget);
            }
            case 'updateFolder': {
                const parsed = quickLinkFolderUpdateSchema.safeParse(raw);
                if (!parsed.success) return await logAndFail(event, parsed.error.message, 400);
                await updateQuickLinkFolder(workspace.id, user.id, parsed.data.id, parsed.data.name);
                throw redirect(303, redirectTarget);
            }
            case 'deleteFolder': {
                const parsed = quickLinkFolderDeleteSchema.safeParse(raw);
                if (!parsed.success) return await logAndFail(event, parsed.error.message, 400);
                await deleteQuickLinkFolder(workspace.id, user.id, parsed.data.id);
                return { success: true };
            }
            case 'moveToFolder': {
                const parsed = quickLinkMoveToFolderSchema.safeParse(raw);
                if (!parsed.success) return await logAndFail(event, parsed.error.message, 400);
                await moveLinkToFolder(workspace.id, user.id, parsed.data.linkId, parsed.data.folderId ?? null);
                return { success: true };
            }
            case 'reorderLinks': {
                const parsed = quickLinkReorderSchema.safeParse({ linkIds: parseFormArray(formData, 'linkIds') });
                if (!parsed.success) return await logAndFail(event, parsed.error.message, 400);
                await reorderQuickLinks(workspace.id, user.id, parsed.data.linkIds);
                return { success: true };
            }
            case 'createFolderFromLinks': {
                const parsed = quickLinkCreateFolderFromLinksSchema.safeParse({
                    linkIds: parseFormArray(formData, 'linkIds'),
                    name: (formData.get('name') as string) ?? undefined
                });
                if (!parsed.success) return await logAndFail(event, parsed.error.message, 400);
                const folder = await createFolderWithLinks(workspace.id, user.id, parsed.data.linkIds, parsed.data.name);
                return { success: true, folder };
            }
            case 'reorderFolders': {
                const parsed = quickLinkFolderReorderSchema.safeParse({ folderIds: parseFormArray(formData, 'folderIds') });
                if (!parsed.success) return await logAndFail(event, parsed.error.message, 400);
                await reorderQuickLinkFolders(workspace.id, user.id, parsed.data.folderIds);
                return { success: true };
            }
            default:
                return await logAndFail(event, `Unknown action: ${action}`, 400);
        }
    } catch (e) {
        if (isRedirect(e) || isHttpError(e)) throw e;
        const message = e instanceof Error ? e.message : `Failed to perform ${action}`;
        const status = message.includes('not found') ? 404 : 500;
        return await logAndFail(event, message, status, e instanceof Error ? e.stack : undefined);
    }
}

async function logAndFail(event: RequestEvent, message: string, status: number, stack?: string) {
    const errorId = await logActionError(event, { message, status, stack });
    return fail(status, { error: message, errorId });
}
