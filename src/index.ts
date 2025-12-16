import './workers/scraper.worker.js'; 
import { logger } from './utils/logger.js';
import { startServer } from './api/server.js';
import { preflightCheck } from './scripts/preflight.js'; 

async function main() {
  logger.info('🤖 Stealth X-Observer Booting...');

  try {
    // 1. Run Security & Session Check
    await preflightCheck();

    // 2. Start Dashboard API
    await startServer();

    logger.info('💤 Bot is in STANDBY mode.');
    logger.info('👉 Send POST /control/start to begin surveillance.');
    
    process.on('SIGTERM', async () => {
      logger.info('🛑 Shutting down...');
      process.exit(0);
    });

  } catch (error) {
    logger.fatal(error, '🔥 System Crash');
    process.exit(1);
  }
}

main();