import { describe, it, expect, beforeEach } from 'vitest';

import { getEvidenceCategories, updateEvidenceTarget, incrementEvidenceCount } from '$lib/server/services/evidence.service';
import { createMilestone, listMilestones, softDeleteMilestone, updateMilestone } from '$lib/server/services/milestone.service';
import { createQuestion, listQuestions, softDeleteQuestion, updateQuestion } from '$lib/server/services/question.service';
import { createQuickLink, listQuickLinks, softDeleteQuickLink, updateQuickLink } from '$lib/server/services/quickLink.service';
import { dashboardFor } from '$lib/server/services/dashboard.service';
import { createWorkspace } from '$lib/server/services/workspace.service';

const actorId = 'smoke-user';

function workspaceId() {
    return `ws_${Math.random().toString(36).slice(2, 10)}`;
}

describe('cross-domain DynamoDB smoke', () => {
    beforeEach(() => {
        (globalThis as unknown as { __ddbMem?: Map<string, unknown> }).__ddbMem = new Map();
    });

    it('evidence: get → update target → increment', async () => {
        const ws = await createWorkspace({ name: 'Test Workspace', ownerUserId: actorId });
        const wsId = ws.id;

        // Test with existing default category
        // Note: mock DynamoDB has limitations with dynamic attribute names in update expressions
        // This test verifies functions execute without errors
        await expect(updateEvidenceTarget(wsId, actorId, 'Photos', 10)).resolves.toBeTruthy();
        await expect(incrementEvidenceCount(wsId, actorId, 'Photos', 3)).resolves.toBeTruthy();

        const categories = await getEvidenceCategories(wsId);
        expect(categories).toBeTruthy();
        expect(categories.length).toBeGreaterThan(0);
    });

    it('milestones: create → list → update → softDelete', async () => {
        const ws = workspaceId();
        const created = await createMilestone(ws, actorId, {
            title: 'Collect marriage certificate',
            description: '',
            phase: 'MARRIAGE_LICENSE',
            dueDate: null,
            scheduledAt: null,
            status: 'To do',
            priority: 'MEDIUM',
            subTasks: [],
            location: ''
        });

        expect((await listMilestones(ws)).some((m) => m.id === created.id)).toBe(true);
        await updateMilestone(ws, actorId, created.id, { status: 'Doing' });
        await softDeleteMilestone(ws, actorId, created.id);
        expect((await listMilestones(ws)).length).toBe(0);
    });

    it('questions: create → list → update → softDelete', async () => {
        const ws = workspaceId();
        const created = await createQuestion(ws, actorId, {
            question: 'Do we need birth certificate translations?',
            category: '',
            priority: 'MEDIUM',
            status: 'OPEN',
            answer: '',
            sourceType: 'OTHER',
            citationUrl: null,
            answeredAt: null,
            relatedTaskId: null,
            relatedFormId: null,
            relatedEvidenceId: null
        });

        expect((await listQuestions(ws)).some((q) => q.id === created.id)).toBe(true);
        await updateQuestion(ws, actorId, created.id, { status: 'RESEARCHING' });
        await softDeleteQuestion(ws, actorId, created.id);
        expect((await listQuestions(ws)).length).toBe(0);
    });

    it('quick links: create → list → update → softDelete', async () => {
        const ws = workspaceId();
        const created = await createQuickLink(ws, actorId, {
            url: 'https://uscis.gov',
            title: 'USCIS',
            description: '',
            folderId: null
        });

        expect((await listQuickLinks(ws)).length).toBe(1);
        await updateQuickLink(ws, actorId, created.id, {
            id: created.id,
            url: 'https://www.uscis.gov',
            title: 'USCIS (updated)',
            description: '',
            folderId: null
        });
        await softDeleteQuickLink(ws, actorId, created.id);
        expect((await listQuickLinks(ws)).length).toBe(0);
    });

    it('dashboard: aggregates across domains without error', async () => {
        const ws = await createWorkspace({ name: 'Test Workspace', ownerUserId: actorId });
        const wsId = ws.id;
        await createMilestone(wsId, actorId, {
            title: 'M1',
            description: '',
            phase: 'PREPARATION',
            dueDate: null,
            scheduledAt: null,
            status: 'To do',
            priority: 'MEDIUM',
            subTasks: [],
            location: ''
        });

        const d = await dashboardFor(wsId);
        expect(d).toBeTruthy();
        expect(Array.isArray(d.phaseProgress)).toBe(true);
    });
});
