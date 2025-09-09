from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.core.settings import settings
from app.core.logging import logger
import time

# Enhanced database engine with performance optimizations
engine = create_engine(
    settings.DB_URL,
    poolclass=QueuePool,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
    pool_recycle=settings.DB_POOL_RECYCLE,
    echo=False,  # Set to True for SQL debugging
    connect_args={
        "connect_timeout": 10,
        "command_timeout": 30,
        "server_settings": {
            "application_name": "coinglass_system",
            "jit": "off"  # Disable JIT for faster query execution
        }
    }
)

SessionLocal = sessionmaker(
    bind=engine, 
    autoflush=False, 
    autocommit=False,
    expire_on_commit=False
)

# Database performance monitoring
@event.listens_for(engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time.time()

@event.listens_for(engine, "after_cursor_execute")
def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - context._query_start_time
    if total > 1.0:  # Log slow queries (>1 second)
        logger.warning(f"Slow query detected: {total:.2f}s - {statement[:100]}")

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        logger.error(f"Database session error: {e}")
        raise
    finally:
        db.close()

def check_db():
    """Health check for database connection"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False

class DatabaseManager:
    """Advanced database operations manager"""
    
    @staticmethod
    def execute_batch(queries: list, batch_size: int = 1000):
        """Execute queries in batches for better performance"""
        with engine.begin() as conn:
            for i in range(0, len(queries), batch_size):
                batch = queries[i:i + batch_size]
                for query in batch:
                    conn.execute(query)
    
    @staticmethod
    def optimize_table(table_name: str):
        """Optimize table performance"""
        with engine.begin() as conn:
            # Analyze table statistics
            conn.execute(text(f"ANALYZE {table_name}"))
            # Vacuum table
            conn.execute(text(f"VACUUM ANALYZE {table_name}"))
    
    @staticmethod
    def get_connection_stats():
        """Get database connection pool statistics"""
        pool = engine.pool
        return {
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "invalid": pool.invalid()
        }

db_manager = DatabaseManager()