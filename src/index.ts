import { scheduleJobs } from './queue/scheduler.js';
import './workers/scraper.worker.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('🤖 Stealth X-Observer Starting...');
  try {
    await scheduleJobs();
    logger.info('✨ System Online. Waiting for jobs...');
    process.on('SIGTERM', async () => {
      logger.info('🛑 SIGTERM received. Shutting down...');
      process.exit(0);
    });
  } catch (error) {
    logger.fatal(error, '🔥 System Crash');
    process.exit(1);
  }
}
main();