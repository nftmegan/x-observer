// src/scripts/login.ts
import { BrowserEngine } from '../core/browser.js'; // Note the .js extension!
import { logger } from '../utils/logger.js';

async function manualLogin() {
  // 1. Configure the engine for the Burner Account
  const engine = new BrowserEngine({
    accountId: 'burner_01', // MUST match what is in your scheduler.ts
    headless: false,        // Force visible window
    // proxy: { ... }       // Uncomment and add proxy here if you want to login VIA the proxy (Recommended)
  });

  logger.info('🚀 Launching Browser for Manual Login...');
  const page = await engine.launch();

  try {
    // 2. Go to Login Page
    await page.goto('https://x.com/i/flow/login');
    
    logger.info('👉 ACTION REQUIRED: Log in manually in the browser window.');
    logger.info('⏳ Script will wait until you close the browser...');

    // 3. Wait indefinitely until the user closes the browser
    // This gives you time to type passwords, handle 2FA, etc.
    await new Promise((resolve) => {
      page.context().on('close', resolve);
    });

    logger.info('✅ Browser closed. Session saved to ./sessions/burner_01');

  } catch (error) {
    logger.error(error, '❌ Login Script Error');
  }
}

manualLogin();