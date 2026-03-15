import prisma from '../../lib/prisma.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import { proxyFetch } from '../../lib/proxy.js';
import { env } from '../../config/env.js';
import type { Prisma } from '@prisma/client';

interface RefreshResult {
    emailId: number;
    email: string;
    success: boolean;
    message: string;
}

interface BatchRefreshResult {
    total: number;
    success: number;
    failed: number;
    results: RefreshResult[];
    durationMs: number;
}

interface CurrentRefreshRun {
    total: number;
    completed: number;
    success: number;
    failed: number;
    startedAt: Date;
    durationMs: number;
    recentFailures: RefreshResult[];
}

interface RefreshStats {
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    isRunning: boolean;
    lastResult: BatchRefreshResult | null;
    currentRun: CurrentRefreshRun | null;
    recentFailures: RefreshResult[];
}

interface TokenRefreshConfig {
    enabled: boolean;
    intervalHours: number;
    concurrency: number;
}

// 模块级状态
let isRunning = false;
let lastResult: BatchRefreshResult | null = null;
let lastRunAt: Date | null = null;
let currentRun: CurrentRefreshRun | null = null;
const TOKEN_REFRESH_ERROR_PREFIX = 'Token refresh';
const SYSTEM_CONFIG_ID = 1;
const RECENT_FAILURE_LIMIT = 10;

interface OAuthTokenResponse {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
}

/**
 * 并发控制工具：限制同时执行的 Promise 数量
 */
async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>
): Promise<void> {
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const currentIndex = index++;
            await fn(items[currentIndex]);
        }
    }

    const workers = Array.from(
        { length: Math.min(concurrency, items.length) },
        () => worker()
    );
    await Promise.all(workers);
}

function formatTokenRefreshError(message: string): string {
    return `${TOKEN_REFRESH_ERROR_PREFIX}: ${message}`.substring(0, 500);
}

function getFailureUpdateData(existingErrorMessage: string | null, message: string) {
    if (existingErrorMessage && !existingErrorMessage.startsWith(TOKEN_REFRESH_ERROR_PREFIX)) {
        return {};
    }

    return {
        errorMessage: formatTokenRefreshError(message),
    };
}

function getSuccessUpdateData(existingErrorMessage: string | null) {
    if (existingErrorMessage?.startsWith(TOKEN_REFRESH_ERROR_PREFIX)) {
        return { errorMessage: null };
    }

    return {};
}

function mapSystemConfigToTokenRefreshConfig(config: {
    tokenRefreshEnabled: boolean;
    tokenRefreshIntervalHours: number;
    tokenRefreshConcurrency: number;
}): TokenRefreshConfig {
    return {
        enabled: config.tokenRefreshEnabled,
        intervalHours: config.tokenRefreshIntervalHours,
        concurrency: config.tokenRefreshConcurrency,
    };
}

function appendRecentFailure(target: RefreshResult[], result: RefreshResult) {
    target.push(result);
    if (target.length > RECENT_FAILURE_LIMIT) {
        target.splice(0, target.length - RECENT_FAILURE_LIMIT);
    }
}

function getRecentFailuresFromBatchResult(result: BatchRefreshResult | null): RefreshResult[] {
    if (!result) {
        return [];
    }

    return result.results
        .filter((item) => !item.success)
        .slice(-RECENT_FAILURE_LIMIT)
        .reverse();
}

export const tokenRefreshService = {
    async getTokenRefreshConfig(): Promise<TokenRefreshConfig> {
        const config = await prisma.systemConfig.upsert({
            where: { id: SYSTEM_CONFIG_ID },
            update: {},
            create: {
                id: SYSTEM_CONFIG_ID,
                tokenRefreshEnabled: env.TOKEN_REFRESH_ENABLED,
                tokenRefreshIntervalHours: env.TOKEN_REFRESH_INTERVAL_HOURS,
                tokenRefreshConcurrency: env.TOKEN_REFRESH_CONCURRENCY,
            },
            select: {
                tokenRefreshEnabled: true,
                tokenRefreshIntervalHours: true,
                tokenRefreshConcurrency: true,
            },
        });

        return mapSystemConfigToTokenRefreshConfig(config);
    },

    async updateTokenRefreshConfig(input: TokenRefreshConfig): Promise<TokenRefreshConfig> {
        const config = await prisma.systemConfig.upsert({
            where: { id: SYSTEM_CONFIG_ID },
            update: {
                tokenRefreshEnabled: input.enabled,
                tokenRefreshIntervalHours: input.intervalHours,
                tokenRefreshConcurrency: input.concurrency,
            },
            create: {
                id: SYSTEM_CONFIG_ID,
                tokenRefreshEnabled: input.enabled,
                tokenRefreshIntervalHours: input.intervalHours,
                tokenRefreshConcurrency: input.concurrency,
            },
            select: {
                tokenRefreshEnabled: true,
                tokenRefreshIntervalHours: true,
                tokenRefreshConcurrency: true,
            },
        });

        return mapSystemConfigToTokenRefreshConfig(config);
    },

    /**
     * 刷新单个邮箱的 Refresh Token
     */
    async refreshSingleToken(emailId: number): Promise<RefreshResult> {
        const account = await prisma.emailAccount.findUnique({
            where: { id: emailId },
            select: {
                id: true,
                email: true,
                clientId: true,
                refreshToken: true,
                status: true,
                errorMessage: true,
            },
        });

        if (!account) {
            return { emailId, email: '', success: false, message: 'Email account not found' };
        }

        if (account.status === 'DISABLED') {
            return { emailId, email: account.email, success: false, message: 'Email account is disabled' };
        }

        let currentRefreshToken: string;
        try {
            currentRefreshToken = decrypt(account.refreshToken);
        } catch {
            logger.error({ emailId, email: account.email }, 'Failed to decrypt refresh token');
            await prisma.emailAccount.update({
                where: { id: emailId },
                data: getFailureUpdateData(account.errorMessage, 'Failed to decrypt refresh token'),
            });
            return { emailId, email: account.email, success: false, message: 'Failed to decrypt refresh token' };
        }

        try {
            const response = await proxyFetch(
                'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: currentRefreshToken,
                        client_id: account.clientId,
                    }).toString(),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg = `HTTP ${response.status}`;
                try {
                    const errorJson = JSON.parse(errorText) as OAuthTokenResponse;
                    errorMsg = errorJson.error_description || errorJson.error || errorMsg;
                } catch {
                    errorMsg = errorText.substring(0, 200);
                }

                logger.warn({ email: account.email, status: response.status }, `Token refresh failed: ${errorMsg}`);
                await prisma.emailAccount.update({
                    where: { id: emailId },
                    data: getFailureUpdateData(account.errorMessage, errorMsg),
                });
                return { emailId, email: account.email, success: false, message: errorMsg.substring(0, 200) };
            }

            const data = await response.json() as OAuthTokenResponse;

            if (!data.refresh_token) {
                const msg = 'No refresh_token in response';
                logger.warn({ email: account.email }, msg);
                await prisma.emailAccount.update({
                    where: { id: emailId },
                    data: getFailureUpdateData(account.errorMessage, msg),
                });
                return { emailId, email: account.email, success: false, message: msg };
            }

            // 成功：加密新 token 并保存
            const encryptedNewToken = encrypt(data.refresh_token);
            await prisma.emailAccount.update({
                where: { id: emailId },
                data: {
                    refreshToken: encryptedNewToken,
                    tokenRefreshedAt: new Date(),
                    ...getSuccessUpdateData(account.errorMessage),
                },
            });

            logger.info({ email: account.email }, 'Token refreshed successfully');
            return { emailId, email: account.email, success: true, message: 'OK' };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error({ err, email: account.email }, 'Token refresh exception');
            await prisma.emailAccount.update({
                where: { id: emailId },
                data: getFailureUpdateData(account.errorMessage, `Exception: ${message}`),
            });
            return { emailId, email: account.email, success: false, message: message.substring(0, 200) };
        }
    },

    /**
     * 批量刷新所有未禁用邮箱
     */
    async refreshAll(options?: { concurrency?: number; groupId?: number }): Promise<BatchRefreshResult> {
        if (isRunning) {
            return {
                total: 0,
                success: 0,
                failed: 0,
                results: [],
                durationMs: 0,
            };
        }

        isRunning = true;
        const startTime = Date.now();

        try {
            const where: Prisma.EmailAccountWhereInput = {
                status: { not: 'DISABLED' },
            };
            if (options?.groupId) {
                where.groupId = options.groupId;
            }

            const accounts = await prisma.emailAccount.findMany({
                where,
                select: { id: true },
                orderBy: { id: 'asc' },
            });

            const config = await this.getTokenRefreshConfig();
            const concurrency = options?.concurrency || config.concurrency;
            const results: RefreshResult[] = [];
            currentRun = {
                total: accounts.length,
                completed: 0,
                success: 0,
                failed: 0,
                startedAt: new Date(),
                durationMs: 0,
                recentFailures: [],
            };

            logger.info({
                total: accounts.length,
                concurrency,
                groupId: options?.groupId,
            }, 'Starting batch token refresh');

            await runWithConcurrency(accounts, concurrency, async (account) => {
                const result = await this.refreshSingleToken(account.id);
                results.push(result);
                if (currentRun) {
                    currentRun.completed += 1;
                    currentRun.durationMs = Date.now() - startTime;
                    if (result.success) {
                        currentRun.success += 1;
                    } else {
                        currentRun.failed += 1;
                        appendRecentFailure(currentRun.recentFailures, result);
                    }
                }
            });

            const batchResult: BatchRefreshResult = {
                total: accounts.length,
                success: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results,
                durationMs: Date.now() - startTime,
            };

            lastResult = batchResult;
            lastRunAt = new Date();

            logger.info({
                total: batchResult.total,
                success: batchResult.success,
                failed: batchResult.failed,
                durationMs: batchResult.durationMs,
            }, 'Batch token refresh completed');

            return batchResult;
        } finally {
            isRunning = false;
            currentRun = null;
        }
    },

    /**
     * 获取刷新状态
     */
    getRefreshStats(nextRunAt: Date | null = null): RefreshStats {
        return {
            lastRunAt,
            nextRunAt,
            isRunning,
            lastResult,
            currentRun,
            recentFailures: currentRun?.recentFailures.slice().reverse() || getRecentFailuresFromBatchResult(lastResult),
        };
    },
};
