#!/usr/bin/env python3
"""
Unified SQLAlchemy Base
Canonical source untuk database models
"""

from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData

class Base(DeclarativeBase):
    """
    Unified SQLAlchemy Base class untuk semua models
    
    Ini adalah satu-satunya sumber untuk Base - semua model dan test
    harus import Base dari sini untuk menghindari konflik.
    """
    metadata = MetaData()

# Export untuk easy import
__all__ = ['Base']