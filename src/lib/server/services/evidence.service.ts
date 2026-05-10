import { logActivity } from '$lib/server/activity';
import { EVIDENCE_CATEGORIES, EVIDENCE_TARGETS } from '$lib/constants/categories';
import { ddbGet, ddbUpdate } from '$lib/server/dynamo/ops';
import { entitySk, wsPk } from '$lib/server/dynamo/keys';
import type { WorkspaceItem } from '$lib/server/dynamo/types';

export interface EvidenceCategory {
    category: string;
    currentCount: number;
    targetCount: number;
}

export async function getEvidenceCategories(workspaceId: string): Promise<EvidenceCategory[]> {
    const ws = await ddbGet<WorkspaceItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('Workspace', workspaceId)
    });

    if (!ws) {
        throw new Error('Workspace not found');
    }

    // Migration: if evidenceCategories doesn't exist, initialize from constant
    let categories = ws.evidenceCategories as string[] | null;
    if (!categories) {
        categories = [...EVIDENCE_CATEGORIES];
        await ddbUpdate(
            { PK: wsPk(workspaceId), SK: entitySk('Workspace', workspaceId) },
            'SET #evidenceCategories = :cats',
            { ':cats': categories },
            { '#evidenceCategories': 'evidenceCategories' }
        );
    }

    // Migration: if evidenceCounts doesn't exist, migrate from EvidenceItem records
    let counts = ws.evidenceCounts as Record<string, number> | null;
    if (!counts) {
        counts = {};
        await ddbUpdate(
            { PK: wsPk(workspaceId), SK: entitySk('Workspace', workspaceId) },
            'SET #evidenceCounts = :counts',
            { ':counts': counts },
            { '#evidenceCounts': 'evidenceCounts' }
        );
    }

    // Migration: if evidenceTargets doesn't exist, initialize from constant
    let targets = ws.evidenceTargets as Record<string, number> | null;
    if (!targets) {
        targets = { ...EVIDENCE_TARGETS };
        await ddbUpdate(
            { PK: wsPk(workspaceId), SK: entitySk('Workspace', workspaceId) },
            'SET #evidenceTargets = :targets',
            { ':targets': targets },
            { '#evidenceTargets': 'evidenceTargets' }
        );
    }

    return categories.map((cat) => ({
        category: cat,
        currentCount: (counts ? Reflect.get(counts, cat) : 0) ?? 0,
        targetCount: (targets ? Reflect.get(targets, cat) : 0) ?? 0
    }));
}

export async function incrementEvidenceCount(workspaceId: string, actorId: string, category: string, delta: number) {
    const categories = await getEvidenceCategories(workspaceId);
    const exists = categories.some((c) => c.category.toLowerCase() === category.toLowerCase());

    if (!exists) {
        throw new Error('Category does not exist');
    }

    // Limit delta to prevent abuse
    if (Math.abs(delta) > 100) {
        throw new Error('Delta too large');
    }

    // Atomic increment/decrement using DynamoDB
    const workspace = await ddbUpdate<WorkspaceItem>(
        { PK: wsPk(workspaceId), SK: entitySk('Workspace', workspaceId) },
        'SET #evidenceCounts.#category = if_not_exists(#evidenceCounts.#category, :zero) + :delta, #updatedAt = :u',
        { ':zero': 0, ':delta': delta, ':u': new Date().toISOString() },
        { '#evidenceCounts': 'evidenceCounts', '#category': category, '#updatedAt': 'updatedAt' }
    );

    // Fix negative count if needed
    const currentCount = (workspace?.evidenceCounts ? Reflect.get(workspace.evidenceCounts, category) : 0) ?? 0;
    if (currentCount < 0) {
        await ddbUpdate(
            { PK: wsPk(workspaceId), SK: entitySk('Workspace', workspaceId) },
            'SET #evidenceCounts.#category = :zero, #updatedAt = :u',
            { ':zero': 0, ':u': new Date().toISOString() },
            { '#evidenceCounts': 'evidenceCounts', '#category': category, '#updatedAt': 'updatedAt' }
        );
        await logActivity({
            workspaceId,
            userId: actorId,
            action: 'EVIDENCE_UPDATED',
            entityType: 'Workspace',
            entityId: workspaceId,
            summary: `Evidence category "${category}" count adjusted to 0 (corrected from negative)`
        });
        return { category, currentCount: 0 };
    }

    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'EVIDENCE_UPDATED',
        entityType: 'Workspace',
        entityId: workspaceId,
        summary: `Evidence category "${category}" count adjusted to ${currentCount}`
    });

    return { category, currentCount };
}

export async function updateEvidenceTarget(workspaceId: string, actorId: string, category: string, target: number) {
    const categories = await getEvidenceCategories(workspaceId);
    const exists = categories.some((c) => c.category.toLowerCase() === category.toLowerCase());

    if (!exists) {
        throw new Error('Evidence category does not exist');
    }

    if (target < 0) {
        throw new Error('Target must be non-negative');
    }

    await ddbUpdate(
        { PK: wsPk(workspaceId), SK: entitySk('Workspace', workspaceId) },
        'SET #evidenceTargets.#category = :t, #updatedAt = :u',
        { ':t': target, ':u': new Date().toISOString() },
        { '#evidenceTargets': 'evidenceTargets', '#category': category, '#updatedAt': 'updatedAt' }
    );

    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'EVIDENCE_UPDATED',
        entityType: 'Workspace',
        entityId: workspaceId,
        summary: `Evidence category "${category}" target updated to ${target}`
    });

    return { category, targetCount: target };
}

export async function addEvidenceCategory(workspaceId: string, actorId: string, category: string) {
    if (!category || category.length === 0 || category.length > 80) {
        throw new Error('Category name must be 1-80 characters');
    }

    const categories = await getEvidenceCategories(workspaceId);
    const exists = categories.some((c) => c.category.toLowerCase() === category.toLowerCase());

    if (exists) {
        throw new Error('Category already exists');
    }

    await ddbUpdate<WorkspaceItem>(
        { PK: wsPk(workspaceId), SK: entitySk('Workspace', workspaceId) },
        'SET #evidenceCategories = list_append(if_not_exists(#evidenceCategories, :emptyList), :newCat), #evidenceTargets.#category = :zero, #evidenceCounts.#category = :zero, #updatedAt = :u',
        { ':emptyList': [], ':newCat': [category], ':zero': 0, ':u': new Date().toISOString() },
        {
            '#evidenceCategories': 'evidenceCategories',
            '#evidenceTargets': 'evidenceTargets',
            '#evidenceCounts': 'evidenceCounts',
            '#category': category,
            '#updatedAt': 'updatedAt'
        }
    );

    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'EVIDENCE_CREATED',
        entityType: 'Workspace',
        entityId: workspaceId,
        summary: `Evidence category "${category}" added`
    });

    return { category };
}

export async function renameEvidenceCategory(workspaceId: string, actorId: string, oldName: string, newName: string) {
    if (!newName || newName.length === 0 || newName.length > 80) {
        throw new Error('Category name must be 1-80 characters');
    }

    if (oldName.toLowerCase() === newName.toLowerCase()) {
        throw new Error('New name must be different from old name');
    }

    const categories = await getEvidenceCategories(workspaceId);
    const oldExists = categories.some((c) => c.category.toLowerCase() === oldName.toLowerCase());
    const newExists = categories.some((c) => c.category.toLowerCase() === newName.toLowerCase());

    if (!oldExists) {
        throw new Error('Category does not exist');
    }

    if (newExists) {
        throw new Error('Category name already exists');
    }

    // Update category in array
    const updatedCategories = categories.map((c) => (c.category.toLowerCase() === oldName.toLowerCase() ? newName : c.category));

    // Update counts and targets maps
    const ws = await ddbGet<WorkspaceItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('Workspace', workspaceId)
    });

    const counts = ws?.evidenceCounts ?? {};
    const targets = ws?.evidenceTargets ?? {};

    const newCounts: Record<string, number> = {};
    const newTargets: Record<string, number> = {};

    for (const [key, value] of Object.entries(counts)) {
        if (key === oldName) {
            Reflect.set(newCounts, newName, value);
        } else {
            Reflect.set(newCounts, key, value);
        }
    }

    for (const [key, value] of Object.entries(targets)) {
        if (key === oldName) {
            Reflect.set(newTargets, newName, value);
        } else {
            Reflect.set(newTargets, key, value);
        }
    }

    await ddbUpdate(
        { PK: wsPk(workspaceId), SK: entitySk('Workspace', workspaceId) },
        'SET #evidenceCategories = :cats, #evidenceCounts = :counts, #evidenceTargets = :targets, #updatedAt = :u',
        {
            ':cats': updatedCategories,
            ':counts': newCounts,
            ':targets': newTargets,
            ':u': new Date().toISOString()
        },
        {
            '#evidenceCategories': 'evidenceCategories',
            '#evidenceCounts': 'evidenceCounts',
            '#evidenceTargets': 'evidenceTargets',
            '#updatedAt': 'updatedAt'
        }
    );

    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'EVIDENCE_UPDATED',
        entityType: 'Workspace',
        entityId: workspaceId,
        summary: `Evidence category renamed from "${oldName}" to "${newName}"`
    });

    return { oldName, newName };
}

export async function deleteEvidenceCategory(workspaceId: string, actorId: string, category: string) {
    const categories = await getEvidenceCategories(workspaceId);
    const exists = categories.some((c) => c.category.toLowerCase() === category.toLowerCase());

    if (!exists) {
        throw new Error('Category does not exist');
    }

    const categoryData = categories.find((c) => c.category.toLowerCase() === category.toLowerCase());
    if (categoryData && categoryData.currentCount > 0) {
        throw new Error('Cannot delete category with non-zero count');
    }

    // Remove from array
    const updatedCategories = categories.filter((c) => c.category.toLowerCase() !== category.toLowerCase()).map((c) => c.category);

    // Remove from counts and targets maps
    const ws = await ddbGet<WorkspaceItem>({
        PK: wsPk(workspaceId),
        SK: entitySk('Workspace', workspaceId)
    });

    const counts = ws?.evidenceCounts ?? {};
    const targets = ws?.evidenceTargets ?? {};

    const newCounts: Record<string, number> = {};
    const newTargets: Record<string, number> = {};

    for (const [key, value] of Object.entries(counts)) {
        if (key !== category) {
            Reflect.set(newCounts, key, value);
        }
    }

    for (const [key, value] of Object.entries(targets)) {
        if (key !== category) {
            Reflect.set(newTargets, key, value);
        }
    }

    await ddbUpdate(
        { PK: wsPk(workspaceId), SK: entitySk('Workspace', workspaceId) },
        'SET #evidenceCategories = :cats, #evidenceCounts = :counts, #evidenceTargets = :targets, #updatedAt = :u',
        {
            ':cats': updatedCategories,
            ':counts': newCounts,
            ':targets': newTargets,
            ':u': new Date().toISOString()
        },
        {
            '#evidenceCategories': 'evidenceCategories',
            '#evidenceCounts': 'evidenceCounts',
            '#evidenceTargets': 'evidenceTargets',
            '#updatedAt': 'updatedAt'
        }
    );

    await logActivity({
        workspaceId,
        userId: actorId,
        action: 'EVIDENCE_DELETED',
        entityType: 'Workspace',
        entityId: workspaceId,
        summary: `Evidence category "${category}" deleted`
    });

    return { category };
}
