from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from app.core.db import engine
from app.core.auth import get_current_user, require_tier
from app.core.validation import DataExportRequest
from app.core.logging import logger
import pandas as pd
import json
import io
from datetime import datetime

router = APIRouter(prefix="/export", tags=["data-export"])

@router.post("/data")
@require_tier("premium")
async def export_data(
    request: DataExportRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Export historical data in various formats"""
    try:
        # Generate export based on data type
        if request.data_type == "liquidations":
            data = await export_liquidations(request)
        elif request.data_type == "funding_rate":
            data = await export_funding_rates(request)
        elif request.data_type == "oi_data":
            data = await export_oi_data(request)
        elif request.data_type == "heatmap":
            data = await export_heatmap_data(request)
        else:
            raise HTTPException(status_code=400, detail="Invalid data type")
        
        # Format data according to requested format
        if request.format == "json":
            content = json.dumps(data, default=str)
            media_type = "application/json"
            filename = f"{request.data_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        elif request.format == "csv":
            df = pd.DataFrame(data)
            content = df.to_csv(index=False)
            media_type = "text/csv"
            filename = f"{request.data_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        elif request.format == "parquet":
            df = pd.DataFrame(data)
            buffer = io.BytesIO()
            df.to_parquet(buffer, index=False)
            content = buffer.getvalue()
            media_type = "application/octet-stream"
            filename = f"{request.data_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.parquet"
        else:
            # Default to JSON if format is unrecognized
            content = json.dumps(data, default=str)
            media_type = "application/json"
            filename = f"{request.data_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        logger.info(f"Data export completed for user {current_user['user_id']}: {request.data_type}")
        
        # Return streaming response
        def generate():
            if isinstance(content, bytes):
                yield content
            elif isinstance(content, str):
                yield content.encode('utf-8')
            else:
                # Handle other types (like bytearray, memoryview)
                yield bytes(content)
        
        return StreamingResponse(
            generate(),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail="Export failed")

async def export_liquidations(request: DataExportRequest):
    """Export liquidation data"""
    # Create parameterized IN clause
    symbols_placeholders = ",".join([f":symbol_{i}" for i in range(len(request.symbols))])
    
    query = text(f"""
        SELECT ts, symbol, side, price, qty, exchange, bucket
        FROM liquidations 
        WHERE symbol IN ({symbols_placeholders})
        AND ts >= :start_time
        AND ts <= :end_time
        ORDER BY ts DESC
        LIMIT 100000
    """)
    
    with engine.begin() as conn:
        # Create parameter dictionary with symbols
        params: dict = {
            "start_time": request.time_range.start_time,
            "end_time": request.time_range.end_time
        }
        # Add symbol parameters
        for i, symbol in enumerate(request.symbols):
            params[f"symbol_{i}"] = symbol
            
        result = conn.execute(query, params)
        return [dict(row) for row in result.mappings()]

async def export_funding_rates(request: DataExportRequest):
    """Export funding rate data"""
    # Create parameterized IN clause
    symbols_placeholders = ",".join([f":symbol_{i}" for i in range(len(request.symbols))])
    
    query = text(f"""
        SELECT ts, symbol, exchange, interval, rate, rate_oi_weighted
        FROM funding_rate 
        WHERE symbol IN ({symbols_placeholders})
        AND ts >= :start_time
        AND ts <= :end_time
        ORDER BY ts DESC
        LIMIT 50000
    """)
    
    with engine.begin() as conn:
        # Create parameter dictionary with symbols
        params: dict = {
            "start_time": request.time_range.start_time,
            "end_time": request.time_range.end_time
        }
        # Add symbol parameters
        for i, symbol in enumerate(request.symbols):
            params[f"symbol_{i}"] = symbol
            
        result = conn.execute(query, params)
        return [dict(row) for row in result.mappings()]

async def export_oi_data(request: DataExportRequest):
    """Export Open Interest data"""
    # Create parameterized IN clause
    symbols_placeholders = ",".join([f":symbol_{i}" for i in range(len(request.symbols))])
    
    query = text(f"""
        SELECT ts, symbol, interval, open, high, low, close, oi_value
        FROM futures_oi_ohlc 
        WHERE symbol IN ({symbols_placeholders})
        AND ts >= :start_time
        AND ts <= :end_time
        ORDER BY ts DESC
        LIMIT 50000
    """)
    
    with engine.begin() as conn:
        # Create parameter dictionary with symbols
        params: dict = {
            "start_time": request.time_range.start_time,
            "end_time": request.time_range.end_time
        }
        # Add symbol parameters
        for i, symbol in enumerate(request.symbols):
            params[f"symbol_{i}"] = symbol
            
        result = conn.execute(query, params)
        return [dict(row) for row in result.mappings()]

async def export_heatmap_data(request: DataExportRequest):
    """Export heatmap data"""
    # Create parameterized IN clause
    symbols_placeholders = ",".join([f":symbol_{i}" for i in range(len(request.symbols))])
    
    query = text(f"""
        SELECT ts_min, symbol, bucket, score, components
        FROM composite_heatmap 
        WHERE symbol IN ({symbols_placeholders})
        AND ts_min >= :start_time
        AND ts_min <= :end_time
        ORDER BY ts_min DESC
        LIMIT 50000
    """)
    
    with engine.begin() as conn:
        # Create parameter dictionary with symbols
        params: dict = {
            "start_time": request.time_range.start_time,
            "end_time": request.time_range.end_time
        }
        # Add symbol parameters
        for i, symbol in enumerate(request.symbols):
            params[f"symbol_{i}"] = symbol
            
        result = conn.execute(query, params)
        return [dict(row) for row in result.mappings()]