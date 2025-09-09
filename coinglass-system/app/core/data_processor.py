import asyncio
import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.core.db import get_db, db_manager
from app.core.cache import cache
from app.core.logging import logger
from app.core.settings import settings

class DataProcessor:
    """Advanced data processing with validation, deduplication, and error recovery"""
    
    def __init__(self):
        self.batch_size = settings.BATCH_SIZE
        self.max_retries = settings.MAX_RETRIES
        self.processed_hashes = set()  # In-memory deduplication cache
        
    def generate_data_hash(self, data: Dict[str, Any]) -> str:
        """Generate hash for data deduplication"""
        # Create deterministic hash from key fields
        key_fields = ['symbol', 'timestamp', 'price', 'qty', 'side']
        hash_string = ""
        
        for field in key_fields:
            if field in data:
                hash_string += f"{field}:{data[field]}:"
        
        return hashlib.md5(hash_string.encode()).hexdigest()
    
    def validate_liquidation_data(self, data: Dict[str, Any]) -> bool:
        """Validate liquidation data structure"""
        required_fields = ['symbol', 'side', 'price', 'qty']
        
        # Check required fields
        for field in required_fields:
            if field not in data:
                logger.warning(f"Missing required field: {field}")
                return False
        
        # Validate data types and ranges
        try:
            price = float(data['price'])
            qty = float(data['qty'])
            
            if price <= 0 or qty <= 0:
                logger.warning(f"Invalid price or quantity: price={price}, qty={qty}")
                return False
            
            if data['side'] not in ['long', 'short']:
                logger.warning(f"Invalid side: {data['side']}")
                return False
            
            # Symbol validation
            if not isinstance(data['symbol'], str) or len(data['symbol']) < 2:
                logger.warning(f"Invalid symbol: {data['symbol']}")
                return False
                
        except (ValueError, TypeError) as e:
            logger.warning(f"Data validation error: {e}")
            return False
        
        return True
    
    def validate_funding_data(self, data: Dict[str, Any]) -> bool:
        """Validate funding rate data"""
        required_fields = ['symbol', 'rate']
        
        for field in required_fields:
            if field not in data:
                logger.warning(f"Missing required field in funding data: {field}")
                return False
        
        try:
            rate = float(data['rate'])
            if abs(rate) > 1.0:  # Funding rate > 100% is likely invalid
                logger.warning(f"Suspicious funding rate: {rate}")
                return False
        except (ValueError, TypeError):
            return False
        
        return True
    
    def deduplicate_data(self, data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate entries from data list"""
        unique_data = []
        seen_hashes = set()
        
        for data in data_list:
            data_hash = self.generate_data_hash(data)
            
            if data_hash not in seen_hashes and data_hash not in self.processed_hashes:
                unique_data.append(data)
                seen_hashes.add(data_hash)
                self.processed_hashes.add(data_hash)
        
        # Cleanup old hashes (keep only last 10000)
        if len(self.processed_hashes) > 10000:
            self.processed_hashes = set(list(self.processed_hashes)[-5000:])
        
        logger.debug(f"Deduplicated {len(data_list)} -> {len(unique_data)} records")
        return unique_data
    
    async def process_liquidation_batch(self, liquidations: List[Dict[str, Any]]) -> bool:
        """Process batch of liquidation data with error recovery"""
        try:
            # Validate and deduplicate
            valid_liquidations = []
            for liq in liquidations:
                if self.validate_liquidation_data(liq):
                    valid_liquidations.append(liq)
            
            unique_liquidations = self.deduplicate_data(valid_liquidations)
            
            if not unique_liquidations:
                return True
            
            # Process in batches
            for i in range(0, len(unique_liquidations), self.batch_size):
                batch = unique_liquidations[i:i + self.batch_size]
                await self._insert_liquidation_batch(batch)
            
            logger.info(f"Processed {len(unique_liquidations)} liquidation records")
            return True
            
        except Exception as e:
            logger.error(f"Failed to process liquidation batch: {e}")
            return False
    
    async def _insert_liquidation_batch(self, batch: List[Dict[str, Any]]):
        """Insert liquidation batch with retry logic"""
        for attempt in range(self.max_retries):
            try:
                # Use raw SQL for better performance
                from sqlalchemy import text
                from app.core.db import engine
                
                query = text("""
                    INSERT INTO liquidations (ts, symbol, side, price, qty, exchange, bucket, meta)
                    VALUES (:ts, :symbol, :side, :price, :qty, :exchange, :bucket, :meta)
                    ON CONFLICT DO NOTHING
                """)
                
                with engine.begin() as conn:
                    for record in batch:
                        conn.execute(query, {
                            'ts': record.get('timestamp', datetime.utcnow()),
                            'symbol': record['symbol'],
                            'side': record['side'],
                            'price': record['price'],
                            'qty': record['qty'],
                            'exchange': record.get('exchange'),
                            'bucket': record.get('bucket'),
                            'meta': record.get('meta')
                        })
                return
                
            except Exception as e:
                logger.warning(f"Insert attempt {attempt + 1} failed: {e}")
                if attempt == self.max_retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
    
    def enrich_data(self, data: Dict[str, Any], data_type: str) -> Dict[str, Any]:
        """Enrich data with additional calculated fields"""
        enriched = data.copy()
        
        if data_type == "liquidation":
            # Add USD value if price is available
            if 'price' in data and 'qty' in data:
                enriched['usd_value'] = float(data['price']) * float(data['qty'])
            
            # Add bucket for heatmap
            if 'price' in data:
                price = float(data['price'])
                # Create price buckets (100 buckets)
                bucket_size = price * 0.001  # 0.1% buckets
                enriched['bucket'] = round(price / bucket_size) * bucket_size
            
            # Add severity classification
            if 'usd_value' in enriched:
                usd_value = enriched['usd_value']
                if usd_value > 10000000:  # > $10M
                    enriched['severity'] = 'critical'
                elif usd_value > 1000000:  # > $1M
                    enriched['severity'] = 'high'
                elif usd_value > 100000:  # > $100K
                    enriched['severity'] = 'medium'
                else:
                    enriched['severity'] = 'low'
        
        return enriched

class DataQualityMonitor:
    """Monitor data quality and alert on issues"""
    
    def __init__(self):
        self.quality_thresholds = {
            'min_records_per_minute': 10,
            'max_error_rate': 0.1,  # 10%
            'max_duplicate_rate': 0.05  # 5%
        }
    
    def check_data_quality(self, processed_count: int, error_count: int, duplicate_count: int) -> Dict[str, Any]:
        """Check data quality metrics"""
        total_count = processed_count + error_count + duplicate_count
        
        if total_count == 0:
            return {"status": "no_data", "alerts": ["No data processed"]}
        
        error_rate = error_count / total_count
        duplicate_rate = duplicate_count / total_count
        
        alerts = []
        status = "healthy"
        
        if processed_count < self.quality_thresholds['min_records_per_minute']:
            alerts.append(f"Low data volume: {processed_count} records/minute")
            status = "warning"
        
        if error_rate > self.quality_thresholds['max_error_rate']:
            alerts.append(f"High error rate: {error_rate:.2%}")
            status = "critical"
        
        if duplicate_rate > self.quality_thresholds['max_duplicate_rate']:
            alerts.append(f"High duplicate rate: {duplicate_rate:.2%}")
            status = "warning"
        
        return {
            "status": status,
            "metrics": {
                "processed_count": processed_count,
                "error_count": error_count,
                "duplicate_count": duplicate_count,
                "error_rate": error_rate,
                "duplicate_rate": duplicate_rate
            },
            "alerts": alerts
        }

# Global instances
data_processor = DataProcessor()
data_quality_monitor = DataQualityMonitor()