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
        const currentCount = (Reflect.get(openQuestionsCount, q.priority) as number | undefined) ?? 0;
        Reflect.set(openQuestionsCount, q.priority, currentCount + 1);
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
        const currentList = (Reflect.get(milestonesByPhase, m.phase) as (typeof milestonesAll) | undefined) ?? [];
        currentList.push(m);
        Reflect.set(milestonesByPhase, m.phase, currentList);
    }

    const phaseProgress = PHASE_ORDER.map((p) => {
        const items = (Reflect.get(milestonesByPhase, p) as typeof milestonesAll | undefined) ?? [];
        const label = (Reflect.get(PHASE_LABELS, p) as string | undefined) ?? '';
        if (items.length === 0) return { phase: p, label, total: 0, done: 0 };
        const done = items.filter((m) => m.status === 'Done').length;
        return { phase: p, label, total: items.length, done };
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

    // User requested next 3 'To do' or 'Doing' milestones.
    // If fewer than 3, include 'On hold' milestones.
    const actionable = milestonesAll
        .filter((m) => m.status === 'To do' || m.status === 'Doing')
        .sort((a, b) => {
            const phaseA = PHASE_ORDER.indexOf(a.phase as MilestonePhase);
            const phaseB = PHASE_ORDER.indexOf(b.phase as MilestonePhase);
            if (phaseA !== phaseB) return phaseA - phaseB;
            return (a.order ?? 0) - (b.order ?? 0);
        });

    let nextMilestones = actionable.slice(0, 3);
    if (nextMilestones.length < 3) {
        const onHold = milestonesAll
            .filter((m) => m.status === 'On hold')
            .sort((a, b) => {
                const phaseA = PHASE_ORDER.indexOf(a.phase as MilestonePhase);
                const phaseB = PHASE_ORDER.indexOf(b.phase as MilestonePhase);
                if (phaseA !== phaseB) return phaseA - phaseB;
                return (a.order ?? 0) - (b.order ?? 0);
            });
        nextMilestones = [...nextMilestones, ...onHold].slice(0, 3);
    }

    return {
        upcomingMeetings,
        evidenceCoverage,
        gapsCount,
        openQuestionsCount,
        phase,
        phaseLabel: (Reflect.get(PHASE_LABELS, phase) as string | undefined) ?? '',
        phaseProgress,
        activity,
        missingCritical,
        countdowns,
        taskSummary,
        tasksPreview,
        nextMilestones,
        quickLinks,
        quickLinkFolders
    };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardFor>>;
