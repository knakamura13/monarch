import type { PageServerLoad, Actions } from './$types';
import { requireWorkspace, requireOwner } from '$lib/server/guards';
import {
    getEvidenceCategories,
    incrementEvidenceCount,
    updateEvidenceTarget,
    addEvidenceCategory,
    renameEvidenceCategory,
    deleteEvidenceCategory
} from '$lib/server/services/evidence.service';
import { fail } from '@sveltejs/kit';
import { logActionError } from '$lib/server/services/actionError.service';
import { evidenceCategoryEditSchema } from '$lib/schemas/evidence';

export const load: PageServerLoad = async (event) => {
    const { workspace } = requireWorkspace(event);
    const categories = await getEvidenceCategories(workspace.id);
    const isOwner = workspace.role === 'OWNER';

    return { categories, isOwner };
};

export const actions: Actions = {
    updateTarget: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const formData = await event.request.formData();
        const category = formData.get('category') as string;
        const raw = formData.get('target') as string;
        const target = parseInt(raw, 10);

        if (!category || isNaN(target) || target < 0) {
            return fail(400, { error: 'Invalid input' });
        }

        try {
            await updateEvidenceTarget(workspace.id, user.id, category, target);
            return {};
        } catch (e) {
            return fail(400, { error: e instanceof Error ? e.message : 'Failed to update target' });
        }
    },
    adjustCount: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const formData = await event.request.formData();
        const category = formData.get('category') as string;
        const deltaStr = formData.get('delta') as string;

        if (!category || !deltaStr) {
            return fail(400, { error: 'Invalid input' });
        }

        const delta = parseInt(deltaStr, 10);

        if (isNaN(delta) || delta === 0) {
            return fail(400, { error: 'Invalid input' });
        }

        if (Math.abs(delta) > 100) {
            return fail(400, { error: 'Delta too large (max 100)' });
        }

        try {
            await incrementEvidenceCount(workspace.id, user.id, category, delta);
            return {};
        } catch (e) {
            return fail(400, { error: e instanceof Error ? e.message : 'Failed to adjust count' });
        }
    },
    addCategory: async (event) => {
        const { workspace, user } = requireOwner(event);
        const formData = await event.request.formData();
        const category = formData.get('category') as string;

        if (!category) {
            return fail(400, { error: 'Category name is required' });
        }

        try {
            await addEvidenceCategory(workspace.id, user.id, category);
            return {};
        } catch (e) {
            return fail(400, { error: e instanceof Error ? e.message : 'Failed to add category' });
        }
    },
    editCategory: async (event) => {
        const { workspace, user } = requireOwner(event);
        const raw = Object.fromEntries(await event.request.formData());
        const parsed = evidenceCategoryEditSchema.safeParse(raw);
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }

        const { oldCategory, newCategory, newTarget } = parsed.data;
        try {
            // Update category name if it changed
            if (oldCategory !== newCategory) {
                await renameEvidenceCategory(workspace.id, user.id, oldCategory, newCategory);
            }
            // Update target count
            await updateEvidenceTarget(workspace.id, user.id, newCategory, newTarget);
            return {};
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to edit category';
            const errorId = await logActionError(event, { message, status: 500, stack: e instanceof Error ? e.stack : undefined });
            return fail(500, { error: message, errorId });
        }
    },
    deleteCategory: async (event) => {
        const { workspace, user } = requireOwner(event);
        const formData = await event.request.formData();
        const category = formData.get('category') as string;

        if (!category) {
            return fail(400, { error: 'Category name is required' });
        }

        try {
            await deleteEvidenceCategory(workspace.id, user.id, category);
            return {};
        } catch (e) {
            return fail(400, { error: e instanceof Error ? e.message : 'Failed to delete category' });
        }
    }
};
