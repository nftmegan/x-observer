import { Page } from 'playwright';
import { BrowserEngine } from './browser.js';
import { logger } from '../utils/logger.js';
import prisma from '../database/client.js';

interface ScraperConfig {
  targetAccount: string;
  burnerAccount: string;
  proxy?: any;
}

export class Scraper {
  private engine: BrowserEngine;
  private config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
    this.engine = new BrowserEngine({
      accountId: config.burnerAccount,
      proxy: config.proxy
    });
  }

  async run() {
    logger.info(`🕵️ Starting surveillance on @${this.config.targetAccount}`);
    const page = await this.engine.launch();

    try {
      // --- PHASE 1: LOGIN CHECKPOINT ---
      // 1. Go to Home first to check if we are logged in
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);

      // 2. Check URL for login redirect
      if (page.url().includes('login') || page.url().includes('i/flow/login')) {
        logger.warn('🔒 Authentication Checkpoint Triggered');
        
        // 3. Check if we are in "Debug Mode" (Headless = false)
        // We use a rough heuristic: if HEADLESS_MODE is explicitly false, allow manual login.
        const isHeadless = process.env.HEADLESS_MODE === 'true';
        
        if (!isHeadless) {
             logger.info('🛑 SCRIPT PAUSED: Please log in manually in the browser window.');
             logger.info('👉 Execution will resume automatically once you reach the home page.');
             
             // 4. Wait indefinitely until the user successfully logs in
             // We detect this by waiting for the URL to contain "/home"
             await page.waitForURL('**/home', { timeout: 0 }); 
             
             logger.info('✅ Login Detected! Resuming mission...');
             await page.waitForTimeout(5000); // Wait for cookies/localStorage to settle
        } else {
             // If we are headless (Production), we can't do anything. Die.
             throw new Error("❌ Session Expired in Headless Mode. Cannot perform manual login.");
        }
      }

      // --- PHASE 2: EXECUTION ---
      // 5. Navigate to the Target Account
      logger.info(`🎯 Acquiring target: https://x.com/${this.config.targetAccount}`);
      await page.goto(`https://x.com/${this.config.targetAccount}`);
      await page.waitForTimeout(5000);

      // 6. Scroll and Scrape Loop
      // We simulate human behavior by pressing 'j' (active post shortcut) and waiting randomly
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('j');
        
        // Random sleep between 1.5s and 3s
        const sleep = Math.floor(Math.random() * 1500) + 1500;
        await page.waitForTimeout(sleep);
        
        // Process the currently focused post
        await this.processActivePost(page);
      }

    } catch (error: any) {
      logger.error({ err: error.message }, "❌ Scrape Cycle Failed");
      throw error;
    } finally {
      await this.engine.close();
    }
  }

  /**
   * Extracts data from the currently visible post and saves it.
   */
  private async processActivePost(page: Page) {
    try {
      // Extract data from the DOM
      const raw = await page.evaluate(() => {
        // NOTE: We must use 'tweet' here because X still uses legacy IDs in the HTML
        const article = document.querySelector('article[data-testid="tweet"]');
        if (!article) return null;

        const text = article.querySelector('div[data-testid="tweetText"]')?.textContent || '';
        const timestamp = article.querySelector('time')?.getAttribute('datetime');
        
        // Extract metrics (replies, reposts, likes, views)
        const metrics = {
          replies: 0,
          reposts: 0,
          likes: 0,
          views: 0
        };

        // Helper to parse "1.2K", "1M" etc.
        const parseCount = (str: string) => {
          if (!str) return 0;
          let n = parseFloat(str.replace(/,/g, ''));
          if (str.includes('K')) n *= 1000;
          if (str.includes('M')) n *= 1000000;
          return Math.floor(n);
        };

        const groups = article.querySelectorAll('div[role="group"] div[aria-label]');
        groups.forEach(g => {
          const label = g.getAttribute('aria-label') || '';
          if (label.includes('replies')) metrics.replies = parseCount(g.textContent || '0');
          if (label.includes('reposts')) metrics.reposts = parseCount(g.textContent || '0');
          if (label.includes('likes')) metrics.likes = parseCount(g.textContent || '0');
          if (label.includes('views')) metrics.views = parseCount(g.textContent || '0');
        });

        // Get Post ID from the link
        const link = article.querySelector('a[href*="/status/"]')?.getAttribute('href');
        const id = link ? link.split('/status/')[1] : null;

        return { id, text, timestamp, metrics };
      });

      if (!raw || !raw.id) {
        return; // Skip if no valid post found
      }

      // Save to Database
      await this.saveData(raw);

    } catch (err) {
      logger.warn('⚠️ Failed to process active post (skipping)');
    }
  }

  /**
   * Upserts the Post and creates a new Snapshot record.
   */
  private async saveData(raw: any) {
    try {
      const postId = raw.id;
      const author = this.config.targetAccount;

      // 1. Ensure Post exists
      await prisma.post.upsert({
        where: { id: postId },
        update: {
          content: raw.text,
          lastScraped: new Date()
        },
        create: {
          id: postId,
          author: author,
          content: raw.text,
          createdAt: raw.timestamp ? new Date(raw.timestamp) : new Date(),
          lastScraped: new Date()
        }
      });

      // 2. Create Snapshot (History)
      await prisma.snapshot.create({
        data: {
          postId: postId,
          likes: raw.metrics.likes,
          reposts: raw.metrics.reposts,
          replies: raw.metrics.replies,
          views: raw.metrics.views,
          hotness: this.getHotness(raw.metrics),
          mood: this.getMood(raw.text)
        }
      });

      logger.info(`💾 Saved Snapshot for post ${postId} (Likes: ${raw.metrics.likes})`);

    } catch (error) {
      logger.error('Database Write Failed');
    }
  }

  /**
   * Simple algorithm to determine "Hotness" score (0-100)
   */
  private getHotness(metrics: any): number {
    const score = (metrics.likes * 1) + (metrics.reposts * 2) + (metrics.replies * 3);
    return Math.min(Math.floor(score / 100), 100); // Cap at 100 for now
  }

  /**
   * Simple keyword-based mood detection
   */
  private getMood(text: string): string {
    const t = text.toLowerCase();
    if (t.includes('happy') || t.includes('great') || t.includes('bullish')) return 'POSITIVE';
    if (t.includes('sad') || t.includes('angry') || t.includes('bearish')) return 'NEGATIVE';
    return 'NEUTRAL';
  }
}