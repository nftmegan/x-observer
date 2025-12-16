import { logger } from '../utils/logger.js';
import { getPublicIP } from '../utils/network.js'; // 👈 Import shared logic

async function runTest() {
  logger.info('🕵️ Starting Manual IP Leak Test...');

  const homeIP = await getPublicIP(false);
  const proxyIP = await getPublicIP(true);

  console.log('\n----------------------------------------');
  if (homeIP && proxyIP) {
    if (homeIP !== proxyIP) {
      logger.info('✅ SUCCESS: Proxy is working!');
      logger.info(`   🏠 Your IP:  ${homeIP}`);
      logger.info(`   🛡️ Proxy IP: ${proxyIP}`);
    } else {
      logger.error('❌ FAILURE: Proxy is NOT working. IPs are identical.');
      logger.warn('   👉 Check your .env credentials or proxy format.');
    }
  } else {
    logger.error('❌ Test Incomplete. Could not fetch IPs.');
  }
  console.log('----------------------------------------\n');
}

runTest();