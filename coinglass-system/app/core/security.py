from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.sessions import SessionMiddleware
import secrets
from app.core.settings import settings

def setup_security_middleware(app: FastAPI):
    """Setup security middleware for the application"""
    
    # HTTPS Redirect (only in production)
    if settings.ENV == "prod":
        app.add_middleware(HTTPSRedirectMiddleware)
    
    # Trusted Host
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=settings.ALLOWED_HOSTS
    )
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
        expose_headers=["X-RateLimit-Remaining", "X-RateLimit-Reset"]
    )
    
    # Session middleware
    app.add_middleware(
        SessionMiddleware, 
        secret_key=secrets.token_urlsafe(32)
    )

class SecurityHeaders:
    """Security headers middleware"""
    
    def __init__(self, app: FastAPI):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                
                # Security headers
                security_headers = {
                    b"x-content-type-options": b"nosniff",
                    b"x-frame-options": b"DENY",
                    b"x-xss-protection": b"1; mode=block",
                    b"strict-transport-security": b"max-age=31536000; includeSubDomains",
                    b"content-security-policy": b"default-src 'self'",
                    b"referrer-policy": b"strict-origin-when-cross-origin"
                }
                
                headers.update(security_headers)
                message["headers"] = list(headers.items())
            
            await send(message)
        
        await self.app(scope, receive, send_with_headers)

def setup_security_headers(app: FastAPI):
    """Add security headers middleware"""
    app.add_middleware(SecurityHeaders)