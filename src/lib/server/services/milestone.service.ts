/* eslint-disable security/detect-object-injection */
import type { MilestonePhase, MilestoneStatus } from '$lib/types/enums';
import { logActivity } from '$lib/server/activity';
import type { MilestoneCreate, MilestoneUpdate } from '$lib/schemas/milestone';
import { randomUUID } from 'node:crypto';
import { ddbGet, ddbPut, ddbQuery, ddbUpdate } from '$lib/server/dynamo/ops';
import { entitySk, wsPk } from '$lib/server/dynamo/keys';
import type { MilestoneItem } from '$lib/server/dynamo/types';
import { PHASE_ORDER } from '$lib/constants/phases';

export async function listMilestones(
    workspaceId: string,
    filter: { phase?: MilestonePhase; status?: MilestoneStatus; limit?: number } = {}
) {
    const rows = await ddbQuery<MilestoneItem>({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': wsPk(workspaceId), ':prefix': 'TimelineMilestone#' },
        Limit: filter.limit ?? 1000
    });
    const filtered = rows
        .filter((m) => !m.deletedAt)
        .filter((m) => (filter.phase ? (m.phase as MilestonePhase) === filter.phase : true))
        .filter((m) => (filter.status ? (m.status as MilestoneStatus) === filter.status : true))
        .map((m) => ({
            ...m,
            subTasks: m.subTasks ?? []
        }));
    filtered.sort(
        (a, b) =>
            String(a.phase).localeCompare(String(b.phase)) ||
            Number(a.order ?? 0) - Number(b.order ?? 0) ||
            Number(new Date(a.dueDate ?? 0).getTime()) - Number(new Date(b.dueDate ?? 0).getTime())
    );
    return filtered;
}

export async function getMilestone(workspaceId: string, id: string) {
    const milestone = await ddbGet<MilestoneItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('TimelineMilestone', id)
    });
    if (!milestone || milestone.deletedAt) return null;
    const phase = milestone.phase as MilestonePhase;
    const status = milestone.status as MilestoneStatus;
    return {
        ...milestone,
        phase,
        status,
        subTasks: milestone.subTasks ?? []
    };
}

export async function createMilestone(workspaceId: string, actorId: string, input: MilestoneCreate) {
    const existing = await listMilestones(workspaceId, { phase: input.phase });
    const order = existing.length;
    const now = new Date().toISOString();
    const milestone = {
        id: randomUUID(),
        workspaceId,
        ...input,
        order,
        completedAt: null as string | null,
        deletedAt: null as string | null,
        createdAt: now,
        updatedAt: now
    };
    await ddbPut({
        PK: wsPk(workspaceId),
        SK: entitySk('TimelineMilestone', milestone.id),
        ...milestone
    });
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'MILESTONE_CREATED',
        entityType: 'TimelineMilestone',
        entityId: milestone.id,
        summary: `Milestone "${milestone.title}" added in ${milestone.phase}`
    });
    return milestone;
}

export async function updateMilestone(workspaceId: string, actorId: string, id: string, input: MilestoneUpdate) {
    const existing = await ddbGet<MilestoneItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('TimelineMilestone', id)
    });
    if (!existing) throw new Error('Milestone not found');
    if (existing.deletedAt) throw new Error('Milestone not found');
    const completedAt =
        input.status === 'Done' && !existing.completedAt
            ? new Date().toISOString()
            : input.status && input.status !== 'Done'
              ? null
              : undefined;
    const patch: Record<string, unknown> = { ...input, updatedAt: new Date().toISOString() };
    if (completedAt !== undefined) patch.completedAt = completedAt;
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const sets: string[] = [];
    for (const [k, v] of Object.entries(patch)) {
        const nk = `#${k}`;
        const vk = `:${k}`;
        names[nk] = k;
        values[vk] = v;
        sets.push(`${nk} = ${vk}`);
    }
    const milestone = (await ddbUpdate<MilestoneItem>(
        { PK: wsPk(workspaceId), SK: entitySk('TimelineMilestone', id) },
        `SET ${sets.join(', ')}`,
        values,
        names
    )) ?? { ...existing, ...patch };
    const statusChanged = input.status && input.status !== existing.status;
    await logActivity({
        workspaceId,
        userId: actorId,
        action: statusChanged ? 'STATUS_CHANGE' : 'MILESTONE_UPDATED',
        entityType: 'TimelineMilestone',
        entityId: milestone.id,
        summary: statusChanged ? `Milestone "${milestone.title}" marked ${milestone.status}` : `Milestone "${milestone.title}" updated`
    });
    return milestone;
}

export async function reorderMilestonesInPhase(workspaceId: string, actorId: string, phase: MilestonePhase, milestoneIds: string[]) {
    const existing = await listMilestones(workspaceId, { phase });
    const existingIds = existing.map((m) => m.id);

    if (existingIds.length !== milestoneIds.length) {
        throw new Error('Milestone reorder payload did not match phase contents');
    }

    const existingSet = new Set(existingIds);
    if (milestoneIds.some((id) => !existingSet.has(id))) {
        throw new Error('Milestone reorder payload did not match phase contents');
    }

    const now = new Date().toISOString();
    for (const [index, milestoneId] of milestoneIds.entries()) {
        await ddbUpdate(
            { PK: wsPk(workspaceId), SK: entitySk('TimelineMilestone', milestoneId) },
            'SET #order = :o, #updatedAt = :u',
            { ':o': index, ':u': now },
            { '#order': 'order', '#updatedAt': 'updatedAt' }
        );
    }

    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'MILESTONE_UPDATED',
        entityType: 'TimelineMilestone',
        entityId: phase,
        summary: `Reordered ${milestoneIds.length} milestones in ${phase}`
    });
}

export async function softDeleteMilestone(workspaceId: string, actorId: string, id: string) {
    const existing = await ddbGet<MilestoneItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('TimelineMilestone', id)
    });
    if (!existing) throw new Error('Milestone not found');
    if (existing.deletedAt) throw new Error('Milestone not found');
    await ddbUpdate(
        { PK: wsPk(workspaceId), SK: entitySk('TimelineMilestone', id) },
        'SET #deletedAt = :d, #updatedAt = :u',
        { ':d': new Date().toISOString(), ':u': new Date().toISOString() },
        { '#deletedAt': 'deletedAt', '#updatedAt': 'updatedAt' }
    );
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'MILESTONE_DELETED',
        entityType: 'TimelineMilestone',
        entityId: id,
        summary: `Milestone "${existing.title}" deleted`
    });
}

export function currentPhase(milestones: { phase: MilestonePhase; status: MilestoneStatus }[]): MilestonePhase {
    // Current phase = the earliest phase with any non-Done milestone; else OUTCOME.
    for (const phase of PHASE_ORDER) {
        const inPhase = milestones.filter((m) => m.phase === phase);
        if (inPhase.length === 0) continue;
        if (inPhase.some((m) => m.status !== 'Done')) return phase;
    }
    return 'OUTCOME';
}
