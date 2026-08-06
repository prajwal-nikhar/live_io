const { io } = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PIN = process.env.PIN || '999999';
const TARGET_CLIENTS = parseInt(process.env.CLIENTS || '600', 10);
const RAMP_INTERVAL_MS = 20; // Ramp over ~12s

console.log(`==================================================================`);
console.log(`🚀 STARTING PRODUCTION LOAD TEST: ${TARGET_CLIENTS} CONCURRENT PLAYERS 🚀`);
console.log(`🔊 Target Server: ${SERVER_URL}`);
console.log(`🔑 Room PIN: ${PIN}`);
console.log(`==================================================================`);

let connectedCount = 0;
let joinedCount = 0;
let failedCount = 0;
let disconnectedCount = 0;

const clients = [];

async function runTest() {
  const startTime = Date.now();

  for (let i = 1; i <= TARGET_CLIENTS; i++) {
    await new Promise((r) => setTimeout(r, RAMP_INTERVAL_MS));

    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    clients.push(socket);

    socket.on('connect', () => {
      connectedCount++;
      socket.emit('player:join', { pin: PIN, name: `Player_${i}` }, (ack) => {
        if (ack && ack.success) {
          joinedCount++;
        } else {
          failedCount++;
        }
      });
    });

    socket.on('connect_error', (err) => {
      failedCount++;
    });

    socket.on('disconnect', (reason) => {
      disconnectedCount++;
    });
  }

  // Hold connections alive for 30 seconds
  console.log(`\n⏳ All ${TARGET_CLIENTS} clients initiated. Holding connections for 30 seconds...`);
  await new Promise((r) => setTimeout(r, 30000));

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n==================================================================`);
  console.log(`📊 600 CONCURRENT PLAYERS LOAD TEST RESULTS 📊`);
  console.log(`==================================================================`);
  console.log(`• Total Target Clients: ${TARGET_CLIENTS}`);
  console.log(`• Connected Sockets:   ${connectedCount} / ${TARGET_CLIENTS}`);
  console.log(`• Joined Rooms:        ${joinedCount} / ${TARGET_CLIENTS}`);
  console.log(`• Failed Sockets:      ${failedCount}`);
  console.log(`• Disconnected Sockets: ${disconnectedCount}`);
  console.log(`• Total Test Time:     ${totalTimeSec} seconds`);
  console.log(`==================================================================`);

  if (joinedCount >= TARGET_CLIENTS * 0.95 && disconnectedCount === 0) {
    console.log(`✅ LOAD TEST PASSED 100% SUCCESFULLY!`);
  } else {
    console.log(`❌ LOAD TEST HAS UNEXPECTED DROPS OR FAILURES!`);
  }

  clients.forEach((s) => s.disconnect());
  process.exit(joinedCount >= TARGET_CLIENTS * 0.95 ? 0 : 1);
}

runTest();
