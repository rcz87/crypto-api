#!/bin/bash
# Dual Crypto API Launcher
# Runs both Main API (8501) and Guardians API (8502) simultaneously

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

# Function to check if port is available
check_port() {
    local port=$1
    local service_name=$2
    
    if lsof -i :$port >/dev/null 2>&1; then
        print_error "Port $port is already in use (conflict with $service_name)"
        print_warning "Please stop the service using port $port or change the port configuration"
        return 1
    else
        print_status "Port $port is available for $service_name"
        return 0
    fi
}

# Function to check dependencies
check_dependencies() {
    print_header "Checking Dependencies"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed"
        exit 1
    fi
    print_status "Python 3 is available"
    
    # Check Node.js (for GPT Gateway)
    if ! command -v node &> /dev/null; then
        print_warning "Node.js is not installed (GPT Gateway may not work)"
    else
        print_status "Node.js is available"
    fi
    
    # Check Redis (optional)
    if ! command -v redis-cli &> /dev/null; then
        print_warning "Redis is not installed (caching may not work)"
    else
        print_status "Redis is available"
    fi
    
    # Check required files
    local required_files=(
        "run_main_api.py"
        "run_guardians_api.py"
        "env_main_api.sh"
        "env_guardians_api.sh"
        "app.py"
        "config_guardians.py"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_error "Required file not found: $file"
            exit 1
        fi
    done
    print_status "All required files are present"
}

# Function to setup environment
setup_environment() {
    print_header "Setting Up Environment"
    
    # Create logs directory
    mkdir -p logs
    print_status "Created logs directory"
    
    # Load environment variables
    if [[ -f "env_main_api.sh" ]]; then
        source env_main_api.sh
        print_status "Loaded Main API environment"
    else
        print_error "Main API environment file not found"
        exit 1
    fi
    
    if [[ -f "env_guardians_api.sh" ]]; then
        source env_guardians_api.sh
        print_status "Loaded Guardians API environment"
    else
        print_error "Guardians API environment file not found"
        exit 1
    fi
}

# Function to start GPT Gateway (optional)
start_gpt_gateway() {
    print_header "Starting GPT Gateway (Optional)"
    
    if [[ -d "../server" ]]; then
        cd ../server
        if [[ -f "package.json" ]]; then
            print_status "Starting GPT Gateway on port 3000..."
            npm start > ../crypto-api/logs/gpt_gateway.log 2>&1 &
            GPT_GATEWAY_PID=$!
            echo $GPT_GATEWAY_PID > ../crypto-api/logs/gpt_gateway.pid
            cd ../crypto-api
            print_status "GPT Gateway started with PID: $GPT_GATEWAY_PID"
            
            # Wait a moment for GPT Gateway to start
            sleep 3
        else
            print_warning "package.json not found in server directory"
            cd ../crypto-api
        fi
    else
        print_warning "Server directory not found, skipping GPT Gateway"
    fi
}

# Function to start APIs
start_apis() {
    print_header "Starting Dual Crypto APIs"
    
    # Start Main API
    print_status "Starting Main API (Liquidation Heatmap) on port 8501..."
    python3 run_main_api.py > logs/main_api.log 2>&1 &
    MAIN_API_PID=$!
    echo $MAIN_API_PID > logs/main_api.pid
    print_status "Main API started with PID: $MAIN_API_PID"
    
    # Start Guardians API
    print_status "Starting Guardians API (Premium Analytics) on port 8502..."
    python3 run_guardians_api.py > logs/guardians_api.log 2>&1 &
    GUARDIANS_API_PID=$!
    echo $GUARDIANS_API_PID > logs/guardians_api.pid
    print_status "Guardians API started with PID: $GUARDIANS_API_PID"
    
    # Wait for APIs to start
    print_status "Waiting for APIs to initialize..."
    sleep 5
}

# Function to check API health
check_api_health() {
    print_header "Checking API Health"
    
    # Check Main API
    if curl -s http://localhost:8501/_stcore/health >/dev/null 2>&1; then
        print_status "✅ Main API (8501) is healthy"
    else
        print_warning "⚠️  Main API (8501) may not be ready yet"
    fi
    
    # Check Guardians API
    if curl -s http://localhost:8502/_stcore/health >/dev/null 2>&1; then
        print_status "✅ Guardians API (8502) is healthy"
    else
        print_warning "⚠️  Guardians API (8502) may not be ready yet"
    fi
    
    # Check GPT Gateway
    if curl -s http://localhost:3000/gpts/health >/dev/null 2>&1; then
        print_status "✅ GPT Gateway (3000) is healthy"
    else
        print_warning "⚠️  GPT Gateway (3000) may not be running"
    fi
}

# Function to display status
display_status() {
    print_header "Dual API Status"
    
    echo -e "${BLUE}Main API (Liquidation Heatmap)${NC}"
    echo -e "  URL: http://localhost:8501"
    echo -e "  Health: http://localhost:8501/_stcore/health"
    echo -e "  PID: $(cat logs/main_api.pid 2>/dev/null || echo 'Unknown')"
    echo -e "  Log: logs/main_api.log"
    echo ""
    
    echo -e "${BLUE}Guardians API (Premium Analytics)${NC}"
    echo -e "  URL: http://localhost:8502"
    echo -e "  Health: http://localhost:8502/_stcore/health"
    echo -e "  PID: $(cat logs/guardians_api.pid 2>/dev/null || echo 'Unknown')"
    echo -e "  Log: logs/guardians_api.log"
    echo ""
    
    if [[ -f "logs/gpt_gateway.pid" ]]; then
        echo -e "${BLUE}GPT Gateway${NC}"
        echo -e "  URL: http://localhost:3000"
        echo -e "  Health: http://localhost:3000/gpts/health"
        echo -e "  PID: $(cat logs/gpt_gateway.pid 2>/dev/null || echo 'Unknown')"
        echo -e "  Log: logs/gpt_gateway.log"
        echo ""
    fi
    
    echo -e "${GREEN}All APIs are running!${NC}"
    echo -e "${YELLOW}Use 'tail -f logs/*.log' to monitor logs${NC}"
    echo -e "${YELLOW}Use './stop_dual_api.sh' to stop all services${NC}"
}

# Function to handle cleanup on exit
cleanup() {
    print_header "Cleaning Up"
    
    # Kill background processes
    if [[ -n "$MAIN_API_PID" ]]; then
        kill $MAIN_API_PID 2>/dev/null || true
        print_status "Stopped Main API"
    fi
    
    if [[ -n "$GUARDIANS_API_PID" ]]; then
        kill $GUARDIANS_API_PID 2>/dev/null || true
        print_status "Stopped Guardians API"
    fi
    
    if [[ -n "$GPT_GATEWAY_PID" ]]; then
        kill $GPT_GATEWAY_PID 2>/dev/null || true
        print_status "Stopped GPT Gateway"
    fi
    
    # Remove PID files
    rm -f logs/*.pid
    
    print_status "Cleanup completed"
}

# Set up signal handlers
trap cleanup EXIT INT TERM

# Main execution
main() {
    print_header "Dual Crypto API Launcher"
    echo -e "${BLUE}Starting Main API (8501) and Guardians API (8502)${NC}"
    echo ""
    
    # Check dependencies
    check_dependencies
    
    # Check port availability
    check_port 8501 "Main API" || exit 1
    check_port 8502 "Guardians API" || exit 1
    check_port 3000 "GPT Gateway" || print_warning "GPT Gateway port 3000 is in use"
    
    # Setup environment
    setup_environment
    
    # Start GPT Gateway (optional)
    start_gpt_gateway
    
    # Start APIs
    start_apis
    
    # Check health
    check_api_health
    
    # Display status
    display_status
    
    # Keep script running
    print_header "Monitoring APIs"
    echo -e "${GREEN}Press Ctrl+C to stop all APIs${NC}"
    echo ""
    
    # Monitor loop
    while true; do
        sleep 30
        
        # Check if processes are still running
        if [[ -f "logs/main_api.pid" ]]; then
            MAIN_PID=$(cat logs/main_api.pid)
            if ! kill -0 $MAIN_PID 2>/dev/null; then
                print_error "Main API process died, restarting..."
                python3 run_main_api.py > logs/main_api.log 2>&1 &
                echo $! > logs/main_api.pid
            fi
        fi
        
        if [[ -f "logs/guardians_api.pid" ]]; then
            GUARDIANS_PID=$(cat logs/guardians_api.pid)
            if ! kill -0 $GUARDIANS_PID 2>/dev/null; then
                print_error "Guardians API process died, restarting..."
                python3 run_guardians_api.py > logs/guardians_api.log 2>&1 &
                echo $! > logs/guardians_api.pid
            fi
        fi
        
        if [[ -f "logs/gpt_gateway.pid" ]]; then
            GPT_PID=$(cat logs/gpt_gateway.pid)
            if ! kill -0 $GPT_PID 2>/dev/null; then
                print_warning "GPT Gateway process died, attempting restart..."
                start_gpt_gateway
            fi
        fi
    done
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Dual Crypto API Launcher"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --test         Run tests instead of starting APIs"
        echo "  --status       Show current status"
        echo ""
        echo "Examples:"
        echo "  $0              # Start both APIs"
        echo "  $0 --test       # Run API tests"
        echo "  $0 --status     # Check current status"
        exit 0
        ;;
    --test)
        print_header "Running API Tests"
        python3 test_apis.py
        exit $?
        ;;
    --status)
        print_header "Current API Status"
        if [[ -f "logs/main_api.pid" ]]; then
            MAIN_PID=$(cat logs/main_api.pid)
            if kill -0 $MAIN_PID 2>/dev/null; then
                print_status "Main API (8501) is running (PID: $MAIN_PID)"
            else
                print_error "Main API (8501) is not running"
            fi
        else
            print_error "Main API (8501) is not running"
        fi
        
        if [[ -f "logs/guardians_api.pid" ]]; then
            GUARDIANS_PID=$(cat logs/guardians_api.pid)
            if kill -0 $GUARDIANS_PID 2>/dev/null; then
                print_status "Guardians API (8502) is running (PID: $GUARDIANS_PID)"
            else
                print_error "Guardians API (8502) is not running"
            fi
        else
            print_error "Guardians API (8502) is not running"
        fi
        
        if [[ -f "logs/gpt_gateway.pid" ]]; then
            GPT_PID=$(cat logs/gpt_gateway.pid)
            if kill -0 $GPT_PID 2>/dev/null; then
                print_status "GPT Gateway (3000) is running (PID: $GPT_PID)"
            else
                print_error "GPT Gateway (3000) is not running"
            fi
        else
            print_warning "GPT Gateway (3000) is not running"
        fi
        exit 0
        ;;
    *)
        main
        ;;
esac
