import { requireWorkspace } from '$lib/server/guards';
import { dashboardFor } from '$lib/server/services/dashboard.service';
import type { Actions, PageServerLoad } from './$types';
import { handleQuickLinkAction } from '$lib/server/services/quickLinkAction.service';

export const load: PageServerLoad = async (event) => {
    const { workspace } = requireWorkspace(event);
    const data = await dashboardFor(workspace.id);
    return data;
};

export const actions: Actions = {
    create: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'create', '/dashboard');
    },
    update: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'update', '/dashboard');
    },
    delete: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'delete', '/dashboard');
    },
    createFolder: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'createFolder', '/dashboard');
    },
    updateFolder: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'updateFolder', '/dashboard');
    },
    deleteFolder: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'deleteFolder', '/dashboard');
    },
    moveToFolder: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'moveToFolder', '/dashboard');
    },
    reorderLinks: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'reorderLinks', '/dashboard');
    },
    createFolderFromLinks: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'createFolderFromLinks', '/dashboard');
    },
    reorderFolders: (event) => {
        const { workspace, user } = requireWorkspace(event);
        return handleQuickLinkAction(event, workspace, user, 'reorderFolders', '/dashboard');
    }
};
