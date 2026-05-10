import { z } from 'zod';
import { optionalDateOnly, priorityEnum, stringOrEmpty } from './common';

export const taskStatusEnum = z.enum(['To do', 'Doing', 'On hold', 'Done']);

export type TaskStatus = z.infer<typeof taskStatusEnum>;

export const checklistItemSchema = z.object({
    id: z.string().optional(),
    taskId: z.string().optional(),
    text: z.string().min(1).max(200),
    done: z.coerce.boolean().default(false),
    order: z.number().optional()
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const taskCreateSchema = z.object({
    title: z.string().min(1).max(200),
    description: stringOrEmpty(5000),
    dueDate: optionalDateOnly,
    priority: priorityEnum.default('MEDIUM'),
    status: taskStatusEnum.default('To do'),
    checklist: z.array(checklistItemSchema).default([])
});

export const taskUpdateSchema = taskCreateSchema.partial();

export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
