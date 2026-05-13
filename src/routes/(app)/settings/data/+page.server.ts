import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireOwner, requireWorkspace } from '$lib/server/guards';
import { deleteWorkspace } from '$lib/server/services/workspace.service';
import { listQuestions } from '$lib/server/services/question.service';
import { listMilestones } from '$lib/server/services/milestone.service';

export const load: PageServerLoad = async (event) => {
    const { workspace } = requireWorkspace(event);
    const [questions, milestones] = await Promise.all([listQuestions(workspace.id), listMilestones(workspace.id)]);

    // Evidence is now stored in workspace maps, not as separate entities
    // No soft-delete mechanism for categories in the new model
    const trashedEvidence = 0;
    const trashedQuestions = questions.filter((q) => q.deletedAt != null).length;
    const trashedMilestones = milestones.filter((m) => m.deletedAt != null).length;
    return {
        trashedCounts: {
            evidence: trashedEvidence,
            questions: trashedQuestions,
            milestones: trashedMilestones
        },
        hasDemo: false
    };
};

export const actions: Actions = {
    purgeTrash: async () => {
        // Not implemented yet for DynamoDB single-table without scan + batch delete.
        return fail(501, {
            error: 'Not implemented yet for DynamoDB. Use S3 lifecycle + PITR for recovery.'
        });
    },
    removeDemo: async () => {
        return fail(501, { error: 'Not implemented yet for DynamoDB.' });
    },
    deleteWorkspace: async (event) => {
        requireOwner(event);
        return fail(501, {
            error: 'Workspace deletion is disabled until data retention policy is finalized.'
        });
    }
};
