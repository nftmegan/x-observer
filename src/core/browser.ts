import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';

interface BrowserConfig {
  accountId: string;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  headless?: boolean;
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

    // ⚙️ CONFIG: Check .env for headless preference (Debug Mode)
    // If HEADLESS_MODE is 'false', the browser will pop up visible.
    const globalHeadless = process.env.HEADLESS_MODE === 'true';
    const finalHeadless = this.config.headless ?? globalHeadless;

    // 🛡️ STRICT TYPE SAFETY FIX:
    // We use the spread operator ...() to conditionally add keys.
    // This ensures we NEVER pass 'undefined' to an optional property.
    const launchOptions = {
      headless: finalHeadless,
      viewport: null, 
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--no-sandbox',
        '--disable-infobars'
      ],
      // Only add 'proxy' key if the config exists
      ...(this.config.proxy ? {
        proxy: {
          server: this.config.proxy.server,
          // Only add auth fields if they exist
          ...(this.config.proxy.username ? { username: this.config.proxy.username } : {}),
          ...(this.config.proxy.password ? { password: this.config.proxy.password } : {})
        }
      } : {})
    };

    this.context = await chromium.launchPersistentContext(this.userDataDir, launchOptions);

    this.page = this.context.pages()[0] || await this.context.newPage();

    // Stealth: Remove 'navigator.webdriver' property
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    return this.page;
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
  }
}