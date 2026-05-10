/* eslint-disable security/detect-object-injection */
import { PHASE_ORDER, PHASE_LABELS } from '$lib/constants/phases';
import { currentPhase } from './milestone.service';
import type { MilestonePhase, MilestoneStatus, QuestionStatus, TaskStatus } from '$lib/types/enums';
import { recentActivity } from '$lib/server/activity';
import { getEvidenceCategories } from './evidence.service';
import { listQuestions } from './question.service';
import { listMilestones } from './milestone.service';
import { listQuickLinks } from './quickLink.service';
import { listQuickLinkFolders } from './quickLinkFolder.service';
import { listTasks } from './task.service';

export async function dashboardFor(workspaceId: string) {
    const now = new Date();

    const [evidenceCategories, questionsAll, milestonesAll, activity, quickLinks, quickLinkFolders, tasks] = await Promise.all([
        getEvidenceCategories(workspaceId),
        // Optimization: Fetch all questions once instead of calling listQuestions twice for different statuses
        listQuestions(workspaceId),
        listMilestones(workspaceId),
        recentActivity(workspaceId, 10),
        listQuickLinks(workspaceId),
        listQuickLinkFolders(workspaceId),
        listTasks(workspaceId)
    ]);

    const upcomingMeetings = milestonesAll
        .filter((m) => m.scheduledAt && new Date(m.scheduledAt) >= now)
        .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
        .slice(0, 5);

    const evidenceCoverage = evidenceCategories.map((cat) => ({
        category: cat.category,
        total: cat.currentCount,
        ready: cat.currentCount,
        target: cat.targetCount
    }));
    const gapsCount = evidenceCoverage.filter((c) => c.total < c.target).length;

    const openQuestionsCount: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    // Optimization: Filter for 'OPEN' or 'RESEARCHING' status from the single questions fetch
    const openQuestionsAll = questionsAll.filter(
        (q) => (q.status as QuestionStatus) === 'OPEN' || (q.status as QuestionStatus) === 'RESEARCHING'
    );
    for (const q of openQuestionsAll) {
        openQuestionsCount[q.priority] = (openQuestionsCount[q.priority] ?? 0) + 1;
    }

    const phase: MilestonePhase = currentPhase(
        milestonesAll.map((m) => ({
            phase: m.phase as MilestonePhase,
            status: m.status as MilestoneStatus
        }))
    );

    // Optimization: Group milestones by phase in a single pass to avoid repeated filtering
    const milestonesByPhase: Record<string, typeof milestonesAll> = {};
    for (const m of milestonesAll) {
        const phaseMilestones = (milestonesByPhase[m.phase] ??= []);
        phaseMilestones.push(m);
    }

    const phaseProgress = PHASE_ORDER.map((p) => {
        const items = milestonesByPhase[p] ?? [];
        if (items.length === 0) return { phase: p, label: PHASE_LABELS[p], total: 0, done: 0 };
        const done = items.filter((m) => m.status === 'Done').length;
        return { phase: p, label: PHASE_LABELS[p], total: items.length, done };
    });

    // Missing critical items heuristic:
    const missingCritical: string[] = [];
    if (gapsCount > 0) missingCritical.push(`${gapsCount} evidence category gap${gapsCount === 1 ? '' : 's'}`);
    const openHigh = (openQuestionsCount.HIGH ?? 0) + (openQuestionsCount.CRITICAL ?? 0);
    if (openHigh > 0) missingCritical.push(`${openHigh} high-priority question${openHigh === 1 ? '' : 's'}`);

    const countdowns = [
        ...upcomingMeetings.map((m) => ({
            label: m.title,
            date: m.scheduledAt!,
            href: `/timeline#${m.id}`,
            kind: 'meeting' as const
        })),
        ...milestonesAll
            .filter((m) => m.dueDate && new Date(m.dueDate) >= now && m.status !== 'Done')
            .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
            .slice(0, 3)
            .map((m) => ({
                label: m.title,
                date: m.dueDate!,
                href: `/timeline#${m.id}`,
                kind: 'milestone' as const
            }))
    ]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);

    // Optimization: Consolidate task summary and preview preparation into a single pass
    const taskSummary = { pending: 0, inProgress: 0, completed: 0 };
    const tasksToPreview = [];

    for (const task of tasks) {
        if (task.status === 'To do') taskSummary.pending++;
        else if (task.status === ('Doing' as TaskStatus)) taskSummary.inProgress++;
        else if (task.status === 'Done') taskSummary.completed++;

        if (task.status !== 'Done') {
            tasksToPreview.push(task);
        }
    }

    const tasksPreview = tasksToPreview
        .sort((a, b) => {
            const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
            const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
            if (a.status !== b.status) {
                return a.status === 'Doing' ? -1 : 1;
            }
            if (dueA !== dueB) return dueA - dueB;
            return a.order - b.order;
        })
        .slice(0, 4);

    return {
        upcomingMeetings,
        evidenceCoverage,
        gapsCount,
        openQuestionsCount,
        phase,
        phaseLabel: PHASE_LABELS[phase],
        phaseProgress,
        activity,
        missingCritical,
        countdowns,
        taskSummary,
        tasksPreview,
        quickLinks,
        quickLinkFolders
    };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardFor>>;
