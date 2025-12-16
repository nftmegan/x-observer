import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';

interface BrowserConfig {
  accountId: string;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  headless?: boolean;
  disableLoginCheck?: boolean; // 👈 NEW OPTION
}

export class BrowserEngine {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;
  private userDataDir: string;

  constructor(config: BrowserConfig) {
    this.config = config;
    this.userDataDir = path.resolve(process.cwd(), 'sessions', config.accountId);
  }

  async launch(): Promise<Page> {
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    // 2. 🧠 SMART CHECK: Is the session folder empty?
    let hasSessionData = false;
    try {
      const files = fs.readdirSync(this.userDataDir);
      hasSessionData = files.length > 0;
    } catch (e) { hasSessionData = false; }

    const globalHeadless = process.env.HEADLESS_MODE === 'true';
    let finalHeadless = this.config.headless ?? globalHeadless;

    // 🚨 AUTO-OVERRIDE LOGIC
    // Only force visible IF we are missing session AND it's not a utility task
    if (!hasSessionData && !this.config.disableLoginCheck) {
      logger.warn(`⚠️ No session files found for ${this.config.accountId}!`);
      logger.warn('👀 Forcing HEADLESS=false so you can log in manually.');
      finalHeadless = false;
    }

    // Strict Proxy Config (Spread Syntax Fix)
    const launchOptions = {
      headless: finalHeadless,
      viewport: null,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--no-sandbox',
        '--disable-infobars'
      ],
      ...(this.config.proxy ? {
        proxy: {
          server: this.config.proxy.server,
          ...(this.config.proxy.username ? { username: this.config.proxy.username } : {}),
          ...(this.config.proxy.password ? { password: this.config.proxy.password } : {})
        }
      } : {})
    };

    this.context = await chromium.launchPersistentContext(this.userDataDir, launchOptions);

    this.page = this.context.pages()[0] || await this.context.newPage();

    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    return this.page;
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
  }
}