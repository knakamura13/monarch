import { listTasks, reorderOnBoard, createTask, updateTask, softDeleteTask } from '$lib/server/services/task.service';
import { fail } from '@sveltejs/kit';
import { requireWorkspace } from '$lib/server/guards';
import { taskStatusEnum } from '$lib/schemas/task';
import { getMembers } from '$lib/server/cache/membersCache';
import { logActionError } from '$lib/server/services/actionError.service';
import { taskCreateSchema, taskUpdateSchema } from '$lib/schemas/task';
import type { Actions, PageServerLoad } from './$types';
import { parseJsonField } from '$lib/server/utils/parse';

export const load: PageServerLoad = async (event) => {
    const { workspace } = requireWorkspace(event);
    const tasks = await listTasks(workspace.id);
    const members = await getMembers(workspace.id);

    return {
        tasks,
        members: members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email })),
        // Add timestamp to indicate fresh data
        timestamp: Date.now()
    };
};

export const actions: Actions = {
    reorder: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const formData = await event.request.formData();
        const updatesJson = formData.get('updates') as string;
        if (!updatesJson) return fail(400, { error: 'Missing updates' });

        try {
            const rawUpdates = JSON.parse(updatesJson) as Array<{ id: string; status: string; order: number }>;
            const updates: Array<{ id: string; status: 'To do' | 'Doing' | 'On hold' | 'Done'; order: number }> = [];
            for (const u of rawUpdates) {
                const parsed = taskStatusEnum.safeParse(u.status);
                if (!parsed.success) {
                    return fail(400, { error: `Invalid status: ${u.status}` });
                }
                updates.push({ id: u.id, status: parsed.data, order: u.order });
            }
            await reorderOnBoard(workspace.id, user.id, updates);
            return { success: true };
        } catch {
            return fail(500, { error: 'Failed to reorder tasks' });
        }
    },
    create: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const checklist = raw.checklist ? await parseJsonField(raw, 'checklist', event) : undefined;
        const parsed = taskCreateSchema.safeParse({
            ...raw,
            checklist
        });
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        await createTask(workspace.id, user.id, parsed.data);
        return { success: true };
    },
    update: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const taskId = raw.id as string;
        if (!taskId) return fail(400, { error: 'Missing task id' });

        const checklist = raw.checklist ? await parseJsonField(raw, 'checklist', event) : undefined;
        const parsed = taskUpdateSchema.safeParse({
            ...raw,
            checklist
        });
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        await updateTask(workspace.id, user.id, taskId, parsed.data);
        return { success: true };
    },
    delete: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const formData = await event.request.formData();
        const taskId = formData.get('id') as string;
        if (!taskId) return fail(400, { error: 'Missing task id' });
        await softDeleteTask(workspace.id, user.id, taskId);
        return { success: true };
    }
};
