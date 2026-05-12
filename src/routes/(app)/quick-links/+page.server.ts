import { requireWorkspace } from '$lib/server/guards';
import { listQuickLinks } from '$lib/server/services/quickLink.service';
import { listQuickLinkFolders } from '$lib/server/services/quickLinkFolder.service';
import type { Actions, PageServerLoad } from './$types';
import { handleQuickLinkAction } from '$lib/server/services/quickLinkAction.service';

export const load: PageServerLoad = async (event) => {
    const { workspace } = requireWorkspace(event);
    const [links, folders] = await Promise.all([listQuickLinks(workspace.id), listQuickLinkFolders(workspace.id)]);
    return {
        quickLinks: links,
        quickLinkFolders: folders
    };
};

export const actions: Actions = {
    create: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'create', '/quick-links');
    },
    update: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'update', '/quick-links');
    },
    delete: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'delete', '/quick-links');
    },
    createFolder: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'createFolder', '/quick-links');
    },
    updateFolder: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'updateFolder', '/quick-links');
    },
    deleteFolder: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'deleteFolder', '/quick-links');
    },
    moveToFolder: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'moveToFolder', '/quick-links');
    },
    reorderLinks: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'reorderLinks', '/quick-links');
    },
    createFolderFromLinks: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'createFolderFromLinks', '/quick-links');
    },
    reorderFolders: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'reorderFolders', '/quick-links');
    }
};
