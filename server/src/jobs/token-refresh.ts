import { logger } from '../lib/logger.js';
import { tokenRefreshService } from '../modules/email/token-refresh.service.js';

const STARTUP_DELAY_MS = 30_000;

let timer: NodeJS.Timeout | null = null;
let scheduledNextRunAt: Date | null = null;
let stopped = false;

function clearScheduledTimer() {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    scheduledNextRunAt = null;
}

function scheduleTimer(delayMs: number | null) {
    clearScheduledTimer();

    if (delayMs === null || stopped) {
        return;
    }

    scheduledNextRunAt = new Date(Date.now() + delayMs);
    timer = setTimeout(() => {
        void executeScheduledRun();
    }, delayMs);

    if (typeof timer.unref === 'function') {
        timer.unref();
    }
}

async function scheduleFromConfig(reason: 'startup' | 'update' | 'completed'): Promise<void> {
    const config = await tokenRefreshService.getTokenRefreshConfig();

    if (!config.enabled) {
        logger.info({ reason }, 'Token refresh job is disabled');
        scheduleTimer(null);
        return;
    }

    const delayMs = reason === 'startup'
        ? STARTUP_DELAY_MS
        : config.intervalHours * 60 * 60 * 1000;

    logger.info({
        reason,
        intervalHours: config.intervalHours,
        concurrency: config.concurrency,
        nextRunAt: new Date(Date.now() + delayMs).toISOString(),
    }, 'Token refresh job scheduled');

    scheduleTimer(delayMs);
}

async function executeScheduledRun(): Promise<void> {
    clearScheduledTimer();

    try {
        const config = await tokenRefreshService.getTokenRefreshConfig();
        if (!config.enabled) {
            logger.info('Skipping token refresh run because the job is disabled');
            return;
        }

        await tokenRefreshService.refreshAll({
            concurrency: config.concurrency,
        });
    } catch (err) {
        logger.error({ err }, 'Token refresh job failed');
    } finally {
        if (!stopped) {
            await scheduleFromConfig('completed');
        }
    }
}

export function getTokenRefreshJobNextRunAt(): Date | null {
    return scheduledNextRunAt;
}

export async function refreshTokenRefreshJobSchedule(): Promise<void> {
    if (stopped) {
        return;
    }

    await scheduleFromConfig('update');
}

export function startTokenRefreshJob(): () => void {
    stopped = false;
    void scheduleFromConfig('startup');

    return () => {
        stopped = true;
        clearScheduledTimer();
    };
}
