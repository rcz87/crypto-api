#!/bin/bash

##############################################
# Quick VPS Deployment Script
# For crypto-api application
##############################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Banner
echo "=================================================="
echo "🚀 VPS Deployment Script - Crypto API"
echo "=================================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    log_warning "This script needs sudo privileges for systemctl commands"
    log_info "You may be prompted for your password"
fi

# Step 1: Check if we're in the right directory
log_info "Checking current directory..."
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    log_error "Please run this script from the crypto-api root directory"
    exit 1
fi
log_success "Directory check passed"

# Step 2: Check if .env file exists
log_info "Checking environment configuration..."
if [ ! -f ".env" ]; then
    log_warning ".env file not found!"
    log_info "Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_warning "Please edit .env file with your actual values before continuing"
        log_info "After editing, run this script again"
        exit 0
    else
        log_error ".env.example not found. Cannot create .env"
        exit 1
    fi
else
    log_success ".env file found"
fi

# Step 3: Pull latest changes (if git repo)
if [ -d ".git" ]; then
    log_info "Pulling latest changes from Git..."
    git pull origin main || git pull origin master || log_warning "Git pull failed or not needed"
    log_success "Git pull completed"
else
    log_warning "Not a Git repository, skipping pull"
fi

# Step 4: Install/Update dependencies
log_info "Installing Node.js dependencies..."
npm install --omit=dev --quiet
log_success "Dependencies installed"

# Step 5: Build frontend
log_info "Building frontend application..."
npm run build
log_success "Frontend build completed"

# Step 6: Build backend
log_info "Building backend server..."
if [ -d "dist" ]; then
    rm -rf dist/index.js
fi
npm run build
log_success "Backend build completed"

# Step 7: Restart Python service
log_info "Restarting Python service..."
if sudo systemctl restart python_service 2>/dev/null; then
    log_success "Python service restarted"
    sleep 3  # Wait for Python service to fully start
else
    log_warning "Could not restart python_service (might not be installed)"
fi

# Step 8: Restart Node service
log_info "Restarting Node.js service..."
if sudo systemctl restart node_service 2>/dev/null; then
    log_success "Node service restarted"
    sleep 2  # Wait for Node service to start
else
    log_warning "Could not restart node_service (might not be installed)"
fi

# Step 9: Check service status
echo ""
log_info "Checking service status..."
echo "=================================================="

if sudo systemctl is-active --quiet python_service; then
    log_success "Python service is running"
    PYTHON_STATUS="✅ Running"
else
    log_error "Python service is not running!"
    PYTHON_STATUS="❌ Failed"
    PYTHON_FAILED=true
fi

if sudo systemctl is-active --quiet node_service; then
    log_success "Node service is running"
    NODE_STATUS="✅ Running"
else
    log_error "Node service is not running!"
    NODE_STATUS="❌ Failed"
    NODE_FAILED=true
fi

# Step 10: Display summary
echo ""
echo "=================================================="
echo "📊 DEPLOYMENT SUMMARY"
echo "=================================================="
echo "Python Service: $PYTHON_STATUS"
echo "Node Service:   $NODE_STATUS"
echo ""

if [ -z "$PYTHON_FAILED" ] && [ -z "$NODE_FAILED" ]; then
    log_success "🎉 Deployment successful!"
    echo ""
    echo "Application is running at:"
    echo "  • Node.js Gateway: http://localhost:5000"
    echo "  • Python Engine:   http://localhost:8000"
    echo ""
    echo "Check health:"
    echo "  curl http://localhost:5000/health"
    echo "  curl http://localhost:8000/health"
    echo ""
else
    log_error "Deployment completed with errors!"
    echo ""
    echo "Check logs with:"
    if [ -n "$NODE_FAILED" ]; then
        echo "  sudo journalctl -u node_service -n 50"
    fi
    if [ -n "$PYTHON_FAILED" ]; then
        echo "  sudo journalctl -u python_service -n 50"
    fi
    exit 1
fi

# Step 11: Optional - Reload Nginx if installed
if command -v nginx &> /dev/null; then
    log_info "Reloading Nginx configuration..."
    if sudo nginx -t 2>/dev/null; then
        sudo systemctl reload nginx
        log_success "Nginx reloaded"
    else
        log_warning "Nginx config test failed, skipping reload"
    fi
fi

echo "=================================================="
log_success "Deployment script completed!"
echo "=================================================="
