import { json } from '@sveltejs/kit';
import { ENV } from '$lib/server/env';
import { randomUUID } from 'node:crypto';
import { ddbGet, ddbPut } from '$lib/server/dynamo/ops';
import { entitySk, wsPk } from '$lib/server/dynamo/keys';

export const POST = async () => {
    if (ENV.NODE_ENV === 'production') {
        return json({ ok: false, error: 'Not available in production' }, { status: 404 });
    }

    const workspaceId = `smoke_${randomUUID()}`;
    const now = new Date().toISOString();

    const workspace = {
        PK: wsPk(workspaceId),
        SK: entitySk('Workspace', workspaceId),
        id: workspaceId,
        name: 'Smoke Workspace',
        ownerId: null,
        evidenceTargets: null,
        createdAt: now,
        updatedAt: now
    };

    const taskId = randomUUID();
    const task = {
        PK: wsPk(workspaceId),
        SK: entitySk('Task', taskId),
        id: taskId,
        workspaceId,
        title: 'Smoke Task',
        description: null,
        dueDate: null,
        priority: 'MEDIUM',
        status: 'To do',
        linkedEvidenceId: null,
        linkedMilestoneId: null,
        order: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        checklist: []
    };

    await Promise.all([ddbPut(workspace), ddbPut(task)]);

    const roundTripWs = await ddbGet<typeof workspace>({ PK: workspace.PK, SK: workspace.SK });
    const roundTripTask = await ddbGet<typeof task>({ PK: task.PK, SK: task.SK });

    return json({
        ok: Boolean(roundTripWs && roundTripTask),
        workspaceId,
        taskId
    });
};
