import { describe, it, expect, beforeEach } from 'vitest';

import { createTask, listTasks, reorderOnBoard, restoreTask, setChecklist, softDeleteTask } from '$lib/server/services/task.service';

const actorId = 'test-user';

function workspaceId() {
    return `ws_${Math.random().toString(36).slice(2, 10)}`;
}

describe('task.service', () => {
    beforeEach(() => {
        (globalThis as unknown as { __ddbMem?: Map<string, unknown> }).__ddbMem = new Map();
    });

    // -------------------------------------------------------------------------
    // createTask
    // -------------------------------------------------------------------------
    describe('createTask', () => {
        it('creates a task successfully', async () => {
            const ws = workspaceId();
            const task = await createTask(ws, actorId, {
                title: 'Gather documents',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });

            expect(task.id).toBeTruthy();
            expect(task.title).toBe('Gather documents');
            expect(task.status).toBe('To do');
            expect(task.workspaceId).toBe(ws);
        });

        it('sets order by counting existing tasks in the same status bucket', async () => {
            const ws = workspaceId();

            const t1 = await createTask(ws, actorId, {
                title: 'Task 1',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });
            const t2 = await createTask(ws, actorId, {
                title: 'Task 2',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });
            const t3 = await createTask(ws, actorId, {
                title: 'Task 3',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'Doing',
                checklist: []
            });

            expect(t1.order).toBe(0);
            expect(t2.order).toBe(1);
            // Different status bucket — starts at 0 again
            expect(t3.order).toBe(0);
        });

        it('defaults status to TODO when not specified', async () => {
            const ws = workspaceId();
            const task = await createTask(ws, actorId, {
                title: 'Implicit TODO',
                description: null,
                dueDate: null,
                priority: 'LOW',
                status: 'To do',
                checklist: []
            });

            expect(task.status).toBe('To do');
        });

        it('stores the task so listTasks can retrieve it', async () => {
            const ws = workspaceId();
            const created = await createTask(ws, actorId, {
                title: 'Findable task',
                description: null,
                dueDate: null,
                priority: 'HIGH',
                status: 'To do',
                checklist: []
            });

            const all = await listTasks(ws);
            expect(all.some((t) => t.id === created.id)).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // reorderOnBoard
    // -------------------------------------------------------------------------
    describe('reorderOnBoard', () => {
        it('reorders tasks on the board correctly', async () => {
            const ws = workspaceId();

            const t1 = await createTask(ws, actorId, {
                title: 'First',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });
            const t2 = await createTask(ws, actorId, {
                title: 'Second',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });

            // Swap them: t2 goes to position 0, t1 goes to position 1; both move to IN_PROGRESS
            await reorderOnBoard(ws, actorId, [
                { id: t2.id, status: 'Doing', order: 0 },
                { id: t1.id, status: 'Doing', order: 1 }
            ]);

            const tasks = await listTasks(ws);
            const updated1 = tasks.find((t) => t.id === t1.id)!;
            const updated2 = tasks.find((t) => t.id === t2.id)!;

            expect(updated2.order).toBe(0);
            expect(updated1.order).toBe(1);
            expect(updated1.status).toBe('Doing');
            expect(updated2.status).toBe('Doing');
        });

        it('throws when a task ID in the update list does not exist', async () => {
            const ws = workspaceId();

            await expect(reorderOnBoard(ws, actorId, [{ id: 'nonexistent-id', status: 'To do', order: 0 }])).rejects.toThrow(
                'Task not found'
            );
        });

        it('throws when a task in the update list has been soft-deleted', async () => {
            const ws = workspaceId();

            const task = await createTask(ws, actorId, {
                title: 'To be deleted',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });
            await softDeleteTask(ws, actorId, task.id);

            await expect(reorderOnBoard(ws, actorId, [{ id: task.id, status: 'To do', order: 0 }])).rejects.toThrow('Task not found');
        });
    });

    // -------------------------------------------------------------------------
    // restoreTask
    // -------------------------------------------------------------------------
    describe('restoreTask', () => {
        it('throws "Task not deleted" when the task has not been soft-deleted', async () => {
            const ws = workspaceId();

            const task = await createTask(ws, actorId, {
                title: 'Active task',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });

            await expect(restoreTask(ws, actorId, task.id)).rejects.toThrow('Task not deleted');
        });

        it('throws "Task not found" for a non-existent task ID', async () => {
            const ws = workspaceId();

            await expect(restoreTask(ws, actorId, 'does-not-exist')).rejects.toThrow('Task not found');
        });

        it('restores a soft-deleted task so it reappears in listTasks', async () => {
            const ws = workspaceId();

            const task = await createTask(ws, actorId, {
                title: 'Deleted then restored',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });

            await softDeleteTask(ws, actorId, task.id);
            expect((await listTasks(ws)).some((t) => t.id === task.id)).toBe(false);

            await restoreTask(ws, actorId, task.id);
            expect((await listTasks(ws)).some((t) => t.id === task.id)).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // setChecklist
    // -------------------------------------------------------------------------
    describe('setChecklist', () => {
        it('sets checklist items on a task', async () => {
            const ws = workspaceId();

            const task = await createTask(ws, actorId, {
                title: 'Task with checklist',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });

            await setChecklist(ws, actorId, task.id, [
                { text: 'Step one', done: false },
                { text: 'Step two', done: true }
            ]);

            const tasks = await listTasks(ws);
            const updated = tasks.find((t) => t.id === task.id)!;

            expect(updated.checklist).toHaveLength(2);
            expect(updated.checklist![0]!.text).toBe('Step one');
            expect(updated.checklist![0]!.done).toBe(false);
            expect(updated.checklist![1]!.text).toBe('Step two');
            expect(updated.checklist![1]!.done).toBe(true);
        });

        it('assigns sequential order values starting at 0', async () => {
            const ws = workspaceId();

            const task = await createTask(ws, actorId, {
                title: 'Ordered checklist task',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });

            await setChecklist(ws, actorId, task.id, [
                { text: 'A', done: false },
                { text: 'B', done: false },
                { text: 'C', done: false }
            ]);

            const tasks = await listTasks(ws);
            const updated = tasks.find((t) => t.id === task.id)!;
            const orders = updated.checklist!.map((c) => c.order);

            expect(orders).toEqual([0, 1, 2]);
        });

        it('throws when the task does not exist', async () => {
            const ws = workspaceId();

            await expect(setChecklist(ws, actorId, 'nonexistent-task', [{ text: 'Irrelevant', done: false }])).rejects.toThrow(
                'Task not found'
            );
        });

        it('replaces an existing checklist with a new one', async () => {
            const ws = workspaceId();

            const task = await createTask(ws, actorId, {
                title: 'Replace checklist',
                description: null,
                dueDate: null,
                priority: 'MEDIUM',
                status: 'To do',
                checklist: []
            });

            await setChecklist(ws, actorId, task.id, [{ text: 'Original item', done: false }]);
            await setChecklist(ws, actorId, task.id, [{ text: 'Replacement item', done: true }]);

            const tasks = await listTasks(ws);
            const updated = tasks.find((t) => t.id === task.id)!;

            expect(updated.checklist).toHaveLength(1);
            expect(updated.checklist![0]!.text).toBe('Replacement item');
        });
    });
});
