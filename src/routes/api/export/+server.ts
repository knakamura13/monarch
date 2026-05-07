import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEvidenceCategories } from '$lib/server/services/evidence.service';
import { listQuestions } from '$lib/server/services/question.service';
import { listMilestones } from '$lib/server/services/milestone.service';
import { recentActivity } from '$lib/server/activity';
import { listQuickLinks } from '$lib/server/services/quickLink.service';

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user || !locals.workspace) return json({ error: 'Unauthorized' }, { status: 401 });
    const wsId = locals.workspace.id;
    try {
        const [evidence, questions, milestones, activity, quickLinks] = await Promise.all([
            getEvidenceCategories(wsId),
            listQuestions(wsId, { limit: 5000 }),
            listMilestones(wsId, { limit: 5000 }),
            recentActivity(wsId, 500),
            listQuickLinks(wsId, 5000)
        ]);
        return new Response(
            JSON.stringify(
                {
                    exportedAt: new Date().toISOString(),
                    workspace: { id: locals.workspace.id, name: locals.workspace.name },
                    evidence,
                    questions,
                    milestones,
                    quickLinks,
                    activity
                },
                null,
                2
            ),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="monarch-${wsId}-${Date.now()}.json"`
                }
            }
        );
    } catch (err) {
        console.error('[export] data fetch failed', err);
        return json({ error: 'Export failed. Try again.' }, { status: 500 });
    }
};
