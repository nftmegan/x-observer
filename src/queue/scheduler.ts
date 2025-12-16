import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export const scraperQueue = new Queue('scraper-queue', { 
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 100,
  }
});

export async function scheduleJobs() {
  logger.info('📅 Initializing Schedule...');
  
  // ⚠️ EDIT THIS TARGET LIST BEFORE RUNNING
  const targets = [
    { 
      target: 'elonmusk', // Example Target
      burner: 'burner_01', 
      proxy: undefined 
    }
  ];

  for (const t of targets) {
    const jobId = `scrape-${t.target}`;
    await scraperQueue.add(
      'scrape-job', 
      { 
        targetAccount: t.target,
        burnerAccount: t.burner,
        proxy: t.proxy
      },
      {
        repeat: { pattern: '*/15 * * * *' },
        jobId: jobId 
      }
    );
    logger.info(`⏰ Scheduled: ${t.target}`);
  }
}
