import { beforeEach, describe, expect, it } from 'vitest';
import { createMilestone, currentPhase, listMilestones, reorderMilestonesInPhase } from '$lib/server/services/milestone.service';

const actorId = 'test-user';

function workspaceId() {
    return `ws_${Math.random().toString(36).slice(2, 10)}`;
}

describe('currentPhase', () => {
    beforeEach(() => {
        (globalThis as unknown as { __ddbMem?: Map<string, unknown> }).__ddbMem = new Map();
    });

    it('returns OUTCOME when no milestones exist', () => {
        expect(currentPhase([])).toBe('OUTCOME');
    });

    it('returns the earliest phase that still has open work', () => {
        expect(
            currentPhase([
                { phase: 'PREPARATION', status: 'Done' },
                { phase: 'PREPARATION', status: 'Done' },
                { phase: 'RELATIONSHIP_EVIDENCE', status: 'Doing' },
                { phase: 'PACKET_DRAFTING', status: 'To do' }
            ])
        ).toBe('RELATIONSHIP_EVIDENCE');
    });

    it('skips phases with all Done milestones', () => {
        expect(
            currentPhase([
                { phase: 'PREPARATION', status: 'Done' },
                { phase: 'RELATIONSHIP_EVIDENCE', status: 'Done' },
                { phase: 'FILING', status: 'To do' }
            ])
        ).toBe('FILING');
    });

    it('returns OUTCOME when everything is done', () => {
        expect(
            currentPhase([
                { phase: 'PREPARATION', status: 'Done' },
                { phase: 'OUTCOME', status: 'Done' }
            ])
        ).toBe('OUTCOME');
    });
});

describe('reorderMilestonesInPhase', () => {
    beforeEach(() => {
        (globalThis as unknown as { __ddbMem?: Map<string, unknown> }).__ddbMem = new Map();
    });

    it('reorders milestones only within the requested phase', async () => {
        const ws = workspaceId();

        const first = await createMilestone(ws, actorId, {
            title: 'First',
            description: null,
            phase: 'PREPARATION',
            dueDate: null,
            scheduledAt: null,
            status: 'To do',
            priority: 'MEDIUM',
            subTasks: [],
            location: null
        });
        const second = await createMilestone(ws, actorId, {
            title: 'Second',
            description: null,
            phase: 'PREPARATION',
            dueDate: null,
            scheduledAt: null,
            status: 'To do',
            priority: 'MEDIUM',
            subTasks: [],
            location: null
        });
        const otherPhase = await createMilestone(ws, actorId, {
            title: 'Elsewhere',
            description: null,
            phase: 'FILING',
            dueDate: null,
            scheduledAt: null,
            status: 'To do',
            priority: 'MEDIUM',
            subTasks: [],
            location: null
        });

        await reorderMilestonesInPhase(ws, actorId, 'PREPARATION', [second.id, first.id]);

        const milestones = await listMilestones(ws);
        const byId = Object.fromEntries(milestones.map((m) => [m.id, m]));

        expect(byId[second.id]!.order).toBe(0);
        expect(byId[first.id]!.order).toBe(1);
        expect(byId[otherPhase.id]!.order).toBe(0);
    });

    it('throws when the payload is missing milestones from the phase', async () => {
        const ws = workspaceId();

        const first = await createMilestone(ws, actorId, {
            title: 'First',
            description: null,
            phase: 'PREPARATION',
            dueDate: null,
            scheduledAt: null,
            status: 'To do',
            priority: 'MEDIUM',
            subTasks: [],
            location: null
        });
        await createMilestone(ws, actorId, {
            title: 'Second',
            description: null,
            phase: 'PREPARATION',
            dueDate: null,
            scheduledAt: null,
            status: 'To do',
            priority: 'MEDIUM',
            subTasks: [],
            location: null
        });

        await expect(reorderMilestonesInPhase(ws, actorId, 'PREPARATION', [first.id])).rejects.toThrow(
            'Milestone reorder payload did not match phase contents'
        );
    });
});
