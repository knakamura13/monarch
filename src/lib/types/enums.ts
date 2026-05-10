// Shared type definitions used throughout the application for type safety
// Using const string unions instead of enums for better string literal compatibility

export type MemberRole = 'OWNER' | 'COLLABORATOR';

export type MilestonePhase =
    | 'PREPARATION'
    | 'RELATIONSHIP_EVIDENCE'
    | 'MARRIAGE_LICENSE'
    | 'PACKET_DRAFTING'
    | 'FILING'
    | 'RECEIPT_NOTICES'
    | 'BIOMETRICS'
    | 'INTERVIEW_PREP'
    | 'POST_INTERVIEW'
    | 'OUTCOME';

export type MilestoneStatus = 'To do' | 'Doing' | 'On hold' | 'Done';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// NOTE: This must stay in sync with taskStatusEnum in src/lib/schemas/task.ts.
// Consolidation was skipped because task.ts importing from enums.ts would create
// a circular dependency (enums.ts ← schemas/* ← common.ts ← schemas/task.ts).
export type TaskStatus = 'To do' | 'Doing' | 'On hold' | 'Done';

export type FormFilingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'FILED' | 'RECEIVED' | 'REPLACED' | 'NOT_NEEDED';

export type EvidenceStatus = 'COLLECTED' | 'NEEDS_SCAN' | 'NEEDS_TRANSLATION' | 'NEEDS_BETTER_COPY' | 'READY';

export type QuestionStatus = 'OPEN' | 'RESEARCHING' | 'ANSWERED' | 'WONT_FIX';

export type QuestionSourceType = 'ATTORNEY' | 'NONPROFIT' | 'USCIS_SITE' | 'COUNTY_SITE' | 'COMMUNITY' | 'OTHER';

export type ActivityAction =
    | 'LOGIN'
    | 'LOGOUT'
    | 'USER_INVITED'
    | 'INVITATION_ACCEPTED'
    | 'WORKSPACE_UPDATED'
    | 'TASK_CREATED'
    | 'TASK_UPDATED'
    | 'TASK_DELETED'
    | 'STATUS_CHANGE'
    | 'FORM_CREATED'
    | 'FORM_UPDATED'
    | 'FORM_DELETED'
    | 'EVIDENCE_CREATED'
    | 'EVIDENCE_UPDATED'
    | 'EVIDENCE_DELETED'
    | 'QUESTION_CREATED'
    | 'QUESTION_UPDATED'
    | 'QUESTION_DELETED'
    | 'NOTE_CREATED'
    | 'NOTE_EDIT'
    | 'NOTE_DELETED'
    | 'MILESTONE_CREATED'
    | 'MILESTONE_UPDATED'
    | 'MILESTONE_DELETED'
    | 'DEMO_DATA_REMOVED'
    | 'QUICK_LINK_CREATED'
    | 'QUICK_LINK_UPDATED'
    | 'QUICK_LINK_DELETED'
    | 'QUICK_LINK_FOLDER_CREATED'
    | 'QUICK_LINK_FOLDER_UPDATED'
    | 'QUICK_LINK_FOLDER_DELETED'
    | 'QUICK_LINK_MOVED_TO_FOLDER'
    | 'QUICK_LINK_REORDERED'
    | 'QUICK_LINK_FOLDER_REORDERED';

export type ErrorSource = 'SERVER' | 'CLIENT' | 'ACTION' | 'API';

// Type definitions for JSON values
export type InputJsonValue = string | number | boolean | null | { [key: string]: InputJsonValue | undefined } | InputJsonValue[];

// Model type definitions (minimal, for type compatibility)
export type QuickLink = {
    id: string;
    workspaceId: string;
    url: string;
    title?: string | null;
    description?: string | null;
    folderId?: string | null;
    faviconUrl?: string | null;
    order: number;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
};

export type QuickLinkFolder = {
    id: string;
    workspaceId: string;
    name?: string | null;
    order: number;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
};
