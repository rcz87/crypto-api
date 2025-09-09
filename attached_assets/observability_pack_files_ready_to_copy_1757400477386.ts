// ============================================================================
// OBSERVABILITY PACK — Metrics, Tracing & Alerts (ready-to-copy)
// Target: screening-module v2.x (Express/TypeScript)
// Copy each block to the indicated file path in your repo.
// ============================================================================

// ============================================================================
// File: backend/observability/metrics.ts
// ============================================================================
import client from 'prom-client';
import type { Request, Response, NextFunction } from 'express';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'screener_' });

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Request duration in seconds',
  buckets: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  labelNames: ['method', 'route', 'status'] as const,
});

export const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of 5xx errors',
  labelNames: ['route'] as const,
});

registry.registerMetric(httpRequestsTotal);
registry.registerMetric(httpRequestDuration);
registry.registerMetric(httpErrorsTotal);

export function metricsMiddleware(routeName?: string) {
  return function(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    const method = req.method;
    const route = routeName || (req.route?.path || req.path || 'unknown');

    res.on('finish', () => {
      const status = String(res.statusCode);
      const durNs = Number(process.hrtime.bigint() - start);
      const durSec = durNs / 1e9;
      httpRequestsTotal.inc({ method, route, status });
      httpRequestDuration.observe({ method, route, status }, durSec);
      if (res.statusCode >= 500) httpErrorsTotal.inc({ route });
    });
    next();
  };
}

export async function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
}


// ============================================================================
// File: backend/observability/tracing.ts
// ============================================================================
import { NodeSDK } from '@opentelemetry/sdk-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

export function initTracing() {
  if (process.env.OTEL_DEBUG === '1') diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

  const exporter = new OTLPTraceExporter({
    // Defaults: http://localhost:4318/v1/traces
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  });

  const sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
    ],
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'screener-service',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'dev',
    }),
  });

  sdk.start();
  return sdk; // Call sdk.shutdown() on process exit
}


// ============================================================================
// File: backend/observability/alerts.ts
// ============================================================================
import fetch from 'node-fetch';
import { httpErrorsTotal, httpRequestsTotal } from './metrics';

/**
 * ErrorRateAlerter — compute error rate from Prom counters over sliding time windows.
 * For serious prod setups, prefer Prometheus Alertmanager. This works in-app quickly.
 */
export class ErrorRateAlerter {
  private lastReq = 0; private lastErr = 0; private timer: NodeJS.Timeout | null = null;
  constructor(private cfg: { intervalMs:number; threshold:number; telegramBotToken:string; telegramChatId:string; }) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      const reqNow = sumCounter(httpRequestsTotal);
      const errNow = sumCounter(httpErrorsTotal);
      const dReq = Math.max(0, reqNow - this.lastReq);
      const dErr = Math.max(0, errNow - this.lastErr);
      this.lastReq = reqNow; this.lastErr = errNow;
      if (dReq === 0) return;
      const rate = dErr / dReq; // error rate within this window
      if (rate >= this.cfg.threshold) {
        const pct = (rate*100).toFixed(2);
        await this.sendTelegram(`🚨 Error rate spike: ${pct}% in last ${(this.cfg.intervalMs/1000)}s (dErr=${dErr}, dReq=${dReq})`);
      }
    }, this.cfg.intervalMs);
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  private async sendTelegram(text:string){
    const url = `https://api.telegram.org/bot${this.cfg.telegramBotToken}/sendMessage`;
    const body = { chat_id: this.cfg.telegramChatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    try { await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) }); }
    catch { /* ignore */ }
  }
}

function sumCounter(c:any){
  const v = c.get();
  return (v?.values || []).reduce((acc:number, x:any) => acc + (x?.value || 0), 0);
}


// ============================================================================
// File: backend/observability/index.ts
// ============================================================================
import express from 'express';
import { metricsHandler, metricsMiddleware } from './metrics';
import { initTracing } from './tracing';
import { ErrorRateAlerter } from './alerts';

export function initObservability(app: express.Express) {
  // Metrics middleware (wrap all routes)
  app.use(metricsMiddleware());

  // /metrics endpoint (Prometheus scrape)
  app.get('/metrics', metricsHandler);

  // Tracing
  const tracing = initTracing();

  // Telegram Alerts (optional)
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const threshold = Number(process.env.ERROR_RATE_THRESHOLD || 0.2); // 20%
  const intervalMs = Number(process.env.ERROR_RATE_WINDOW_MS || 60000);
  if (botToken && chatId) {
    const alerter = new ErrorRateAlerter({ intervalMs, threshold, telegramBotToken: botToken, telegramChatId: chatId });
    alerter.start();
  }

  // graceful shutdown example
  process.on('SIGTERM', async () => { try { await tracing.shutdown(); } catch {} process.exit(0); });
}


// ============================================================================
// File: backend/server.observability.mount.ts
// ============================================================================
import express from 'express';
import cors from 'cors';
import { screenerRouter } from '../screener/screener.routes';
import { initObservability } from './index';

const app = express();
app.use(cors({ origin: [/localhost/, /guardiansofthegreentoken\.com$/] }));

// INIT (metrics + tracing + alerts)
initObservability(app);

// Your existing routes
app.use('/api/screener', screenerRouter);

app.listen(Number(process.env.PORT || 8080), () => console.log('Server with Observability up'));


// ============================================================================
// File: deploy/prometheus.yml  (optional)
// ============================================================================
# Scrapes /metrics from your service
scrape_configs:
  - job_name: 'screener'
    scrape_interval: 15s
    static_configs:
      - targets: ['host.docker.internal:8080']  # adjust to your host/container


// ============================================================================
// File: deploy/docker-compose.observability.yml  (optional)
// ============================================================================
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports: [ '9090:9090' ]

  grafana:
    image: grafana/grafana:latest
    ports: [ '3000:3000' ]
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    depends_on: [ prometheus ]

  tempo:
    image: grafana/tempo:latest
    command: ["-config.expand-env=true"]
    ports: [ '4318:4318' ] # OTLP HTTP

# Grafana data sources:
#  - Prometheus at http://prometheus:9090
#  - Tempo (OTLP traces)
