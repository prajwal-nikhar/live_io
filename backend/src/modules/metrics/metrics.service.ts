import { Injectable, OnModuleInit } from "@nestjs/common";
import * as client from "prom-client";

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry = client.register;

  // Gauges
  public readonly activeSocketsGauge = new client.Gauge({
    name: "active_sockets",
    help: "Total active Socket.IO connections",
  });

  public readonly activeRoomsGauge = new client.Gauge({
    name: "active_rooms",
    help: "Total active quiz rooms",
  });

  public readonly connectedPlayersGauge = new client.Gauge({
    name: "connected_players",
    help: "Total connected players across all rooms",
  });

  // Histograms
  public readonly joinLatencyHistogram = new client.Histogram({
    name: "join_latency_seconds",
    help: "Latency of player:join processing in seconds",
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  public readonly broadcastLatencyHistogram = new client.Histogram({
    name: "broadcast_latency_seconds",
    help: "Latency of WebSocket room broadcasts in seconds",
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  });

  public readonly dbLatencyHistogram = new client.Histogram({
    name: "db_latency_seconds",
    help: "Latency of database operations in seconds",
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  });

  onModuleInit() {
    // Enable default metrics collection (CPU, Memory, Event Loop Lag, File Descriptors)
    client.collectDefaultMetrics({ prefix: "nodejs_" });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getMetricsContentType(): string {
    return this.registry.contentType;
  }
}
