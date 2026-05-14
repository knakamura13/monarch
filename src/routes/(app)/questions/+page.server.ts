import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { requireWorkspace } from '$lib/server/guards';
import {
    listQuestions,
    createQuestion,
    updateQuestion,
    softDeleteQuestion,
    reorderQuestions
} from '$lib/server/services/question.service';
import { logActionError } from '$lib/server/services/actionError.service';
import { questionCreateSchema, questionUpdateSchema, questionSourceEnum } from '$lib/schemas/question';
import { getMembers } from '$lib/server/cache/membersCache';
import type { QuestionSourceType, QuestionStatus } from '$lib/types/enums';

const STATUSES: QuestionStatus[] = ['OPEN', 'RESEARCHING', 'ANSWERED', 'WONT_FIX'];
const SOURCES: QuestionSourceType[] = ['ATTORNEY', 'NONPROFIT', 'USCIS_SITE', 'COUNTY_SITE', 'COMMUNITY', 'OTHER'];

export const load: PageServerLoad = async (event) => {
    const { workspace } = requireWorkspace(event);
    const statusParam = event.url.searchParams.get('status');
    const sourceParam = event.url.searchParams.get('source');
    const q = event.url.searchParams.get('q') ?? undefined;
    const items = await listQuestions(workspace.id, {
        status: statusParam && STATUSES.includes(statusParam as QuestionStatus) ? (statusParam as QuestionStatus) : undefined,
        sourceType: sourceParam && SOURCES.includes(sourceParam as QuestionSourceType) ? (sourceParam as QuestionSourceType) : undefined,
        q
    });

    const official = items.filter((i) => ['ATTORNEY', 'NONPROFIT', 'USCIS_SITE', 'COUNTY_SITE'].includes(i.sourceType));
    const community = items.filter((i) => i.sourceType === 'COMMUNITY');
    const other = items.filter((i) => i.sourceType === 'OTHER');

    const members = await getMembers(workspace.id);

    return {
        items,
        official,
        community,
        other,
        members: members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }))
    };
};

export const actions: Actions = {
    reorder: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const formData = await event.request.formData();
        const updatesJson = formData.get('updates') as string;
        if (!updatesJson) return fail(400, { error: 'Missing updates' });

        try {
            const rawUpdates = JSON.parse(updatesJson) as Array<{ id: string; order: number }>;
            await reorderQuestions(workspace.id, user.id, rawUpdates);
            return { success: true };
        } catch {
            return fail(500, { error: 'Failed to reorder questions' });
        }
    },
    create: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const parsed = questionCreateSchema.safeParse(raw);
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        await createQuestion(workspace.id, user.id, parsed.data);
        return { type: 'success' };
    },
    update: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const raw = Object.fromEntries(await event.request.formData());
        const questionId = raw.id as string;
        if (!questionId) return fail(400, { error: 'Missing question id' });

        const parsed = questionUpdateSchema.safeParse(raw);
        if (!parsed.success) {
            const errorId = await logActionError(event, { message: parsed.error.message, status: 400, stack: undefined });
            return fail(400, { error: parsed.error.message, errorId });
        }
        await updateQuestion(workspace.id, user.id, questionId, parsed.data);
        return { type: 'success' };
    },
    delete: async (event) => {
        const { workspace, user } = requireWorkspace(event);
        const formData = await event.request.formData();
        const questionId = formData.get('id') as string;
        if (!questionId) return fail(400, { error: 'Missing question id' });
        await softDeleteQuestion(workspace.id, user.id, questionId);
        return { type: 'success' };
    }
};
