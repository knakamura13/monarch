import { randomUUID } from 'node:crypto';
import { ddbGet, ddbPut, ddbUpdate, ddbQuery } from '$lib/server/dynamo/ops';
import { entitySk, wsPk } from '$lib/server/dynamo/keys';
import { logActivity } from '$lib/server/activity';
import type { TaskItem } from '$lib/server/dynamo/types';
import type { TaskCreate, TaskUpdate, TaskStatus } from '$lib/schemas/task';

export async function listTasks(workspaceId: string): Promise<TaskItem[]> {
    const rows = await ddbQuery<TaskItem>({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': wsPk(workspaceId), ':prefix': 'Task#' },
        ConsistentRead: true
    });
    return rows.filter((t) => !t.deletedAt);
}

export async function getTask(workspaceId: string, id: string) {
    const task = await ddbGet<TaskItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('Task', id),
        ConsistentRead: true
    });
    if (!task || task.deletedAt) return null;
    return {
        ...task,
        checklist: task.checklist ?? []
    };
}

export async function createTask(workspaceId: string, actorId: string, input: TaskCreate) {
    const existingTasks = await listTasks(workspaceId);
    const statusTasks = existingTasks.filter((t) => t.status === (input.status || 'To do'));
    const order = statusTasks.length;

    const now = new Date().toISOString();
    const task = {
        id: randomUUID(),
        workspaceId,
        ...input,
        order,
        deletedAt: null as string | null,
        createdAt: now,
        updatedAt: now,
        checklist: []
    };

    // Extract checklist from input to handle separately
    const checklist = input.checklist;
    delete (task as unknown as TaskItem).checklist;

    await ddbPut({
        PK: wsPk(workspaceId),
        SK: entitySk('Task', task.id),
        ...task
    });

    // Set checklist if provided
    if (checklist && checklist.length > 0) {
        await setChecklist(workspaceId, actorId, task.id, checklist);
    }

    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'TASK_CREATED',
        entityType: 'Task',
        entityId: task.id,
        summary: `Task "${task.title}" created`
    });
    return task;
}

export async function updateTask(workspaceId: string, actorId: string, id: string, input: TaskUpdate) {
    const existing = await ddbGet<TaskItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('Task', id)
    });
    if (!existing) throw new Error('Task not found');
    if (existing.deletedAt) throw new Error('Task not found');

    // Handle checklist separately to preserve taskId and order fields
    if (input.checklist !== undefined) {
        await setChecklist(workspaceId, actorId, id, input.checklist);
        delete input.checklist;
    }

    const patch: Record<string, unknown> = { ...input, updatedAt: new Date().toISOString() };
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const sets: string[] = [];
    for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        const nk = `#${k}`;
        const vk = `:${k}`;
        Reflect.set(names, nk, k);
        Reflect.set(values, vk, v);
        sets.push(`${nk} = ${vk}`);
    }

    let task;
    if (sets.length > 0) {
        task = (await ddbUpdate<TaskItem>(
            { PK: wsPk(workspaceId), SK: entitySk('Task', id) },
            `SET ${sets.join(', ')}`,
            values,
            names
        )) ?? { ...existing, ...patch };
    } else {
        task = existing;
    }

    const statusChanged = input.status && input.status !== existing.status;
    await logActivity({
        workspaceId,
        userId: actorId,
        action: statusChanged ? 'STATUS_CHANGE' : 'TASK_UPDATED',
        entityType: 'Task',
        entityId: task.id,
        summary: statusChanged ? `Task "${task.title}" moved to ${task.status}` : `Task "${task.title}" updated`
    });
    return task;
}

export async function softDeleteTask(workspaceId: string, actorId: string, id: string) {
    const existing = await ddbGet<TaskItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('Task', id)
    });
    if (!existing) throw new Error('Task not found');
    if (existing.deletedAt) throw new Error('Task not found');
    await ddbUpdate(
        { PK: wsPk(workspaceId), SK: entitySk('Task', id) },
        'SET #deletedAt = :d, #updatedAt = :u',
        { ':d': new Date().toISOString(), ':u': new Date().toISOString() },
        { '#deletedAt': 'deletedAt', '#updatedAt': 'updatedAt' }
    );
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'TASK_DELETED',
        entityType: 'Task',
        entityId: id,
        summary: `Task "${existing.title}" deleted`
    });
}

export async function restoreTask(workspaceId: string, actorId: string, id: string) {
    const existing = await ddbGet<TaskItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('Task', id)
    });
    if (!existing) throw new Error('Task not found');
    if (!existing.deletedAt) throw new Error('Task not deleted');
    await ddbUpdate(
        { PK: wsPk(workspaceId), SK: entitySk('Task', id) },
        'SET #deletedAt = :d, #updatedAt = :u',
        { ':d': null, ':u': new Date().toISOString() },
        { '#deletedAt': 'deletedAt', '#updatedAt': 'updatedAt' }
    );
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'TASK_UPDATED',
        entityType: 'Task',
        entityId: id,
        summary: `Task "${existing.title}" restored`
    });
}

export async function setChecklist(
    workspaceId: string,
    actorId: string,
    taskId: string,
    items: { id?: string; text: string; done: boolean }[]
) {
    const task = await ddbGet<TaskItem>({ PK: wsPk(workspaceId), SK: entitySk('Task', taskId) });
    if (!task) throw new Error('Task not found');
    if (task.deletedAt) throw new Error('Task not found');
    const checklist = items.map((item, idx) => ({
        id: item.id ?? randomUUID(),
        taskId,
        text: item.text,
        done: item.done,
        order: idx
    }));
    await ddbUpdate(
        { PK: wsPk(workspaceId), SK: entitySk('Task', taskId) },
        'SET #checklist = :c, #updatedAt = :u',
        { ':c': checklist, ':u': new Date().toISOString() },
        { '#checklist': 'checklist', '#updatedAt': 'updatedAt' }
    );
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'TASK_UPDATED',
        entityType: 'Task',
        entityId: taskId,
        summary: `Updated checklist on "${task.title}"`
    });
}

export async function reorderOnBoard(workspaceId: string, actorId: string, updates: { id: string; status: TaskStatus; order: number }[]) {
    for (const u of updates) {
        const existing = await ddbGet<TaskItem>({
            PK: wsPk(workspaceId),
            SK: entitySk('Task', u.id)
        });
        if (!existing) throw new Error('Task not found');
        if (existing.deletedAt) throw new Error('Task not found');
        await ddbUpdate<TaskItem>(
            { PK: wsPk(workspaceId), SK: entitySk('Task', u.id) },
            'SET #status = :s, #order = :o, #updatedAt = :u',
            { ':s': u.status, ':o': u.order, ':u': new Date().toISOString() },
            { '#status': 'status', '#order': 'order', '#updatedAt': 'updatedAt' }
        );
    }
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'TASK_UPDATED',
        entityType: 'Task',
        entityId: updates[0]?.id ?? 'batch',
        summary: `Reordered ${updates.length} tasks on the board`
    });
}
