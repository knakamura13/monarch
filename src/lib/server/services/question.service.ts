import type { QuestionSourceType, QuestionStatus } from '$lib/types/enums';
import { logActivity } from '$lib/server/activity';
import type { QuestionCreate, QuestionUpdate } from '$lib/schemas/question';
import { randomUUID } from 'node:crypto';
import { ddbGet, ddbPut, ddbQuery, ddbUpdate } from '$lib/server/dynamo/ops';
import { entitySk, wsPk } from '$lib/server/dynamo/keys';
import type { QuestionItem } from '$lib/server/dynamo/types';

export async function listQuestions(
    workspaceId: string,
    filter: { status?: QuestionStatus; sourceType?: QuestionSourceType; q?: string; limit?: number } = {}
) {
    const rows = await ddbQuery<QuestionItem>({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': wsPk(workspaceId), ':prefix': 'QuestionItem#' },
        Limit: filter.limit ?? 1000
    });
    const q = filter.q?.toLowerCase();
    const filtered = rows
        .filter((r) => !r.deletedAt)
        .filter((r) => (filter.status ? (r.status as QuestionStatus) === filter.status : true))
        .filter((r) => (filter.sourceType ? (r.sourceType as QuestionSourceType) === filter.sourceType : true))
        .filter((r) =>
            q
                ? String(r.question ?? '')
                      .toLowerCase()
                      .includes(q) ||
                  String(r.answer ?? '')
                      .toLowerCase()
                      .includes(q)
                : true
        );
    filtered.sort(
        (a, b) =>
            String(a.status).localeCompare(String(b.status)) ||
            String(b.priority).localeCompare(String(a.priority)) ||
            String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))
    );
    return filtered;
}

export async function getQuestion(workspaceId: string, id: string) {
    const q = await ddbGet<QuestionItem>({ PK: wsPk(workspaceId), SK: entitySk('QuestionItem', id) });
    if (!q || q.deletedAt) return null;
    return {
        ...q,
        relatedForm: q.relatedFormId ? { id: q.relatedFormId } : null,
        relatedEvidence: q.relatedEvidenceId ? { id: q.relatedEvidenceId } : null
    };
}

export async function createQuestion(workspaceId: string, actorId: string, input: QuestionCreate) {
    const now = new Date();
    const question = {
        id: randomUUID(),
        workspaceId,
        ...input,
        answeredAt:
            input.status === 'ANSWERED'
                ? (input.answeredAt ?? now).toISOString()
                : input.answeredAt
                  ? new Date(input.answeredAt).toISOString()
                  : null,
        deletedAt: null as string | null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    };
    await ddbPut({ PK: wsPk(workspaceId), SK: entitySk('QuestionItem', question.id), ...question });
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'QUESTION_CREATED',
        entityType: 'QuestionItem',
        entityId: question.id,
        summary: `Question "${question.question.slice(0, 60)}…" added`
    });
    return question;
}

export async function updateQuestion(workspaceId: string, actorId: string, id: string, input: QuestionUpdate) {
    const existing = await ddbGet<QuestionItem>({ PK: wsPk(workspaceId), SK: entitySk('QuestionItem', id) });
    if (!existing) throw new Error('Question not found');
    if (existing.deletedAt) throw new Error('Question not found');
    const answeredAt =
        input.status === 'ANSWERED' && !existing.answeredAt ? new Date() : input.answeredAt ? new Date(input.answeredAt) : undefined;
    const patch: Record<string, unknown> = { ...input, updatedAt: new Date().toISOString() };
    if (answeredAt !== undefined) patch.answeredAt = answeredAt.toISOString();
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const sets: string[] = [];
    for (const [k, v] of Object.entries(patch)) {
        const nk = `#${k}`;
        const vk = `:${k}`;
        Reflect.set(names, nk, k);
        Reflect.set(values, vk, v);
        sets.push(`${nk} = ${vk}`);
    }
    const question = (await ddbUpdate<QuestionItem>(
        { PK: wsPk(workspaceId), SK: entitySk('QuestionItem', id) },
        `SET ${sets.join(', ')}`,
        values,
        names
    )) ?? { ...existing, ...patch };
    const statusChanged = input.status && input.status !== existing.status;
    await logActivity({
        workspaceId,
        userId: actorId,
        action: statusChanged ? 'STATUS_CHANGE' : 'QUESTION_UPDATED',
        entityType: 'QuestionItem',
        entityId: question.id,
        summary: statusChanged ? `Question moved to ${question.status}` : `Question updated`
    });
    return question;
}

export async function softDeleteQuestion(workspaceId: string, actorId: string, id: string) {
    const existing = await ddbGet<QuestionItem>({ PK: wsPk(workspaceId), SK: entitySk('QuestionItem', id) });
    if (!existing) throw new Error('Question not found');
    if (existing.deletedAt) throw new Error('Question not found');
    await ddbUpdate(
        { PK: wsPk(workspaceId), SK: entitySk('QuestionItem', id) },
        'SET #deletedAt = :d, #updatedAt = :u',
        { ':d': new Date().toISOString(), ':u': new Date().toISOString() },
        { '#deletedAt': 'deletedAt', '#updatedAt': 'updatedAt' }
    );
    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'QUESTION_DELETED',
        entityType: 'QuestionItem',
        entityId: id,
        summary: `Question deleted`
    });
}
