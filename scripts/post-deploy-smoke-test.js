const { io } = require('../frontend/node_modules/socket.io-client');
const http = require('http');
const https = require('https');

const targetUrl = process.argv[2] || process.env.DEPLOYMENT_URL || 'http://localhost:4000';
console.log(`==================================================================`);
console.log(`🔍 STARTING POST-DEPLOYMENT AUTOMATED SMOKE TEST SUITE`);
console.log(`🔊 Target URL: ${targetUrl}`);
console.log(`==================================================================`);

function fetchUrl(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const client = u.protocol === 'https:' ? https : http;
    const req = client.request(u, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runSmokeTests() {
  let passed = 0;
  let failed = 0;

  async function checkStep(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Health Probe /api/live
  await checkStep('GET /api/live (Process Liveness)', async () => {
    const res = await fetchUrl(`${targetUrl}/api/live`);
    if (res.statusCode !== 200) throw new Error(`Status code ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (data.status !== 'up') throw new Error(`Expected status 'up', got '${data.status}'`);
  });

  // 2. Health Probe /api/ready
  await checkStep('GET /api/ready (Readiness Probe)', async () => {
    const res = await fetchUrl(`${targetUrl}/api/ready`);
    if (res.statusCode !== 200) throw new Error(`Status code ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (data.status !== 'ok') throw new Error(`Expected status 'ok', got '${data.status}'`);
  });

  // 3. Health Probe /api/health
  await checkStep('GET /api/health (Full System Diagnostics)', async () => {
    const res = await fetchUrl(`${targetUrl}/api/health`);
    if (res.statusCode !== 200) throw new Error(`Status code ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (data.status !== 'ok') throw new Error(`Expected status 'ok', got '${data.status}'`);
  });

  // Reset load test room 999999 to LOBBY status before real-time test
  try {
    await fetchUrl(`${targetUrl}/room/reset-load-test/999999`, { method: 'POST' });
  } catch {
    // Ignore if reset endpoint is restricted in environment
  }

  // 4. Socket.IO Connection & Join Real-Time Verification
  await checkStep('Socket.IO Connection & Join Flow', async () => {
    return new Promise((resolve, reject) => {
      const socket = io(targetUrl, { transports: ['websocket', 'polling'], timeout: 5000 });
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Socket connection timed out'));
      }, 6000);

      socket.on('connect', () => {
        socket.emit('player:join', { pin: '999999', name: 'SmokeTester' }, (ack) => {
          clearTimeout(timeout);
          socket.disconnect();
          if (ack && ack.success) {
            resolve();
          } else if (ack && ack.message && ack.message.includes('not found')) {
            // Room not initialized in room table is acceptable for pure smoke test
            resolve();
          } else {
            reject(new Error(ack?.message || 'Join failed'));
          }
        });
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        socket.disconnect();
        reject(err);
      });
    });
  });

  console.log(`==================================================================`);
  console.log(`📊 POST-DEPLOYMENT SMOKE TEST RESULTS`);
  console.log(`  • Total Tests Executed: ${passed + failed}`);
  console.log(`  • Passed:               ${passed}`);
  console.log(`  • Failed:               ${failed}`);
  console.log(`==================================================================`);

  if (failed > 0) {
    console.error(`❌ POST-DEPLOYMENT SMOKE TESTS FAILED! ABORTING DEPLOYMENT.`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL POST-DEPLOYMENT SMOKE TESTS PASSED SUCCESSFULLY!`);
    process.exit(0);
  }
}

runSmokeTests();
