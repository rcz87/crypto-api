#!/bin/bash
# Stop Dual Crypto API Services
# Stops Main API (8501), Guardians API (8502), and GPT Gateway (3000)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Function to stop process by PID file
stop_process() {
    local pid_file=$1
    local service_name=$2
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            print_status "Stopping $service_name (PID: $pid)..."
            kill "$pid"
            
            # Wait for process to stop
            local count=0
            while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
                sleep 1
                ((count++))
            done
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                print_warning "Force stopping $service_name..."
                kill -9 "$pid" 2>/dev/null || true
            fi
            
            print_status "$service_name stopped successfully"
        else
            print_warning "$service_name PID $pid not running"
        fi
        
        # Remove PID file
        rm -f "$pid_file"
    else
        print_warning "$service_name PID file not found"
    fi
}

# Function to stop process by port
stop_by_port() {
    local port=$1
    local service_name=$2
    
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
        print_status "Stopping $service_name processes on port $port..."
        echo "$pids" | xargs kill 2>/dev/null || true
        
        # Wait a moment
        sleep 2
        
        # Force kill if still running
        local remaining_pids=$(lsof -ti:$port 2>/dev/null || true)
        if [[ -n "$remaining_pids" ]]; then
            print_warning "Force stopping $service_name on port $port..."
            echo "$remaining_pids" | xargs kill -9 2>/dev/null || true
        fi
        
        print_status "$service_name on port $port stopped"
    else
        print_warning "No $service_name processes found on port $port"
    fi
}

# Function to stop Docker containers
stop_docker() {
    print_header "Stopping Docker Containers"
    
    # Stop docker-compose if running
    if command -v docker-compose &> /dev/null; then
        if docker-compose ps -q 2>/dev/null | grep -q .; then
            print_status "Stopping Docker Compose services..."
            docker-compose down 2>/dev/null || true
            print_status "Docker Compose services stopped"
        else
            print_status "No Docker Compose services running"
        fi
    fi
    
    # Stop individual containers
    local containers=(
        "crypto-main-api"
        "crypto-guardians-api"
        "gpt-gateway"
        "crypto-redis"
        "crypto-nginx"
    )
    
    for container in "${containers[@]}"; do
        if docker ps -q --filter "name=$container" | grep -q . 2>/dev/null; then
            print_status "Stopping Docker container: $container"
            docker stop "$container" 2>/dev/null || true
            docker rm "$container" 2>/dev/null || true
        fi
    done
}

# Function to clean up resources
cleanup() {
    print_header "Cleaning Up Resources"
    
    # Remove PID files
    if [[ -d "logs" ]]; then
        rm -f logs/*.pid
        print_status "Removed PID files"
    fi
    
    # Clean up temporary files
    find . -name "*.pyc" -delete 2>/dev/null || true
    find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
    
    print_status "Cleanup completed"
}

# Function to show final status
show_status() {
    print_header "Final Status"
    
    # Check ports
    local ports=(8501 8502 3000 6379)
    local services=("Main API" "Guardians API" "GPT Gateway" "Redis")
    
    for i in "${!ports[@]}"; do
        local port=${ports[$i]}
        local service=${services[$i]}
        
        if lsof -i :$port >/dev/null 2>&1; then
            print_warning "⚠️  $service may still be running on port $port"
        else
            print_status "✅ $service port $port is free"
        fi
    done
    
    # Check Docker
    if docker ps -q --filter "name=crypto-" | grep -q . 2>/dev/null; then
        print_warning "⚠️  Some crypto Docker containers may still be running"
    else
        print_status "✅ No crypto Docker containers running"
    fi
    
    print_status "All services have been stopped"
}

# Main execution
main() {
    print_header "Dual Crypto API Stopper"
    echo -e "${BLUE}Stopping Main API (8501), Guardians API (8502), and GPT Gateway (3000)${NC}"
    echo ""
    
    # Stop by PID files first
    print_header "Stopping Services by PID Files"
    stop_process "logs/main_api.pid" "Main API"
    stop_process "logs/guardians_api.pid" "Guardians API"
    stop_process "logs/gpt_gateway.pid" "GPT Gateway"
    
    # Stop by port as backup
    print_header "Stopping Services by Port"
    stop_by_port 8501 "Main API"
    stop_by_port 8502 "Guardians API"
    stop_by_port 3000 "GPT Gateway"
    stop_by_port 6379 "Redis"
    
    # Stop Docker containers
    stop_docker
    
    # Clean up
    cleanup
    
    # Show final status
    show_status
    
    echo ""
    print_status "🎉 All Dual Crypto API services have been stopped!"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Dual Crypto API Stopper"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --force        Force stop all processes"
        echo "  --docker-only  Stop only Docker containers"
        echo "  --ports-only   Stop only processes by port"
        echo ""
        echo "Examples:"
        echo "  $0              # Stop all services normally"
        echo "  $0 --force      # Force stop all services"
        echo "  $0 --docker-only # Stop only Docker containers"
        exit 0
        ;;
    --force)
        print_header "Force Stop Mode"
        print_warning "Force stopping all processes..."
        
        # Kill all processes on ports
        for port in 8501 8502 3000 6379; do
            stop_by_port $port "Service on port $port"
        done
        
        # Stop Docker containers
        stop_docker
        
        # Clean up
        cleanup
        
        show_status
        exit 0
        ;;
    --docker-only)
        print_header "Docker Only Mode"
        stop_docker
        exit 0
        ;;
    --ports-only)
        print_header "Ports Only Mode"
        stop_by_port 8501 "Main API"
        stop_by_port 8502 "Guardians API"
        stop_by_port 3000 "GPT Gateway"
        stop_by_port 6379 "Redis"
        exit 0
        ;;
    *)
        main
        ;;
esac
