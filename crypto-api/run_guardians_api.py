#!/usr/bin/env python3
"""
GuardiansOfTheToken API Launcher - Premium Analytics
Port: 8502
Purpose: Premium Orderbook Analysis with Institutional Data
"""
import os
import sys
import subprocess
from pathlib import Path

def main():
    """Launch the GuardiansOfTheToken API on port 8502"""
    
    # Set environment variables for Guardians API
    os.environ['API_TYPE'] = 'guardians'
    os.environ['API_NAME'] = 'GuardiansOfTheToken Premium Analytics'
    os.environ['API_PORT'] = '8502'
    os.environ['API_DESCRIPTION'] = 'Premium Orderbook Analysis with Institutional Data'
    
    # Current directory is where guardians app.py is located
    current_dir = Path(__file__).parent
    guardians_app_path = current_dir / 'app.py'
    
    if not guardians_app_path.exists():
        print(f"❌ Guardians app not found at {guardians_app_path}")
        sys.exit(1)
    
    print("🚀 Starting GuardiansOfTheToken API - Premium Analytics")
    print(f"📍 Location: {guardians_app_path}")
    print(f"🌐 Port: 8502")
    print(f"📊 Features: Premium Orderbook, Institutional Analysis, VIP Features")
    print("=" * 60)
    
    # Launch Streamlit with specific port
    try:
        subprocess.run([
            'streamlit', 'run', str(guardians_app_path),
            '--server.port', '8502',
            '--server.address', '0.0.0.0',
            '--server.headless', 'true',
            '--browser.gatherUsageStats', 'false'
        ], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start Guardians API: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n👋 Guardians API stopped by user")
        sys.exit(0)

if __name__ == "__main__":
    main()
