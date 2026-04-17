import { z } from 'zod';

export const createEmailSchema = z.object({
    email: z.string().email(),
    clientId: z.string().min(1),
    refreshToken: z.string().min(1),
    password: z.string().optional(),
    groupId: z.coerce.number().int().positive().optional(),
    tags: z.array(z.string()).optional(),
});

export const updateEmailSchema = z.object({
    email: z.string().email().optional(),
    clientId: z.string().min(1).optional(),
    refreshToken: z.string().min(1).optional(),
    password: z.string().optional(),
    status: z.enum(['ACTIVE', 'ERROR', 'DISABLED']).optional(),
    groupId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
    tags: z.array(z.string()).optional(),
});

export const listEmailSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(10),
    status: z.enum(['ACTIVE', 'ERROR', 'DISABLED']).optional(),
    keyword: z.string().optional(),
    groupId: z.coerce.number().int().positive().optional(),
    groupName: z.string().optional(),
    excludeTags: z.preprocess(
        (val) => {
            if (!val) return undefined;
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') return [val];
            // 处理 Fastify 将 excludeTags[] 解析为对象的情况
            if (typeof val === 'object' && val !== null) {
                const values = Object.values(val);
                if (values.length > 0 && values.every(v => typeof v === 'string')) {
                    return values;
                }
            }
            return undefined;
        },
        z.array(z.string()).optional()
    ),
});

export const importEmailSchema = z.object({
    content: z.string().min(1),
    separator: z.string().default('----'),
    groupId: z.coerce.number().int().positive().optional(),
});

export type CreateEmailInput = z.infer<typeof createEmailSchema>;
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type ListEmailInput = z.infer<typeof listEmailSchema>;
export type ImportEmailInput = z.infer<typeof importEmailSchema>;
