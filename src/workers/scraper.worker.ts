import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { Scraper } from '../core/scraper.js';
import { logger } from '../utils/logger.js';

interface ScrapeJobData {
  targetAccount: string;
  burnerAccount: string;
  proxy?: any;
}

// ⚙️ CONFIG: Load concurrency from .env or default to 1
const CONCURRENCY_LIMIT = parseInt(process.env.CONCURRENCY || '1', 10);

export const scraperWorker = new Worker<ScrapeJobData>(
  'scraper-queue',
  async (job: Job) => {
    logger.info({ jobId: job.id, target: job.data.targetAccount }, '🚀 Job Started');
    try {
      const bot = new Scraper({
        targetAccount: job.data.targetAccount,
        burnerAccount: job.data.burnerAccount,
        proxy: job.data.proxy
      });
      await bot.run();
      logger.info({ jobId: job.id }, '✅ Job Completed Successfully');
      return { success: true };
    } catch (error: any) {
      logger.error({ jobId: job.id, err: error.message }, '❌ Job Failed');
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: CONCURRENCY_LIMIT, // 👈 Scaling happens here
    limiter: { max: 1, duration: 1000 }
  }
);

logger.info(`👷 Worker initialized with ${CONCURRENCY_LIMIT} concurrent threads.`);