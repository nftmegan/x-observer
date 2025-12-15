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

    const proxySettings = this.config.proxy ? {
      server: this.config.proxy.server,
      username: this.config.proxy.username,
      password: this.config.proxy.password
    } : undefined;

    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: this.config.headless ?? false,
      viewport: null,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--no-sandbox',
        '--disable-infobars'
      ],
      proxy: proxySettings
    });

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
