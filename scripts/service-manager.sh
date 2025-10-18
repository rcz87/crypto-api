#!/bin/bash

# Crypto API Service Manager
# Unified management script for all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service names
PYTHON_SERVICE="python_service.service"
NODE_SERVICE="node_service.service"
ENV_WATCHER="env-watcher.path"

# Functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "Please run as root (use sudo)"
        exit 1
    fi
}

# Service status check
check_status() {
    print_header "Service Status"
    
    echo ""
    echo "🐍 Python Service:"
    systemctl status $PYTHON_SERVICE --no-pager -l | head -15
    
    echo ""
    echo "🟢 Node Service:"
    systemctl status $NODE_SERVICE --no-pager -l | head -15
    
    echo ""
    echo "👁️  Environment Watcher:"
    systemctl status $ENV_WATCHER --no-pager -l | head -10
    
    echo ""
    print_info "Use 'journalctl -u <service> -f' for live logs"
}

# Start all services
start_services() {
    check_root
    print_header "Starting Services"
    
    echo "🚀 Starting Python service..."
    systemctl start $PYTHON_SERVICE
    print_success "Python service started"
    
    sleep 2
    
    echo "🚀 Starting Node service..."
    systemctl start $NODE_SERVICE
    print_success "Node service started"
    
    echo "🚀 Starting environment watcher..."
    systemctl start $ENV_WATCHER
    print_success "Environment watcher started"
    
    echo ""
    print_success "All services started successfully!"
}

# Stop all services
stop_services() {
    check_root
    print_header "Stopping Services"
    
    echo "🛑 Stopping Node service..."
    systemctl stop $NODE_SERVICE
    print_success "Node service stopped"
    
    echo "🛑 Stopping Python service..."
    systemctl stop $PYTHON_SERVICE
    print_success "Python service stopped"
    
    echo "🛑 Stopping environment watcher..."
    systemctl stop $ENV_WATCHER
    print_success "Environment watcher stopped"
    
    echo ""
    print_success "All services stopped successfully!"
}

# Restart all services
restart_services() {
    check_root
    print_header "Restarting Services"
    
    echo "🔄 Restarting Python service..."
    systemctl restart $PYTHON_SERVICE
    print_success "Python service restarted"
    
    sleep 2
    
    echo "🔄 Restarting Node service..."
    systemctl restart $NODE_SERVICE
    print_success "Node service restarted"
    
    echo ""
    print_success "All services restarted successfully!"
}

# Graceful reload
reload_services() {
    check_root
    print_header "Graceful Reload"
    
    echo "🔄 Reloading Python service (graceful)..."
    systemctl reload-or-restart $PYTHON_SERVICE
    print_success "Python service reloaded"
    
    echo "🔄 Reloading Node service (graceful)..."
    systemctl reload-or-restart $NODE_SERVICE
    print_success "Node service reloaded"
    
    echo ""
    print_success "Services reloaded gracefully!"
}

# View logs
view_logs() {
    print_header "Service Logs"
    
    if [ -n "$1" ]; then
        case $1 in
            python)
                echo "📋 Python service logs (press Ctrl+C to exit):"
                journalctl -u $PYTHON_SERVICE -f --no-pager
                ;;
            node)
                echo "📋 Node service logs (press Ctrl+C to exit):"
                journalctl -u $NODE_SERVICE -f --no-pager
                ;;
            env)
                echo "📋 Environment watcher logs (press Ctrl+C to exit):"
                journalctl -u env-watcher.service -f --no-pager
                ;;
            all)
                echo "📋 All service logs (press Ctrl+C to exit):"
                journalctl -u $PYTHON_SERVICE -u $NODE_SERVICE -u env-watcher.service -f --no-pager
                ;;
            *)
                print_error "Unknown service: $1"
                echo "Available: python, node, env, all"
                exit 1
                ;;
        esac
    else
        echo "📋 Recent logs from all services:"
        journalctl -u $PYTHON_SERVICE -u $NODE_SERVICE -u env-watcher.service -n 50 --no-pager
    fi
}

# Health check
health_check() {
    print_header "Health Check"
    
    echo "🔍 Checking Python service (port 8000)..."
    if curl -s http://localhost:8000/health > /dev/null; then
        print_success "Python service is healthy"
    else
        print_error "Python service is not responding"
    fi
    
    echo "🔍 Checking Node service (port 5000)..."
    if curl -s http://localhost:5000/api/status > /dev/null 2>&1; then
        print_success "Node service is healthy"
    else
        print_warning "Node service health check failed (might be normal if endpoint doesn't exist)"
    fi
    
    echo ""
    echo "📊 Service status:"
    systemctl is-active $PYTHON_SERVICE && print_success "Python service: active" || print_error "Python service: inactive"
    systemctl is-active $NODE_SERVICE && print_success "Node service: active" || print_error "Node service: inactive"
    systemctl is-active $ENV_WATCHER && print_success "Environment watcher: active" || print_error "Environment watcher: inactive"
}

# Show usage
show_usage() {
    print_header "Crypto API Service Manager"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  status              Show status of all services"
    echo "  start               Start all services"
    echo "  stop                Stop all services"
    echo "  restart             Restart all services"
    echo "  reload              Graceful reload (zero-downtime)"
    echo "  logs [service]      View logs (python|node|env|all)"
    echo "  health              Run health check"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 status           # Check service status"
    echo "  $0 restart          # Restart all services"
    echo "  $0 logs python      # View Python service logs"
    echo "  $0 logs all         # View all service logs"
    echo "  $0 health           # Run health check"
    echo ""
}

# Main script
case "${1:-help}" in
    status)
        check_status
        ;;
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    reload)
        reload_services
        ;;
    logs)
        view_logs "$2"
        ;;
    health)
        health_check
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac
