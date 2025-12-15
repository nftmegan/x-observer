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
      await page.goto(`https://x.com/${this.config.targetAccount}`);
      await page.waitForTimeout(5000);

      const loginButton = await page.$('[data-testid="login"]');
      if (loginButton) throw new Error("❌ Session Dead: Login button detected.");

      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('j');
        const sleep = Math.floor(Math.random() * 1500) + 1500;
        await page.waitForTimeout(sleep);
        await this.processActivePost(page);
      }

    } catch (error) {

      logger.error(error, "Scrape Cycle Failed");
      throw error;
    } finally {
      await this.engine.close();
    }
  }

  private async processActivePost(page: Page) {
    const data = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      const active = articles.find(a => {
        const rect = a.getBoundingClientRect();
        return rect.top >= 0 && rect.top < 400;
      });

      if (!active) return null;

      const timeEl = active.querySelector('time');
      const link = timeEl?.closest('a')?.getAttribute('href'); 
      const id = link ? link.split('/').pop() : null;

      if (!id) return null;

      const parseMetric = (testId: string) => {
        const el = active.querySelector(`[data-testid="${testId}"]`);
        const text = el?.getAttribute('aria-label') || el?.textContent || "0";
        const match = text.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/i);
        return match ? match[0] : "0";
      };

      return {
        id,
        text: active.querySelector('[data-testid="tweetText"]')?.textContent || "",
        replies: parseMetric('reply'),
        reposts: parseMetric('retweet'),
        likes: parseMetric('like'),
        views: active.querySelector('a[href*="/analytics"]')?.textContent || "0"
      };
    });

    if (data) this.saveData(data);
  }

  private async saveData(raw: any) {
    const parse = (str: string): number => {
      if (!str) return 0;
      let num = parseFloat(str.replace(/,/g, ''));
      if (str.toUpperCase().includes('K')) num *= 1000;
      if (str.toUpperCase().includes('M')) num *= 1000000;
      return Math.floor(num);
    };

    const cleanData = {
      id: raw.id,
      text: raw.text,
      author: this.config.targetAccount,
      views: parse(raw.views),
      likes: parse(raw.likes),
      reposts: parse(raw.reposts),
      replies: parse(raw.replies),
    };

    logger.info(`💾 Saving Post ${cleanData.id} | Views: ${cleanData.views}`);

    await prisma.$transaction([
      prisma.post.upsert({
        where: { id: cleanData.id },
        update: {
          views: cleanData.views,
          likes: cleanData.likes,
          reposts: cleanData.reposts,
          replies: cleanData.replies,
          updatedAt: new Date()
        },
        create: {
          id: cleanData.id,
          text: cleanData.text,
          author: cleanData.author,
          views: cleanData.views,
          likes: cleanData.likes,
          reposts: cleanData.reposts,
          replies: cleanData.replies
        }
      }),
      prisma.snapshot.create({
        data: {
          postId: cleanData.id,
          views: cleanData.views,
          likes: cleanData.likes,
          reposts: cleanData.reposts,
          replies: cleanData.replies
        }
      })
    ]);
  }
}
