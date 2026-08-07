import { Injectable, OnModuleInit } from "@nestjs/common";
import * as client from "prom-client";

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry = client.register;

  // ==================================================================
  // HTTP METRICS
  // ==================================================================
  public readonly httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests processed",
    labelNames: ["method", "route", "code"],
  });

  public readonly httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  public readonly httpActiveRequestsGauge = new client.Gauge({
    name: "http_active_requests",
    help: "Number of active HTTP requests currently being processed",
  });

  // ==================================================================
  // SOCKET.IO METRICS
  // ==================================================================
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

  public readonly socketDisconnectsTotal = new client.Counter({
    name: "socket_disconnects_total",
    help: "Total socket disconnect events",
    labelNames: ["reason"],
  });

  public readonly socketReconnectsTotal = new client.Counter({
    name: "socket_reconnects_total",
    help: "Total socket reconnection events",
  });

  public readonly socketMessagesTotal = new client.Counter({
    name: "socket_messages_total",
    help: "Total socket messages processed",
    labelNames: ["event"],
  });

  public readonly socketJoinFailuresTotal = new client.Counter({
    name: "socket_join_failures_total",
    help: "Total failed room join attempts",
    labelNames: ["reason"],
  });

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

  // ==================================================================
  // QUIZ OPERATIONAL METRICS
  // ==================================================================
  public readonly activeQuizzesGauge = new client.Gauge({
    name: "quiz_active_total",
    help: "Total actively running quizzes",
  });

  public readonly quizAnswersTotal = new client.Counter({
    name: "quiz_answers_total",
    help: "Total submitted quiz answers",
  });

  public readonly quizAnswerDurationHistogram = new client.Histogram({
    name: "quiz_answer_duration_seconds",
    help: "Time taken by players to answer a question in seconds",
    buckets: [0.1, 0.5, 1, 2.5, 5, 10, 15, 30],
  });

  public readonly quizLeaderboardDurationHistogram = new client.Histogram({
    name: "quiz_leaderboard_duration_seconds",
    help: "Duration of leaderboard calculation in seconds",
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  });

  public readonly quizCompletionsTotal = new client.Counter({
    name: "quiz_completions_total",
    help: "Total completed quiz sessions",
  });

  public readonly quizPlayerAccuracyGauge = new client.Gauge({
    name: "quiz_player_accuracy",
    help: "Average correct answer percentage across active quizzes",
  });

  public readonly quizHostActionsTotal = new client.Counter({
    name: "quiz_host_actions_total",
    help: "Total host events emitted",
    labelNames: ["action"],
  });

  // ==================================================================
  // ANSWER PIPELINE TELEMETRY METRICS
  // ==================================================================
  public readonly answersReceivedTotal = new client.Counter({
    name: "answers_received_total",
    help: "Total player answer submission events received at gateway",
  });

  public readonly answersPersistedTotal = new client.Counter({
    name: "answers_persisted_total",
    help: "Total answer submissions successfully persisted to database",
  });

  public readonly answersAckTotal = new client.Counter({
    name: "answers_ack_total",
    help: "Total answer ACKs returned to client",
  });

  public readonly answersLateTotal = new client.Counter({
    name: "answers_late_total",
    help: "Total answer submissions received after question timeout",
  });

  public readonly answerProcessingDuration = new client.Histogram({
    name: "answer_processing_duration_seconds",
    help: "Total duration of player:answer processing pipeline in seconds",
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  public readonly answerDbDuration = new client.Histogram({
    name: "answer_db_duration_seconds",
    help: "Duration of database write operations for player:answer in seconds",
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  // ==================================================================
  // DATABASE METRICS
  // ==================================================================
  public readonly dbLatencyHistogram = new client.Histogram({
    name: "db_latency_seconds",
    help: "Latency of database operations in seconds",
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  });

  public readonly dbSlowQueriesTotal = new client.Counter({
    name: "db_slow_queries_total",
    help: "Total database queries exceeding 100ms threshold",
  });

  public readonly dbConnectionsActiveGauge = new client.Gauge({
    name: "db_connections_active",
    help: "Active database pool connections",
  });

  public readonly dbTransactionsTotal = new client.Counter({
    name: "db_transactions_total",
    help: "Total database transactions executed",
  });

  public readonly dbFailedQueriesTotal = new client.Counter({
    name: "db_failed_queries_total",
    help: "Total failed database operations",
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
