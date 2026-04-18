import prisma from '../../lib/prisma.js';
import { AppError } from '../../plugins/error.js';
import type { Prisma } from '@prisma/client';

interface ApiKeyScope {
    allowedGroupIds?: number[];
    allowedEmailIds?: number[];
}

function parseJsonIdList(value: Prisma.JsonValue | null | undefined): number[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(
        new Set(
            value
                .map((item) => Number(item))
                .filter((item) => Number.isInteger(item) && item > 0)
        )
    );
}

async function getApiKeyScope(apiKeyId: number): Promise<ApiKeyScope> {
    const apiKey = await prisma.apiKey.findUnique({
        where: { id: apiKeyId },
        select: {
            id: true,
            allowedGroupIds: true,
            allowedEmailIds: true,
        },
    });

    if (!apiKey) {
        throw new AppError('API_KEY_NOT_FOUND', 'API Key not found', 404);
    }

    const allowedGroupIds = parseJsonIdList(apiKey.allowedGroupIds);
    const allowedEmailIds = parseJsonIdList(apiKey.allowedEmailIds);

    return {
        allowedGroupIds: allowedGroupIds.length > 0 ? allowedGroupIds : undefined,
        allowedEmailIds: allowedEmailIds.length > 0 ? allowedEmailIds : undefined,
    };
}

function isEmailInScope(scope: ApiKeyScope, emailId: number, groupId: number | null): boolean {
    if (scope.allowedGroupIds && (!groupId || !scope.allowedGroupIds.includes(groupId))) {
        return false;
    }
    if (scope.allowedEmailIds && !scope.allowedEmailIds.includes(emailId)) {
        return false;
    }
    return true;
}

export const poolService = {
    async getApiKeyScope(apiKeyId: number): Promise<ApiKeyScope> {
        return getApiKeyScope(apiKeyId);
    },

    async assertEmailAccessible(apiKeyId: number, emailId: number, groupId: number | null): Promise<void> {
        const scope = await getApiKeyScope(apiKeyId);
        if (!isEmailInScope(scope, emailId, groupId)) {
            throw new AppError('EMAIL_FORBIDDEN', 'This API Key cannot access this email', 403);
        }
    },
};

