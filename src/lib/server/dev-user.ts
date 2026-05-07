import { ddbPut } from './dynamo/ops';
import { baPk, entitySk, gsi1Sk, gsi1UserPk, wsPk } from './dynamo/keys';
import { ENV } from './env';

export const DEV_USER = {
    get id() {
        return ENV.DEV_USER_ID;
    },
    email: 'dev@localhost',
    name: 'Dev User',
    image: null
};

export const DEV_WORKSPACE = {
    id: 'dev_workspace_local',
    name: 'Dev Workspace',
    role: 'OWNER' as const
};

export const DEV_SESSION = {
    id: 'dev_session_local',
    expiresAt: new Date('2099-01-01T00:00:00Z')
};

let seeded = false;

export async function ensureDevUserSeeded(): Promise<void> {
    if (ENV.NODE_ENV === 'production') {
        throw new Error('Dev user seeding is not allowed in production');
    }
    if (ENV.DEV_MODE !== 'unsafe') {
        throw new Error(
            'Dev user seeding requires DEV_MODE=unsafe. This bypasses authentication and should only be used in local development.'
        );
    }
    if (seeded) return;
    // Seed Better Auth user record (minimal fields used by session load).
    await ddbPut({
        PK: baPk('user'),
        SK: DEV_USER.id,
        id: DEV_USER.id,
        email: DEV_USER.email,
        name: DEV_USER.name,
        image: null,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    const now = new Date().toISOString();
    await ddbPut({
        PK: wsPk(DEV_WORKSPACE.id),
        SK: entitySk('Workspace', DEV_WORKSPACE.id),
        id: DEV_WORKSPACE.id,
        name: DEV_WORKSPACE.name,
        ownerId: DEV_USER.id,
        evidenceTargets: null,
        createdAt: now,
        updatedAt: now
    });

    await ddbPut({
        PK: wsPk(DEV_WORKSPACE.id),
        SK: entitySk('Membership', DEV_USER.id),
        id: `membership_${DEV_WORKSPACE.id}_${DEV_USER.id}`,
        workspaceId: DEV_WORKSPACE.id,
        userId: DEV_USER.id,
        role: 'OWNER',
        acceptedAt: now,
        createdAt: now,
        GSI1PK: gsi1UserPk(DEV_USER.id),
        GSI1SK: gsi1Sk('Membership', DEV_WORKSPACE.id),
        workspaceName: DEV_WORKSPACE.name
    });

    seeded = true;
}
