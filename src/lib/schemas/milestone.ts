import { z } from 'zod';
import { optionalDateOnly, priorityEnum, stringOrEmpty } from './common';

export const milestonePhaseEnum = z.enum([
    'PREPARATION',
    'RELATIONSHIP_EVIDENCE',
    'MARRIAGE_LICENSE',
    'PACKET_DRAFTING',
    'FILING',
    'RECEIPT_NOTICES',
    'BIOMETRICS',
    'INTERVIEW_PREP',
    'POST_INTERVIEW',
    'OUTCOME'
]);

export const milestoneStatusEnum = z.enum(['To do', 'Doing', 'On hold', 'Done']);

export const subTaskSchema = z.object({
    id: z.string().uuid(),
    text: z.string().min(1).max(200),
    done: z.coerce.boolean().default(false)
});

export const milestoneCreateSchema = z.object({
    title: z.string().min(1).max(200),
    description: stringOrEmpty(2000),
    phase: milestonePhaseEnum,
    dueDate: optionalDateOnly,
    scheduledAt: optionalDateOnly,
    status: milestoneStatusEnum.default('To do'),
    priority: priorityEnum.default('MEDIUM'),
    subTasks: z.array(subTaskSchema).default([]),
    location: stringOrEmpty(500)
});

export const milestoneUpdateSchema = milestoneCreateSchema.partial();

export const milestoneReorderSchema = z.object({
    phase: milestonePhaseEnum,
    milestoneIds: z.array(z.string().uuid())
});

export type MilestoneCreate = z.infer<typeof milestoneCreateSchema>;
export type MilestoneUpdate = z.infer<typeof milestoneUpdateSchema>;
export type MilestoneReorder = z.infer<typeof milestoneReorderSchema>;
