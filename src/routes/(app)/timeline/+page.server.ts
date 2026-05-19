import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireWorkspace } from '$lib/server/guards';
import { logActionError } from '$lib/server/services/actionError.service';
import {
    listMilestones,
    currentPhase,
    updateMilestone,
    softDeleteMilestone,
    createMilestone,
    reorderMilestonesInPhase
} from '$lib/server/services/milestone.service';
import { milestoneUpdateSchema, milestoneCreateSchema, milestoneReorderSchema } from '$lib/schemas/milestone';
import { getMembers } from '$lib/server/cache/membersCache';
import type { MilestonePhase, MilestoneStatus } from '$lib/types/enums';
import { parseJsonField } from '$lib/server/utils/parse';

export const load: PageServerLoad = async (event) => {
    const { workspace } = requireWorkspace(event);
    const milestones = await listMilestones(workspace.id);
    const phase = currentPhase(
        milestones.map((m) => ({
            phase: m.phase as MilestonePhase,
            status: m.status as MilestoneStatus
        }))
    );
    const members = await getMembers(workspace.id);
    return { milestones, phase, members: members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email })) };
};

export const actions: Actions = {
    create: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const subTasks = raw.subTasks ? await parseJsonField(raw, 'subTasks', event) : [];
        const parsed = milestoneCreateSchema.safeParse({
            ...raw,
            subTasks
        });
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        const m = await createMilestone(workspace.id, user.id, parsed.data);
        return { success: true, id: m.id };
    },
    update: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const id = raw.id as string;
        const subTasks = raw.subTasks ? await parseJsonField(raw, 'subTasks', event) : [];
        const parsed = milestoneUpdateSchema.safeParse({
            ...raw,
            subTasks
        });
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        await updateMilestone(workspace.id, user.id, id, parsed.data);
        return { ok: true };
    },
    reorder: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const milestoneIds = raw.milestoneIds ? await parseJsonField<string[]>(raw, 'milestoneIds', event) : [];
        const parsed = milestoneReorderSchema.safeParse({
            phase: raw.phase,
            milestoneIds
        });
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        await reorderMilestonesInPhase(workspace.id, user.id, parsed.data.phase, parsed.data.milestoneIds);
        return { ok: true };
    },
    delete: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const id = raw.id as string;
        await softDeleteMilestone(workspace.id, user.id, id);
        return { ok: true };
    }
};
