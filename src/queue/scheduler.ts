import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export const scraperQueue = new Queue('scraper-queue', { 
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1, // Stop infinite retry loops
    removeOnComplete: true, 
    removeOnFail: 100,
  }
});

let isRunning = false;

// ⚙️ Helper: Load Proxy from .env
const getProxyConfig = () => {
  if (!process.env.PROXY_SERVER) return undefined;
  return {
    server: process.env.PROXY_SERVER,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD
  };
};

// 👇 Start Command (Triggered by API)
export async function startBot() {
  if (isRunning) {
    logger.warn('⚠️ Bot is already running!');
    return;
  }
  
  isRunning = true;
  logger.info('🟢 STARTING SURVEILLANCE...');

  // Load Proxy Configuration
  const proxyConfig = getProxyConfig();
  if (proxyConfig) {
    logger.info(`🛡️ Proxy Enabled: ${proxyConfig.server}`);
  } else {
    logger.warn('⚠️ No Proxy detected in .env. Running on raw IP (Dangerous).');
  }

  // Define Targets
  const targets = [
    { 
      target: 'elonmusk', 
      burner: 'burner_01', 
      proxy: proxyConfig 
    }
  ];

  for (const t of targets) {
    // 1. Clean old jobs first
    const jobs = await scraperQueue.getRepeatableJobs();
    for (const j of jobs) await scraperQueue.removeRepeatableByKey(j.key);

    // 2. Add immediate job to start the loop
    await scraperQueue.add(
      'scrape-job', 
      { targetAccount: t.target, burnerAccount: t.burner, proxy: t.proxy },
      { jobId: `run-${t.target}-${Date.now()}` }
    );
    
    logger.info(`🚀 Triggered: ${t.target}`);
  }
}

// 👇 Stop Command (Triggered by API)
export async function stopBot() {
  isRunning = false;
  logger.info('🔴 STOPPING SURVEILLANCE...');
  
  // Clear the queue
  await scraperQueue.drain();
  const repeatable = await scraperQueue.getRepeatableJobs();
  for (const job of repeatable) {
    await scraperQueue.removeRepeatableByKey(job.key);
  }
  
  logger.info('✅ Queue Cleared. Bot Stopped.');
}

// 👇 Status Command (Triggered by API)
export function getStatus() {
  return { running: isRunning };
}

// Legacy export if needed elsewhere, but mainly we use startBot now
export async function scheduleJobs() {
   await startBot();
}