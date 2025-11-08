#!/usr/bin/env python3
"""
Main Crypto API Launcher - Liquidation Heatmap System
Port: 8501
Purpose: Cryptocurrency Liquidation Heatmap with Multi-Exchange Aggregation
"""
import os
import sys
import subprocess
from pathlib import Path

def main():
    """Launch the main crypto API on port 8501"""
    
    # Set environment variables for main API
    os.environ['API_TYPE'] = 'main'
    os.environ['API_NAME'] = 'Liquidation Heatmap System'
    os.environ['API_PORT'] = '8501'
    os.environ['API_DESCRIPTION'] = 'Cryptocurrency Liquidation Heatmap with Multi-Exchange Aggregation'
    
    # Change to parent directory where main app.py is located
    parent_dir = Path(__file__).parent
    main_app_path = parent_dir / 'app.py'
    
    if not main_app_path.exists():
        print(f"❌ Main app not found at {main_app_path}")
        sys.exit(1)
    
    print("🚀 Starting Main Crypto API - Liquidation Heatmap System")
    print(f"📍 Location: {main_app_path}")
    print(f"🌐 Port: 8501")
    print(f"📊 Features: Liquidation Analysis, Social Intelligence, GPT Assistant")
    print("=" * 60)
    
    # Launch Streamlit with specific port
    try:
        subprocess.run([
            'streamlit', 'run', str(main_app_path),
            '--server.port', '8501',
            '--server.address', '0.0.0.0',
            '--server.headless', 'true',
            '--browser.gatherUsageStats', 'false'
        ], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start main API: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n👋 Main API stopped by user")
        sys.exit(0)

if __name__ == "__main__":
    main()
