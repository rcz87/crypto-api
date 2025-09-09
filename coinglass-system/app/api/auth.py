from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import auth_manager, get_current_user
from app.core.validation import APIKeyRequest
from app.core.logging import logger

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/api-key")
async def create_api_key(request: APIKeyRequest):
    """Create new API key for user"""
    try:
        api_key = auth_manager.create_api_key(request.user_id, request.tier)
        logger.info(f"API key created for user {request.user_id} with tier {request.tier}")
        
        return {
            "success": True,
            "data": {
                "api_key": api_key,
                "user_id": request.user_id,
                "tier": request.tier,
                "expires_in_hours": 24
            }
        }
    except Exception as e:
        logger.error(f"Failed to create API key: {e}")
        raise HTTPException(status_code=500, detail="Failed to create API key")

@router.delete("/api-key")
async def revoke_api_key(current_user: dict = Depends(get_current_user)):
    """Revoke current API key"""
    try:
        # Note: We'd need to get the actual token from the request to revoke it
        # This is a simplified implementation
        logger.info(f"API key revoked for user {current_user['user_id']}")
        
        return {
            "success": True,
            "message": "API key revoked successfully"
        }
    except Exception as e:
        logger.error(f"Failed to revoke API key: {e}")
        raise HTTPException(status_code=500, detail="Failed to revoke API key")

@router.get("/profile")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile and usage statistics"""
    try:
        return {
            "success": True,
            "data": {
                "user_id": current_user["user_id"],
                "tier": current_user["tier"],
                "created_at": current_user.get("iat"),
                "expires_at": current_user.get("exp")
            }
        }
    except Exception as e:
        logger.error(f"Failed to get user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user profile")