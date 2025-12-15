import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Scraper } from '../core/scraper';
import { logger } from '../utils/logger';

interface ScrapeJobData {
  targetAccount: string;
  burnerAccount: string;
  proxy?: any;
}

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
    concurrency: 1,
    limiter: { max: 1, duration: 1000 }
  }
);
