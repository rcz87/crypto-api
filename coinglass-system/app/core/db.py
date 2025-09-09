from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.settings import settings

engine = create_engine(settings.DB_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_db():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))