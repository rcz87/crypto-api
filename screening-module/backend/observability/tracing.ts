// Distributed Tracing - OpenTelemetry instrumentation
// Professional APM for institutional trading systems

import { NodeSDK } from '@opentelemetry/sdk-node';
import { diag, DiagConsoleLogger, DiagLogLevel, trace, context } from '@opentelemetry/api';
// Resource import temporarily commented due to export issue
// import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { logger } from '../screener/logger';

let sdk: NodeSDK | null = null;

export function initTracing(): NodeSDK {
  try {
    // Enable debug logging if requested
    if (process.env.OTEL_DEBUG === '1') {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
      logger.info('OpenTelemetry debug logging enabled');
    }

    // Configure trace exporter
    const exporterConfig: any = {};
    
    if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
      exporterConfig.url = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    } else {
      // Default to local Jaeger/OTLP collector
      exporterConfig.url = 'http://localhost:4318/v1/traces';
    }

    // Add headers if provided
    if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
      exporterConfig.headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
    }

    const exporter = new OTLPTraceExporter(exporterConfig);

    // Initialize SDK
    sdk = new NodeSDK({
      traceExporter: exporter,
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req) => {
            // Ignore health checks and metrics endpoints from tracing
            const url = req.url || '';
            return url.includes('/health') || url.includes('/metrics');
          },
          requestHook: (span, request) => {
            // Add custom attributes to HTTP spans
            span.setAttributes({
              'http.user_agent': request.headers['user-agent'] || 'unknown',
              'http.real_ip': request.headers['x-real-ip'] || request.connection?.remoteAddress || 'unknown'
            });
          }
        }),
        new ExpressInstrumentation({
          ignoreIncomingRequestHook: (req) => {
            const url = req.url || '';
            return url.includes('/health') || url.includes('/metrics');
          }
        })
      ],
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'screener-service',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'trading',
        'service.instance.id': process.env.HOSTNAME || `instance-${Date.now()}`,
      }),
    });

    sdk.start();
    
    logger.info('OpenTelemetry tracing initialized', {
      serviceName: process.env.OTEL_SERVICE_NAME || 'screener-service',
      environment: process.env.NODE_ENV || 'development',
      exporterUrl: exporterConfig.url
    });

    return sdk;
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry tracing', { error: error.message });
    throw error;
  }
}

// Graceful shutdown
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.info('OpenTelemetry tracing shut down gracefully');
    } catch (error) {
      logger.error('Error during tracing shutdown', { error: error.message });
    }
  }
}

// Custom tracing utilities for trading operations
export function createTracer(name: string) {
  return trace.getTracer(name, process.env.OTEL_SERVICE_VERSION || '1.0.0');
}

// Helper function to create spans for trading operations
export async function traceOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = createTracer('screener-operations');
  
  return tracer.startActiveSpan(operationName, async (span) => {
    try {
      // Add custom attributes
      if (attributes) {
        span.setAttributes(attributes);
      }

      // Add operation timestamp
      span.setAttributes({
        'operation.timestamp': Date.now(),
        'operation.environment': process.env.NODE_ENV || 'development'
      });

      const result = await operation();
      
      // Mark as successful
      span.setStatus({ code: 1 }); // OK
      span.setAttributes({ 'operation.success': true });
      
      return result;
    } catch (error) {
      // Record error
      span.recordException(error);
      span.setStatus({ 
        code: 2, // ERROR
        message: error.message 
      });
      span.setAttributes({ 
        'operation.success': false,
        'error.type': error.constructor.name,
        'error.message': error.message
      });
      
      throw error;
    } finally {
      span.end();
    }
  });
}

// Specialized tracing for screening operations
export async function traceScreeningOperation<T>(
  symbol: string,
  timeframe: string,
  operation: () => Promise<T>
): Promise<T> {
  return traceOperation(
    'screening.analyze',
    operation,
    {
      'trading.symbol': symbol,
      'trading.timeframe': timeframe,
      'operation.type': 'screening'
    }
  );
}

// Specialized tracing for backtest operations
export async function traceBacktestOperation<T>(
  symbol: string,
  timeframe: string,
  candleCount: number,
  operation: () => Promise<T>
): Promise<T> {
  return traceOperation(
    'backtest.execute',
    operation,
    {
      'trading.symbol': symbol,
      'trading.timeframe': timeframe,
      'backtest.candle_count': candleCount,
      'operation.type': 'backtest'
    }
  );
}

// Specialized tracing for database operations
export async function traceDatabaseOperation<T>(
  table: string,
  operationType: string,
  operation: () => Promise<T>
): Promise<T> {
  return traceOperation(
    `db.${operationType}`,
    operation,
    {
      'db.table': table,
      'db.operation': operationType,
      'operation.type': 'database'
    }
  );
}

// Context management utilities
export function getCurrentSpan() {
  return trace.getActiveSpan();
}

export function addSpanAttribute(key: string, value: string | number | boolean) {
  const span = getCurrentSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}

export function addSpanAttributes(attributes: Record<string, string | number | boolean>) {
  const span = getCurrentSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

// Helper to parse OTLP headers
function parseHeaders(headerString: string): Record<string, string> {
  const headers: Record<string, string> = {};
  
  headerString.split(',').forEach(header => {
    const [key, value] = header.split('=');
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  });
  
  return headers;
}

// Set up graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down tracing...');
  await shutdownTracing();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down tracing...');
  await shutdownTracing();
});