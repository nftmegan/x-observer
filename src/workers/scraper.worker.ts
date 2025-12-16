import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { Scraper } from '../core/scraper.js';
import { logger } from '../utils/logger.js';
import { scraperQueue } from '../queue/scheduler.js'; // Import the queue to schedule next job

interface ScrapeJobData {
  targetAccount: string;
  burnerAccount: string;
  proxy?: any;
}

// ⚙️ CONFIG: Random Interval Settings (in Minutes)
const MIN_DELAY_MINUTES = 10;
const MAX_DELAY_MINUTES = 25;
const CONCURRENCY_LIMIT = parseInt(process.env.CONCURRENCY || '1', 10);

export const scraperWorker = new Worker<ScrapeJobData>(
  'scraper-queue',
  async (job: Job) => {
    logger.info({ jobId: job.id, target: job.data.targetAccount }, '🚀 Job Started');

    try {
      // 1. Run the Scraper
      const bot = new Scraper({
        targetAccount: job.data.targetAccount,
        burnerAccount: job.data.burnerAccount,
        proxy: job.data.proxy
      });
      await bot.run();
      
      logger.info({ jobId: job.id }, '✅ Job Completed Successfully');

      // 2. 🎲 Schedule the NEXT run (Recursive Scheduling)
      // Calculate a random delay between MIN and MAX minutes
      const delayMinutes = Math.floor(Math.random() * (MAX_DELAY_MINUTES - MIN_DELAY_MINUTES + 1) + MIN_DELAY_MINUTES);
      const delayMs = delayMinutes * 60 * 1000;

      logger.info(`⏳ Next run for ${job.data.targetAccount} in ${delayMinutes} minutes.`);

      await scraperQueue.add(
        'scrape-job',
        job.data, // Pass the same target info to the next job
        {
          delay: delayMs,
          jobId: `auto-${job.data.targetAccount}-${Date.now()}` // Unique ID
        }
      );

      return { success: true };

    } catch (error: any) {
      logger.error({ jobId: job.id, err: error.message }, '❌ Job Failed');
      
      // Optional: You could allow it to retry immediately via BullMQ's 'attempts' 
      // or schedule a "retry later" here manually.
      // For now, we let BullMQ handle immediate retries.
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: CONCURRENCY_LIMIT,
    limiter: { max: 1, duration: 1000 }
  }
);

logger.info(`👷 Worker initialized. Loop: ${MIN_DELAY_MINUTES}-${MAX_DELAY_MINUTES} mins.`);