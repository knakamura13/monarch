import { requireWorkspace } from '$lib/server/guards';
import { listQuickLinks, createQuickLink, updateQuickLink, softDeleteQuickLink } from '$lib/server/services/quickLink.service';
import {
    listQuickLinkFolders,
    createQuickLinkFolder,
    updateQuickLinkFolder,
    deleteQuickLinkFolder,
    createFolderWithLinks,
    moveLinkToFolder,
    reorderQuickLinks,
    reorderQuickLinkFolders
} from '$lib/server/services/quickLinkFolder.service';
import { logActionError } from '$lib/server/services/actionError.service';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import {
    quickLinkCreateSchema,
    quickLinkUpdateSchema,
    quickLinkDeleteSchema,
    quickLinkFolderCreateSchema,
    quickLinkFolderUpdateSchema,
    quickLinkFolderDeleteSchema,
    quickLinkMoveToFolderSchema,
    quickLinkFolderReorderSchema,
    quickLinkReorderSchema,
    quickLinkCreateFolderFromLinksSchema
} from '$lib/schemas/quickLink';

function formArray(formData: FormData, key: string) {
    return formData
        .getAll(key)
        .flatMap((value) => (typeof value === 'string' && value.trim().startsWith('[') ? (JSON.parse(value) as unknown[]) : [value]))
        .map((value) => String(value))
        .filter((value) => value.length > 0);
}

export const load: PageServerLoad = async (event) => {
    const { workspace } = requireWorkspace(event);
    const [links, folders] = await Promise.all([listQuickLinks(workspace.id), listQuickLinkFolders(workspace.id)]);
    return {
        quickLinks: links,
        quickLinkFolders: folders
    };
};

export const actions: Actions = {
    create: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const parsed = quickLinkCreateSchema.safeParse(raw);
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        try {
            await createQuickLink(workspace.id, user.id, parsed.data);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to create quick link';
            const status = message === 'Invalid URL' ? 400 : 500;
            const errorId = await logActionError(event, { message, status, stack: e instanceof Error ? e.stack : undefined });
            return fail(status, { error: message, errorId });
        }
        throw redirect(303, '/quick-links');
    },
    update: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const parsed = quickLinkUpdateSchema.safeParse(raw);
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        try {
            await updateQuickLink(workspace.id, user.id, parsed.data.id, parsed.data);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to update quick link';
            const status = message === 'Quick link not found' ? 404 : 500;
            const errorId = await logActionError(event, { message, status, stack: e instanceof Error ? e.stack : undefined });
            return fail(status, { error: message, errorId });
        }
        throw redirect(303, '/quick-links');
    },
    delete: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const parsed = quickLinkDeleteSchema.safeParse(raw);
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        try {
            await softDeleteQuickLink(workspace.id, user.id, parsed.data.id);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to delete quick link';
            const status = message === 'Quick link not found' ? 404 : 500;
            const errorId = await logActionError(event, { message, status, stack: e instanceof Error ? e.stack : undefined });
            return fail(status, { error: message, errorId });
        }
        throw redirect(303, '/quick-links');
    },
    createFolder: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const parsed = quickLinkFolderCreateSchema.safeParse(raw);
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        try {
            await createQuickLinkFolder(workspace.id, user.id, parsed.data.name);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to create folder';
            const errorId = await logActionError(event, { message, status: 500, stack: e instanceof Error ? e.stack : undefined });
            return fail(500, { error: message, errorId });
        }
        throw redirect(303, '/quick-links');
    },
    updateFolder: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const parsed = quickLinkFolderUpdateSchema.safeParse(raw);
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        try {
            await updateQuickLinkFolder(workspace.id, user.id, parsed.data.id, parsed.data.name);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to update folder';
            const status = message === 'Quick link folder not found' ? 404 : 500;
            const errorId = await logActionError(event, { message, status, stack: e instanceof Error ? e.stack : undefined });
            return fail(status, { error: message, errorId });
        }
        throw redirect(303, '/quick-links');
    },
    deleteFolder: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const parsed = quickLinkFolderDeleteSchema.safeParse(raw);
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        try {
            await deleteQuickLinkFolder(workspace.id, user.id, parsed.data.id);
            return { success: true };
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to delete folder';
            const status = message === 'Quick link folder not found' ? 404 : 500;
            const errorId = await logActionError(event, { message, status, stack: e instanceof Error ? e.stack : undefined });
            return fail(status, { error: message, errorId });
        }
    },
    moveToFolder: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const parsed = quickLinkMoveToFolderSchema.safeParse(raw);
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        try {
            await moveLinkToFolder(workspace.id, user.id, parsed.data.linkId, parsed.data.folderId ?? null);
            return { success: true };
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to move link';
            const status = message === 'Quick link not found' ? 404 : 500;
            const errorId = await logActionError(event, { message, status, stack: e instanceof Error ? e.stack : undefined });
            return fail(status, { error: message, errorId });
        }
    },
    reorderLinks: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const formData = await event.request.formData();
        const parsed = quickLinkReorderSchema.safeParse({ linkIds: formArray(formData, 'linkIds') });
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        try {
            await reorderQuickLinks(workspace.id, user.id, parsed.data.linkIds);
            return { success: true };
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to reorder links';
            const errorId = await logActionError(event, { message, status: 500, stack: e instanceof Error ? e.stack : undefined });
            return fail(500, { error: message, errorId });
        }
    },
    createFolderFromLinks: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const formData = await event.request.formData();
        const parsed = quickLinkCreateFolderFromLinksSchema.safeParse({
            linkIds: formArray(formData, 'linkIds'),
            name: formData.get('name') ?? undefined
        });
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        try {
            const folder = await createFolderWithLinks(workspace.id, user.id, parsed.data.linkIds, parsed.data.name);
            return { success: true, folder };
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to create folder';
            const errorId = await logActionError(event, { message, status: 500, stack: e instanceof Error ? e.stack : undefined });
            return fail(500, { error: message, errorId });
        }
    },
    reorderFolders: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const formData = await event.request.formData();
        const parsed = quickLinkFolderReorderSchema.safeParse({ folderIds: formArray(formData, 'folderIds') });
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        try {
            await reorderQuickLinkFolders(workspace.id, user.id, parsed.data.folderIds);
            return { success: true };
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to reorder folders';
            const errorId = await logActionError(event, { message, status: 500, stack: e instanceof Error ? e.stack : undefined });
            return fail(500, { error: message, errorId });
        }
    }
};
