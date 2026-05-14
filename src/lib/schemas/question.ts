import { z } from 'zod';
import { optionalDateOnly, optionalId, priorityEnum, stringOrEmpty } from './common';

export const questionStatusEnum = z.enum(['OPEN', 'RESEARCHING', 'ANSWERED', 'WONT_FIX']);
export const questionSourceEnum = z.enum(['ATTORNEY', 'NONPROFIT', 'USCIS_SITE', 'COUNTY_SITE', 'COMMUNITY', 'OTHER']);

export const questionCreateSchema = z.object({
    question: z.string().min(1).max(500),
    category: stringOrEmpty(80),
    priority: priorityEnum.default('MEDIUM'),
    status: questionStatusEnum.default('OPEN'),
    answer: stringOrEmpty(10000),
    sourceType: questionSourceEnum.default('OTHER'),
    citationUrl: z
        .string()
        .url()
        .optional()
        .or(z.literal(''))
        .transform((v) => (v && v.length ? v : null)),
    answeredAt: optionalDateOnly,
    relatedTaskId: optionalId,
    relatedFormId: optionalId,
    relatedEvidenceId: optionalId,
    order: z.number().int().optional().default(0)
});

export const questionUpdateSchema = questionCreateSchema.partial();

export type QuestionCreate = z.infer<typeof questionCreateSchema>;
export type QuestionUpdate = z.infer<typeof questionUpdateSchema>;
