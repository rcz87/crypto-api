from prometheus_client import Counter, Histogram, Gauge, generate_latest
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi import FastAPI, Response

# Metrics definitions
request_counter = Counter('api_requests_total', 'Total API requests', ['method', 'endpoint'])
response_time = Histogram('api_response_time_seconds', 'API response time')
active_connections = Gauge('websocket_connections_active', 'Active WebSocket connections')
data_points_processed = Counter('data_points_processed_total', 'Total data points processed', ['source'])

def setup_metrics(app: FastAPI):
    instrumentator = Instrumentator()
    instrumentator.instrument(app).expose(app)
    
    @app.get("/metrics")
    def metrics():
        return Response(generate_latest(), media_type="text/plain")