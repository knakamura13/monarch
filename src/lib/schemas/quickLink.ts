import { z } from 'zod';
import { stringOrEmpty } from './common';

const httpHttpsUrl = z
    .string()
    .trim()
    .transform((s) => {
        if (!s.length) return s;
        // If a scheme is already present (e.g. ftp://, javascript:), do not prepend https://
        if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
        return `https://${s}`;
    })
    .pipe(
        z
            .string()
            .url()
            .max(2000)
            .refine((u) => {
                try {
                    const p = new URL(u).protocol;
                    return p === 'http:' || p === 'https:';
                } catch {
                    return false;
                }
            }, 'URL must use http or https')
    );

const optionalTitle = z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? null : v.trim()));

export const quickLinkCreateSchema = z.object({
    url: httpHttpsUrl,
    title: optionalTitle,
    description: stringOrEmpty(2000),
    folderId: z.string().nullable().optional()
});

export const quickLinkUpdateSchema = quickLinkCreateSchema.partial().extend({
    id: z.string().min(1)
});

export const quickLinkDeleteSchema = z.object({
    id: z.string().min(1)
});

const optionalFolderName = z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? null : v.trim()));

export const quickLinkFolderCreateSchema = z.object({
    name: optionalFolderName
});

export const quickLinkFolderUpdateSchema = z.object({
    id: z.string().min(1),
    name: optionalFolderName
});

export const quickLinkFolderDeleteSchema = z.object({
    id: z.string().min(1)
});

export const quickLinkMoveToFolderSchema = z.object({
    linkId: z.string().min(1),
    folderId: z.string().nullable().optional()
});

export const quickLinkReorderSchema = z.object({
    linkIds: z.array(z.string().min(1))
});

export const quickLinkFolderReorderSchema = z.object({
    folderIds: z.array(z.string().min(1))
});

export const quickLinkCreateFolderFromLinksSchema = z.object({
    linkIds: z.array(z.string().min(1)).min(1),
    name: optionalFolderName
});

export type QuickLinkCreate = z.infer<typeof quickLinkCreateSchema>;
export type QuickLinkUpdate = z.infer<typeof quickLinkUpdateSchema>;
export type QuickLinkFolderCreate = z.infer<typeof quickLinkFolderCreateSchema>;
export type QuickLinkFolderUpdate = z.infer<typeof quickLinkFolderUpdateSchema>;
export type QuickLinkMoveToFolder = z.infer<typeof quickLinkMoveToFolderSchema>;
export type QuickLinkReorder = z.infer<typeof quickLinkReorderSchema>;
export type QuickLinkFolderReorder = z.infer<typeof quickLinkFolderReorderSchema>;
export type QuickLinkCreateFolderFromLinks = z.infer<typeof quickLinkCreateFolderFromLinksSchema>;
