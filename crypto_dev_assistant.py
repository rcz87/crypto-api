#!/usr/bin/env python3
"""Crypto API Development Assistant"""
import anthropic
import os
from dotenv import load_dotenv
import subprocess
import json

load_dotenv()

class CryptoDevAssistant:
    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )
        self.project_root = "/root/crypto-api"
        
    def analyze_project(self):
        """Analyze current project structure"""
        print("🔍 Analyzing crypto-api project...\n")
        
        # Get project structure
        result = subprocess.run(
            ['find', self.project_root, '-type', 'f', '-name', '*.ts', '-o', '-name', '*.tsx', '-o', '-name', '*.js'],
            capture_output=True,
            text=True
        )
        
        files = result.stdout.strip().split('\n')[:20]  # Limit to 20 files
        
        prompt = f"""Analyze this crypto-api project structure:

Project Root: {self.project_root}
Key Files Found:
{chr(10).join(files)}

Current Issue:
- Endpoint /api/heatmap/status returns HTML instead of JSON
- Need to debug routing issue
- Running on port 5000 with Vite dev server

Please provide:
1. Likely cause of the routing issue
2. Which files I should check first
3. Steps to fix the issue
4. Suggestions for project structure improvements
"""
        
        response = self.client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return response.content[0].text
    
    def check_server_status(self):
        """Check if server is running and on which port"""
        result = subprocess.run(
            ['ps', 'aux'],
            capture_output=True,
            text=True
        )
        
        # Filter for crypto-api processes
        lines = [line for line in result.stdout.split('\n') if 'crypto-api' in line]
        
        return lines
    
    def suggest_next_steps(self, issue_description):
        """Get suggestions for next steps"""
        
        prompt = f"""I'm working on a crypto-api project with this issue:

{issue_description}

Current setup:
- TypeScript backend with tsx
- Vite frontend
- Running on port 5000
- Multiple endpoints needed for crypto data

Provide actionable next steps with specific commands or code examples.
"""
        
        response = self.client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2000,
            system="""You are an expert in:
- TypeScript/Node.js backend development
- Express/Fastify API design
- Vite frontend configuration
- Cryptocurrency APIs integration
- Production-grade error handling

Give specific, actionable advice with code examples.""",
            messages=[{"role": "user", "content": prompt}]
        )
        
        return response.content[0].text

def main():
    assistant = CryptoDevAssistant()
    
    print("=" * 60)
    print("🤖 Crypto API Development Assistant")
    print("=" * 60)
    
    # Check server status
    print("\n📊 Server Status:")
    servers = assistant.check_server_status()
    for server in servers:
        print(f"  {server}")
    
    print("\n" + "=" * 60)
    
    # Analyze project
    print("\n🔍 Project Analysis:\n")
    analysis = assistant.analyze_project()
    print(analysis)
    
    print("\n" + "=" * 60)
    
    # Interactive mode
    print("\n�� What would you like to do?")
    print("1. Debug the routing issue")
    print("2. Add new API endpoint")
    print("3. Improve code structure")
    print("4. Add error handling")
    print("5. Custom question")
    print("6. Exit")
    
    choice = input("\nChoice (1-6): ").strip()
    
    if choice == '1':
        print("\n🐛 Debugging routing issue...\n")
        suggestion = assistant.suggest_next_steps(
            "API endpoint /api/heatmap/status returns HTML instead of JSON"
        )
        print(suggestion)
    
    elif choice == '2':
        endpoint = input("Endpoint name (e.g., /api/crypto/prices): ").strip()
        description = input("What should this endpoint do? ").strip()
        
        suggestion = assistant.suggest_next_steps(
            f"Need to create endpoint {endpoint} that {description}"
        )
        print(f"\n📝 Creating endpoint {endpoint}...\n")
        print(suggestion)
    
    elif choice == '5':
        question = input("Your question: ").strip()
        suggestion = assistant.suggest_next_steps(question)
        print("\n💡 Suggestion:\n")
        print(suggestion)

if __name__ == "__main__":
    main()
