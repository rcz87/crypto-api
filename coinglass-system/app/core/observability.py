import logging
import json
import time
from typing import Dict, Any, Optional
from datetime import datetime
from functools import wraps
from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from app.core.settings import settings

# Structured logging setup
class StructuredLogger:
    """Enhanced structured logging with JSON format"""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup structured JSON logging"""
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = JSONFormatter()
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(getattr(logging, settings.LOG_LEVEL))
    
    def info(self, message: str, **kwargs):
        self._log("INFO", message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        self._log("WARNING", message, **kwargs)
    
    def error(self, message: str, **kwargs):
        self._log("ERROR", message, **kwargs)
    
    def debug(self, message: str, **kwargs):
        self._log("DEBUG", message, **kwargs)
    
    def _log(self, level: str, message: str, **kwargs):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "message": message,
            "service": "coinglass-system",
            **kwargs
        }
        
        getattr(self.logger, level.lower())(json.dumps(log_data))

class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logs"""
    
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        if hasattr(record, 'extra_data'):
            log_data.update(record.extra_data)
        
        return json.dumps(log_data)

# Distributed Tracing
class TracingManager:
    """OpenTelemetry distributed tracing setup"""
    
    def __init__(self):
        self.tracer_provider = None
        self.tracer = None
        self._setup_tracing()
    
    def _setup_tracing(self):
        """Setup distributed tracing"""
        if not settings.TRACING_ENABLED:
            return
        
        # Configure tracer provider
        self.tracer_provider = TracerProvider()
        trace.set_tracer_provider(self.tracer_provider)
        
        # Configure Jaeger exporter
        jaeger_exporter = JaegerExporter(
            agent_host_name="jaeger",
            agent_port=6831,
        )
        
        span_processor = BatchSpanProcessor(jaeger_exporter)
        self.tracer_provider.add_span_processor(span_processor)
        
        # Get tracer
        self.tracer = trace.get_tracer(__name__)
        
        # Instrument frameworks
        FastAPIInstrumentor.instrument()
        SQLAlchemyInstrumentor.instrument()
        RedisInstrumentor.instrument()
    
    def trace_function(self, operation_name: str):
        """Decorator to trace function execution"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                if not self.tracer:
                    return func(*args, **kwargs)
                
                with self.tracer.start_as_current_span(operation_name) as span:
                    try:
                        result = func(*args, **kwargs)
                        span.set_status(trace.Status(trace.StatusCode.OK))
                        return result
                    except Exception as e:
                        span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                        raise
            return wrapper
        return decorator

# Performance Monitoring
class PerformanceMonitor:
    """Application performance monitoring"""
    
    def __init__(self):
        self.metrics = {}
        self.logger = StructuredLogger("performance")
    
    def time_operation(self, operation_name: str):
        """Decorator to time operation execution"""
        def decorator(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = await func(*args, **kwargs)
                    duration = time.time() - start_time
                    self._record_metric(operation_name, duration, "success")
                    return result
                except Exception as e:
                    duration = time.time() - start_time
                    self._record_metric(operation_name, duration, "error")
                    raise
            
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    duration = time.time() - start_time
                    self._record_metric(operation_name, duration, "success")
                    return result
                except Exception as e:
                    duration = time.time() - start_time
                    self._record_metric(operation_name, duration, "error")
                    raise
            
            return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        return decorator
    
    def _record_metric(self, operation: str, duration: float, status: str):
        """Record performance metric"""
        if operation not in self.metrics:
            self.metrics[operation] = {
                "count": 0,
                "total_duration": 0,
                "avg_duration": 0,
                "max_duration": 0,
                "min_duration": float('inf'),
                "success_count": 0,
                "error_count": 0
            }
        
        metric = self.metrics[operation]
        metric["count"] += 1
        metric["total_duration"] += duration
        metric["avg_duration"] = metric["total_duration"] / metric["count"]
        metric["max_duration"] = max(metric["max_duration"], duration)
        metric["min_duration"] = min(metric["min_duration"], duration)
        
        if status == "success":
            metric["success_count"] += 1
        else:
            metric["error_count"] += 1
        
        # Log slow operations
        if duration > 5.0:  # > 5 seconds
            self.logger.warning(
                f"Slow operation detected",
                operation=operation,
                duration=duration,
                status=status
            )
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        return self.metrics.copy()
    
    def reset_metrics(self):
        """Reset performance metrics"""
        self.metrics.clear()

# Business Metrics
class BusinessMetricsCollector:
    """Collect business-specific metrics"""
    
    def __init__(self):
        self.logger = StructuredLogger("business_metrics")
    
    def record_signal_generated(self, signal_type: str, symbol: str, severity: str):
        """Record trading signal generation"""
        self.logger.info(
            "Trading signal generated",
            event_type="signal_generated",
            signal_type=signal_type,
            symbol=symbol,
            severity=severity
        )
    
    def record_data_processed(self, data_type: str, count: int, processing_time: float):
        """Record data processing metrics"""
        self.logger.info(
            "Data processed",
            event_type="data_processed",
            data_type=data_type,
            count=count,
            processing_time=processing_time,
            records_per_second=count / processing_time if processing_time > 0 else 0
        )
    
    def record_api_usage(self, user_id: str, endpoint: str, tier: str):
        """Record API usage for billing/analytics"""
        self.logger.info(
            "API usage",
            event_type="api_usage",
            user_id=user_id,
            endpoint=endpoint,
            tier=tier
        )
    
    def record_alert_sent(self, alert_type: str, symbol: str, channel: str):
        """Record alert delivery"""
        self.logger.info(
            "Alert sent",
            event_type="alert_sent",
            alert_type=alert_type,
            symbol=symbol,
            channel=channel
        )

# Global instances
structured_logger = StructuredLogger("coinglass")
tracing_manager = TracingManager()
performance_monitor = PerformanceMonitor()
business_metrics = BusinessMetricsCollector()

import asyncio