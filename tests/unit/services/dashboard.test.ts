import { describe, it, expect, beforeEach } from 'vitest';
import { dashboardFor } from '$lib/server/services/dashboard.service';
import { ddbPut } from '$lib/server/dynamo/ops';
import { wsPk, entitySk } from '$lib/server/dynamo/keys';

describe('dashboard.service', () => {
    beforeEach(() => {
        (globalThis as unknown as { __ddbMem?: Map<string, unknown> }).__ddbMem = new Map();
    });

    it('calculates dashboard data correctly', async () => {
        const workspaceId = 'ws-1';
        const now = new Date();
        const nowIso = now.toISOString();

        // Mock Workspace
        await ddbPut({
            PK: wsPk(workspaceId),
            SK: entitySk('Workspace', workspaceId),
            id: workspaceId,
            name: 'Test Workspace',
            evidenceCategories: ['Identity', 'Joint Assets'],
            evidenceTargets: { Identity: 2, 'Joint Assets': 5 },
            evidenceCounts: { Identity: 1, 'Joint Assets': 5 },
            createdAt: nowIso,
            updatedAt: nowIso
        });

        // Mock Questions
        await ddbPut({
            PK: wsPk(workspaceId),
            SK: entitySk('QuestionItem', 'q1'),
            id: 'q1',
            priority: 'HIGH',
            status: 'OPEN',
            question: 'Q1',
            createdAt: nowIso,
            updatedAt: nowIso
        });
        await ddbPut({
            PK: wsPk(workspaceId),
            SK: entitySk('QuestionItem', 'q2'),
            id: 'q2',
            priority: 'CRITICAL',
            status: 'RESEARCHING',
            question: 'Q2',
            createdAt: nowIso,
            updatedAt: nowIso
        });
        await ddbPut({
            PK: wsPk(workspaceId),
            SK: entitySk('QuestionItem', 'q3'),
            id: 'q3',
            priority: 'LOW',
            status: 'ANSWERED',
            question: 'Q3',
            createdAt: nowIso,
            updatedAt: nowIso
        });

        // Mock Tasks
        await ddbPut({
            PK: wsPk(workspaceId),
            SK: entitySk('Task', 't1'),
            id: 't1',
            status: 'To do',
            title: 'Task 1',
            order: 0,
            createdAt: nowIso,
            updatedAt: nowIso
        });
        await ddbPut({
            PK: wsPk(workspaceId),
            SK: entitySk('Task', 't2'),
            id: 't2',
            status: 'Doing',
            title: 'Task 2',
            order: 0,
            createdAt: nowIso,
            updatedAt: nowIso
        });
        await ddbPut({
            PK: wsPk(workspaceId),
            SK: entitySk('Task', 't3'),
            id: 't3',
            status: 'Done',
            title: 'Task 3',
            order: 0,
            createdAt: nowIso,
            updatedAt: nowIso
        });

        // Mock Milestones
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        await ddbPut({
            PK: wsPk(workspaceId),
            SK: entitySk('TimelineMilestone', 'm1'),
            id: 'm1',
            phase: 'PREPARATION',
            status: 'Done',
            title: 'Milestone 1',
            order: 0,
            createdAt: nowIso,
            updatedAt: nowIso
        });
        await ddbPut({
            PK: wsPk(workspaceId),
            SK: entitySk('TimelineMilestone', 'm2'),
            id: 'm2',
            phase: 'RELATIONSHIP_EVIDENCE',
            status: 'Doing',
            title: 'Milestone 2',
            order: 0,
            scheduledAt: tomorrow,
            createdAt: nowIso,
            updatedAt: nowIso
        });

        const data = await dashboardFor(workspaceId);

        // Evidence
        expect(data.gapsCount).toBe(1); // Identity has 1/2

        // Questions
        expect(data.openQuestionsCount.HIGH).toBe(1);
        expect(data.openQuestionsCount.CRITICAL).toBe(1);
        expect(data.openQuestionsCount.LOW).toBe(0); // Answered questions shouldn't be in openQuestionsAll

        // Tasks
        expect(data.taskSummary.pending).toBe(1);
        expect(data.taskSummary.inProgress).toBe(1);
        expect(data.taskSummary.completed).toBe(1);
        expect(data.tasksPreview).toHaveLength(2); // Only non-DONE tasks

        // Milestones/Phase
        expect(data.phase).toBe('RELATIONSHIP_EVIDENCE');
        expect(data.phaseProgress.find((p) => p.phase === 'PREPARATION')?.done).toBe(1);
        expect(data.phaseProgress.find((p) => p.phase === 'RELATIONSHIP_EVIDENCE')?.done).toBe(0);

        // Countdowns
        expect(data.countdowns.some((c) => c.label === 'Milestone 2')).toBe(true);
    });
});
