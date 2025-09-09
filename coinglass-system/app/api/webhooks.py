from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.auth import get_current_user, require_tier
from app.core.validation import WebhookConfig
from app.core.logging import logger
from app.models.tables import WebhookEndpoints
import uuid

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

@router.post("/register")
@require_tier("premium")
async def register_webhook(
    webhook_config: WebhookConfig,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Register a new webhook endpoint"""
    try:
        webhook_id = str(uuid.uuid4())
        
        webhook = WebhookEndpoints(
            id=webhook_id,
            user_id=current_user["user_id"],
            url=webhook_config.url,
            events=webhook_config.events,
            secret=webhook_config.secret,
            active=webhook_config.active
        )
        
        db.add(webhook)
        db.commit()
        
        logger.info(f"Webhook registered for user {current_user['user_id']}: {webhook_config.url}")
        
        return {
            "success": True,
            "data": {
                "webhook_id": webhook_id,
                "url": webhook_config.url,
                "events": webhook_config.events,
                "active": webhook_config.active
            }
        }
    except Exception as e:
        logger.error(f"Failed to register webhook: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to register webhook")

@router.get("/list")
async def list_webhooks(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all webhooks for current user"""
    try:
        webhooks = db.query(WebhookEndpoints).filter(
            WebhookEndpoints.user_id == current_user["user_id"]
        ).all()
        
        return {
            "success": True,
            "data": [
                {
                    "webhook_id": webhook.id,
                    "url": webhook.url,
                    "events": webhook.events,
                    "active": webhook.active,
                    "created_at": webhook.created_at
                }
                for webhook in webhooks
            ]
        }
    except Exception as e:
        logger.error(f"Failed to list webhooks: {e}")
        raise HTTPException(status_code=500, detail="Failed to list webhooks")

@router.put("/{webhook_id}")
async def update_webhook(
    webhook_id: str,
    webhook_config: WebhookConfig,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update webhook configuration"""
    try:
        webhook = db.query(WebhookEndpoints).filter(
            WebhookEndpoints.id == webhook_id,
            WebhookEndpoints.user_id == current_user["user_id"]
        ).first()
        
        if not webhook:
            raise HTTPException(status_code=404, detail="Webhook not found")
        
        webhook.url = webhook_config.url
        webhook.events = webhook_config.events
        webhook.secret = webhook_config.secret
        webhook.active = webhook_config.active
        
        db.commit()
        
        logger.info(f"Webhook updated for user {current_user['user_id']}: {webhook_id}")
        
        return {
            "success": True,
            "message": "Webhook updated successfully"
        }
    except Exception as e:
        logger.error(f"Failed to update webhook: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update webhook")

@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete webhook"""
    try:
        webhook = db.query(WebhookEndpoints).filter(
            WebhookEndpoints.id == webhook_id,
            WebhookEndpoints.user_id == current_user["user_id"]
        ).first()
        
        if not webhook:
            raise HTTPException(status_code=404, detail="Webhook not found")
        
        db.delete(webhook)
        db.commit()
        
        logger.info(f"Webhook deleted for user {current_user['user_id']}: {webhook_id}")
        
        return {
            "success": True,
            "message": "Webhook deleted successfully"
        }
    except Exception as e:
        logger.error(f"Failed to delete webhook: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete webhook")