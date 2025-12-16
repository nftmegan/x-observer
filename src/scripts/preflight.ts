import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';
import { logger } from '../utils/logger.js';
import { getPublicIP } from '../utils/network.js';

export async function preflightCheck() {
  logger.info('🔍 SYSTEM PREFLIGHT: Initiating Security Scan...');

  // 1. Construct Proxy Config Strictly
  // We use spread syntax to ensure no 'undefined' values are passed for username/password
  const proxyConfig = process.env.PROXY_SERVER
    ? {
        server: process.env.PROXY_SERVER,
        ...(process.env.PROXY_USERNAME ? { username: process.env.PROXY_USERNAME } : {}),
        ...(process.env.PROXY_PASSWORD ? { password: process.env.PROXY_PASSWORD } : {}),
      }
    : undefined;

  // 🛡️ STEP 1: PROXY SECURITY CHECK
  if (proxyConfig) {
    logger.info('🛡️ Testing Proxy Connection...');
    const [homeIP, proxyIP] = await Promise.all([
      getPublicIP(false),
      getPublicIP(true),
    ]);

    if (!homeIP || !proxyIP) {
      logger.fatal('❌ Network Check Failed.');
      process.exit(1);
    }
    if (homeIP === proxyIP) {
      logger.fatal('🚨 CRITICAL: PROXY IS LEAKING! SHUTTING DOWN.');
      process.exit(1);
    }
    logger.info(`✅ Proxy Secure. Cloaked IP: ${proxyIP}`);
  } else {
    logger.warn('⚠️  NO PROXY CONFIGURED.');
  }

  // 🕵️ STEP 2: SESSION VERIFICATION
  const burners = ['burner_01'];

  for (const burnerId of burners) {
    const userDataDir = path.resolve(process.cwd(), 'sessions', burnerId);
    let isAuthenticated = false;

    // 2. Define Browser Options with Strict Spreading
    // This ensures 'proxy' key is NEVER undefined
    const browserOptions = {
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      ...(proxyConfig ? { proxy: proxyConfig } : {}), // 👈 FIX: Conditionally add proxy key
    };

    // A. Check cookies invisibly
    try {
      if (fs.existsSync(userDataDir)) {
        const browser = await chromium.launchPersistentContext(userDataDir, {
          ...browserOptions,
          headless: true,
        });
        const cookies = await browser.cookies('https://x.com');
        if (cookies.some((c) => c.name === 'auth_token')) isAuthenticated = true;
        await browser.close();
      }
    } catch (e) { /* ignore */ }

    // B. Manual Login (Visible)
    if (!isAuthenticated) {
      logger.warn(`❌ Session invalid for ${burnerId}. Opening Login Window...`);

      const browser = await chromium.launchPersistentContext(userDataDir, {
        ...browserOptions,
        headless: false,
        viewport: null,
        args: ['--start-maximized', ...browserOptions.args],
      });

      const page = browser.pages()[0] || (await browser.newPage());

      try {
        await page.goto('https://x.com/i/flow/login');
        logger.info('👉 PLEASE LOG IN MANUALLY.');

        await new Promise<void>((resolve) => {
          const timer = setInterval(async () => {
            const cookies = await browser.cookies();
            if (cookies.some((c) => c.name === 'auth_token')) {
              clearInterval(timer);
              resolve();
            }
          }, 1000);
        });

        logger.info('✅ Login Confirmed. Saving session...');
        await page.waitForTimeout(5000);
      } catch (err) {
        logger.error('❌ Login failed.');
        process.exit(1);
      } finally {
        await browser.close();
      }
    } else {
      logger.info(`✅ Session Valid: ${burnerId}`);
    }
  }

  logger.info('✨ Preflight Passed. System Standing By.');
}