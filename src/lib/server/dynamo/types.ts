import type { MemberRole, MilestonePhase, MilestoneStatus, Priority, TaskStatus } from '$lib/types/enums';

export type DynamoBaseItem = {
    PK: string;
    SK: string;
    // Optional secondary index for user-centric lookups (membership, sessions, etc.)
    GSI1PK?: string;
    GSI1SK?: string;
    // GSI2: Email-based lookups for Better Auth (user by email, account by email)
    GSI2PK?: string;
    GSI2SK?: string;
    // GSI3: Token-based lookups for Better Auth (session by token, verification by token)
    GSI3PK?: string;
    GSI3SK?: string;
    // Soft-delete marker used across entities
    deletedAt?: string | null;
    createdAt: string;
    updatedAt: string;
};

// Entity-specific types to replace `any` in service layer
export type TaskItem = DynamoBaseItem & {
    id: string;
    workspaceId: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    priority: Priority;
    status: TaskStatus;
    order: number;
    checklist?: Array<{ id: string; taskId: string; text: string; done: boolean; order: number }>;
};

export type QuestionItem = DynamoBaseItem & {
    id: string;
    workspaceId: string;
    question: string;
    answer: string | null;
    status: string; // Stored as string, validated as QuestionStatus at service layer
    priority: Priority;
    sourceType: string; // Stored as string, validated as QuestionSourceType at service layer
    source: string | null;
    category: string | null;
    order: number;
    citationUrl: string | null;
    answeredAt: string | null;
    relatedFormId: string | null;
    relatedEvidenceId: string | null;
    relatedTaskId: string | null;
    relatedEvidence: { id: string } | null;
};

export type MilestoneItem = DynamoBaseItem & {
    id: string;
    workspaceId: string;
    title: string;
    description: string | null;
    phase: MilestonePhase;
    status: MilestoneStatus;
    priority: Priority;
    dueDate: string;
    scheduledAt: string | null;
    completedAt: string | null;
    order: number;
    subTasks?: Array<{ id: string; text: string; done: boolean }>;
    location?: string | null;
};

export type QuickLinkItem = DynamoBaseItem & {
    id: string;
    workspaceId: string;
    url: string;
    title: string | null;
    description: string | null;
    folderId: string | null;
    faviconUrl: string | null;
    order: number;
};

export type QuickLinkFolderItem = DynamoBaseItem & {
    id: string;
    workspaceId: string;
    name: string | null;
    order: number;
};

export type WorkspaceItem = DynamoBaseItem & {
    id: string;
    name: string;
    ownerId: string;
    evidenceCategories: string[];
    evidenceTargets: Record<string, number>;
    evidenceCounts: Record<string, number>;
};

export type MembershipItem = DynamoBaseItem & {
    id: string;
    workspaceId: string;
    userId: string;
    role: MemberRole;
    acceptedAt: string | null;
    workspaceName?: string;
};

export type InvitationItem = DynamoBaseItem & {
    id: string;
    workspaceId: string;
    inviterUserId: string;
    email: string;
    role: MemberRole;
    token: string;
    expiresAt: string;
    acceptedAt: string | null;
    workspaceName?: string;
};

export type EvidenceCategoryItem = DynamoBaseItem & {
    id: string;
    workspaceId: string;
    name: string;
    target: number;
    count: number;
};

export type BetterAuthUserItem = DynamoBaseItem & {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
};

export type BetterAuthSessionItem = DynamoBaseItem & {
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
};
