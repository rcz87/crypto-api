import asyncio
import signal
import sys
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from app.workers.fetch_rest import fetch_all_data
from app.workers.fetch_ws import start_websocket_feeds
from app.workers.build_heatmap import build_heatmaps
from app.workers.signals import generate_signals
from app.core.settings import settings
from app.core.cache import cache
from app.core.data_processor import data_processor, data_quality_monitor
from app.core.observability import structured_logger, performance_monitor, business_metrics
from app.core.backup import backup_manager
from app.business.risk_manager import risk_manager
from app.business.backtester import signal_backtester
from app.metrics import metrics_collector

class EnhancedScheduler:
    """Enhanced scheduler with monitoring and graceful shutdown"""
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.logger = structured_logger
        self.running = False
        
    def start_scheduler(self):
        """Start enhanced scheduler with all background tasks"""
        if self.running:
            return
            
        self.running = True
        self.logger.info("Starting enhanced CoinGlass scheduler")
        
        # Original tasks
        self.scheduler.add_job(
            fetch_all_data,
            'interval',
            seconds=settings.FETCH_INTERVAL_SECONDS,
            id='fetch_rest_data'
        )
        
        self.scheduler.add_job(
            build_heatmaps,
            'interval',
            minutes=5,
            id='build_heatmaps'
        )
        
        self.scheduler.add_job(
            generate_signals,
            'interval',
            minutes=1,
            id='generate_signals'
        )
        
        # Enhanced tasks
        self.scheduler.add_job(
            self.run_risk_assessments,
            'interval',
            minutes=5,
            id='risk_assessments'
        )
        
        self.scheduler.add_job(
            self.run_data_quality_checks,
            'interval',
            minutes=10,
            id='data_quality_checks'
        )
        
        self.scheduler.add_job(
            self.run_system_maintenance,
            'interval',
            hours=1,
            id='system_maintenance'
        )
        
        self.scheduler.add_job(
            self.run_backtest_analysis,
            'interval',
            hours=6,
            id='backtest_analysis'
        )
        
        self.scheduler.add_job(
            self.cleanup_cache,
            'interval',
            hours=2,
            id='cache_cleanup'
        )
        
        # Start scheduler
        self.scheduler.start()
        
        # Start WebSocket feeds
        start_websocket_feeds()
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def run_risk_assessments(self):
        """Run periodic risk assessments"""
        try:
            symbols = settings.SYMBOLS
            
            for symbol in symbols:
                assessment = risk_manager.assess_market_risk(symbol)
                
                # Store in cache
                cache.set(
                    f"risk_assessment:{symbol}",
                    assessment.__dict__,
                    ttl=1800
                )
                
                # Alert on high risk
                if assessment.risk_level in ['high', 'critical']:
                    business_metrics.record_signal_generated(
                        "risk_alert", 
                        symbol, 
                        assessment.risk_level
                    )
            
            self.logger.info("Risk assessments completed")
            
        except Exception as e:
            self.logger.error(f"Error in risk assessments: {e}")
    
    def run_data_quality_checks(self):
        """Run data quality monitoring"""
        try:
            # Get metrics from cache
            processed_count = cache.get("processed_count_hour", 0)
            error_count = cache.get("error_count_hour", 0)
            duplicate_count = cache.get("duplicate_count_hour", 0)
            
            # Check quality
            quality_report = data_quality_monitor.check_data_quality(
                processed_count, error_count, duplicate_count
            )
            
            # Store report
            cache.set("data_quality_report", quality_report, ttl=3600)
            
            if quality_report["status"] != "healthy":
                self.logger.warning(
                    "Data quality issues detected",
                    **quality_report
                )
                
        except Exception as e:
            self.logger.error(f"Error in data quality checks: {e}")
    
    def run_system_maintenance(self):
        """Run system maintenance tasks"""
        try:
            # Database optimization
            from app.core.db import db_manager
            
            tables = ['liquidations', 'funding_rate', 'futures_oi_ohlc']
            for table in tables:
                db_manager.optimize_table(table)
            
            # Create backups at 2 AM
            if datetime.utcnow().hour == 2:
                asyncio.run(backup_manager.create_database_backup())
                asyncio.run(backup_manager.cleanup_old_backups())
            
            # Log system stats
            db_stats = db_manager.get_connection_stats()
            cache_stats = cache.get_stats()
            
            self.logger.info(
                "System maintenance completed",
                db_stats=db_stats,
                cache_stats=cache_stats
            )
            
        except Exception as e:
            self.logger.error(f"Error in system maintenance: {e}")
    
    def run_backtest_analysis(self):
        """Run periodic backtest analysis"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=7)
            
            # Run for primary symbols only to avoid overload
            for symbol in settings.SYMBOLS[:2]:
                result = asyncio.run(
                    signal_backtester.backtest_signal_type(
                        "liquidation_cascade",
                        symbol,
                        start_date,
                        end_date
                    )
                )
                
                # Cache results
                cache.set(
                    f"backtest_result:{symbol}",
                    result.__dict__,
                    ttl=86400
                )
                
                self.logger.info(
                    "Backtest completed",
                    symbol=symbol,
                    win_rate=result.win_rate
                )
                
        except Exception as e:
            self.logger.error(f"Error in backtest analysis: {e}")
    
    def cleanup_cache(self):
        """Clean up temporary cache entries"""
        try:
            # Clean temporary entries
            cache.flush_pattern("temp:*")
            cache.flush_pattern("rate_limit:*")
            
            # Clean old signal cache
            cache.flush_pattern("signal:*")
            
            self.logger.info("Cache cleanup completed")
            
        except Exception as e:
            self.logger.error(f"Error in cache cleanup: {e}")
    
    def stop_scheduler(self):
        """Stop scheduler gracefully"""
        if not self.running:
            return
            
        self.running = False
        self.logger.info("Stopping enhanced scheduler")
        
        if self.scheduler.running:
            self.scheduler.shutdown(wait=True)
        
        self.logger.info("Scheduler stopped gracefully")
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        self.logger.info(f"Received signal {signum}, shutting down")
        self.stop_scheduler()
        sys.exit(0)

# Global scheduler instance
enhanced_scheduler = EnhancedScheduler()

# Legacy functions for backward compatibility
def start_scheduler():
    enhanced_scheduler.start_scheduler()

def stop_scheduler():
    enhanced_scheduler.stop_scheduler()