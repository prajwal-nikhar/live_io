const { io } = require("socket.io-client");
const fs = require("fs");
const path = require("path");

const SERVER_URL = process.env.SERVER_URL || "http://localhost:4000";
const PIN = process.env.PIN || "999999";

const STAGES = [
  { name: "1 Client Verification", count: 1, holdMs: 3000 },
  { name: "10 Players", count: 10, holdMs: 3000 },
  { name: "50 Players", count: 50, holdMs: 5000 },
  { name: "100 Players", count: 100, holdMs: 5000 },
  { name: "300 Players", count: 300, holdMs: 8000 },
  { name: "600 Players", count: 600, holdMs: 15000 },
];

async function runStage(stage) {
  console.log(
    `\n------------------------------------------------------------------`,
  );
  console.log(`🚀 STAGE: ${stage.name} (${stage.count} concurrent users)`);
  console.log(
    `------------------------------------------------------------------`,
  );

  let connected = 0;
  let joined = 0;
  let failed = 0;
  let disconnected = 0;
  const latencies = [];

  const clients = [];

  for (let i = 1; i <= stage.count; i++) {
    const startTime = Date.now();
    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 10000,
    });
    clients.push(socket);

    socket.on("connect", () => {
      connected++;
      socket.emit(
        "player:join",
        { pin: PIN, name: `VU_${stage.count}_${i}` },
        (ack) => {
          if (ack && ack.success) {
            joined++;
            latencies.push(Date.now() - startTime);
          } else {
            failed++;
          }
        },
      );
    });

    socket.on("connect_error", () => {
      failed++;
    });

    socket.on("disconnect", () => {
      disconnected++;
    });

    // Small stagger to avoid OS socket burst limit
    await new Promise((r) => setTimeout(r, 10));
  }

  await new Promise((r) => setTimeout(r, stage.holdMs));

  const avgLatency =
    latencies.length > 0
      ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)
      : 0;
  console.log(`  • Connected:   ${connected} / ${stage.count}`);
  console.log(`  • Joined:      ${joined} / ${stage.count}`);
  console.log(`  • Failed:      ${failed}`);
  console.log(`  • Disconnected:${disconnected}`);
  console.log(`  • Avg Latency: ${avgLatency} ms`);

  // Disconnect clients before next stage
  clients.forEach((s) => s.disconnect());
  await new Promise((r) => setTimeout(r, 1000));

  return {
    stage: stage.name,
    count: stage.count,
    connected,
    joined,
    failed,
    disconnected,
    avgLatencyMs: parseFloat(avgLatency),
  };
}

async function main() {
  console.log(
    `==================================================================`,
  );
  console.log(
    `🎯 STARTING PROGRESSIVE LOAD TEST SUITE: 1 → 600 CONCURRENT USERS`,
  );
  console.log(`🔊 Target URL: ${SERVER_URL}`);
  console.log(`🔑 Room PIN:   ${PIN}`);
  console.log(
    `==================================================================`,
  );

  const results = [];
  let allPassed = true;

  for (const stage of STAGES) {
    const res = await runStage(stage);
    results.push(res);
    if (res.joined < res.count || res.failed > 0) {
      allPassed = false;
      console.error(`\n❌ STAGE FAILED: ${stage.name}`);
      if (stage.count === 1) {
        console.error(
          `Stopping further tests as 1-client verification failed.`,
        );
        break;
      }
    } else {
      console.log(`✅ STAGE PASSED: ${stage.name}`);
    }
  }

  const totalCreated = results.reduce((acc, r) => acc + r.count, 0);
  const totalJoined = results.reduce((acc, r) => acc + r.joined, 0);
  const totalFailed = results.reduce((acc, r) => acc + r.failed, 0);

  const resultJson = {
    aggregate: {
      counters: {
        "vusers.created": totalCreated,
        "vusers.created_by_name.Join Quiz": totalCreated,
        "vusers.completed": totalJoined,
        "vusers.failed": totalFailed,
      },
      rates: {
        connection_success_rate: `${((totalJoined / totalCreated) * 100).toFixed(1)}%`,
      },
      firstCounterAt: Date.now() - 60000,
      lastCounterAt: Date.now(),
      summary: results,
    },
  };

  const resultPath = path.join(__dirname, "result.json");
  fs.writeFileSync(resultPath, JSON.stringify(resultJson, null, 2));

  console.log(
    `\n==================================================================`,
  );
  console.log(`📊 FINAL PROGRESSIVE LOAD TEST SUMMARY REPORT 📊`);
  console.log(
    `==================================================================`,
  );
  console.log(`• Total Virtual Users Created: ${totalCreated}`);
  console.log(
    `• Total Room Joins Succeeded:  ${totalJoined} (${((totalJoined / totalCreated) * 100).toFixed(1)}%)`,
  );
  console.log(`• Total Failed Sockets:        ${totalFailed}`);
  console.log(`• Result JSON Written To:     ${resultPath}`);
  console.log(
    `==================================================================`,
  );

  process.exit(allPassed ? 0 : 1);
}

main();
