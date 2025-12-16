import { BrowserEngine } from '../core/browser.js';

/**
 * Launches a temporary invisible browser to fetch the public IP.
 * @param useProxy - If true, uses the proxy credentials from .env
 */
export async function getPublicIP(useProxy: boolean): Promise<string | null> {
  // 1. Construct Proxy Config safely
  // We explicitly check process.env.PROXY_SERVER to ensure it's a string
  const proxyConfig = (useProxy && process.env.PROXY_SERVER)
    ? {
        server: process.env.PROXY_SERVER,
        // Only add username/password if they exist (Standard strict fix)
        ...(process.env.PROXY_USERNAME ? { username: process.env.PROXY_USERNAME } : {}),
        ...(process.env.PROXY_PASSWORD ? { password: process.env.PROXY_PASSWORD } : {})
      }
    : undefined;

  // 2. Instantiate Engine
  // 🛡️ STRICT FIX: We use spread syntax `...(proxyConfig ? { proxy: proxyConfig } : {})`
  // This ensures we NEVER pass "proxy: undefined", which causes the TS error.
  const engine = new BrowserEngine({
    accountId: 'debug_ip_check',
    headless: true,
    disableLoginCheck: true, // 👈 Prevents the "Force Login" loop
    ...(proxyConfig ? { proxy: proxyConfig } : {}) 
  });

  try {
    const page = await engine.launch();
    
    // 3. Fetch IP
    // 15 seconds timeout is reasonable for proxies
    await page.goto('https://api64.ipify.org?format=json', { timeout: 15000 });
    const content = await page.textContent('body');
    const json = JSON.parse(content || '{}');
    return json.ip;

  } catch (error) {
    return null; // Return null on failure so the preflight check can handle it
  } finally {
    await engine.close();
  }
}