from apscheduler.schedulers.background import BackgroundScheduler
from app.workers.fetch_rest import fetch_all_data
from app.workers.fetch_ws import start_websocket_feeds
from app.workers.build_heatmap import build_heatmaps
from app.workers.signals import generate_signals
from app.core.settings import settings

scheduler = BackgroundScheduler()

def start_scheduler():
    # REST API data fetching
    scheduler.add_job(
        fetch_all_data,
        'interval',
        seconds=settings.FETCH_INTERVAL_SECONDS,
        id='fetch_rest_data'
    )
    
    # Heatmap building
    scheduler.add_job(
        build_heatmaps,
        'interval',
        minutes=5,
        id='build_heatmaps'
    )
    
    # Signal generation
    scheduler.add_job(
        generate_signals,
        'interval',
        minutes=1,
        id='generate_signals'
    )
    
    scheduler.start()
    
    # Start WebSocket feeds in background
    start_websocket_feeds()