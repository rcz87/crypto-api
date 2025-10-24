#!/usr/bin/env python3
"""
Targeted Autonomous Vite Configuration Fixer

This script will fix the vite.config.ts issue with minimal API calls.
Designed to avoid rate limits while still being fully autonomous.
"""
import anthropic
import os
from dotenv import load_dotenv
import json
import subprocess
import time

load_dotenv()

class TargetedViteFixer:
    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌ ANTHROPIC_API_KEY not set!")
            exit(1)
        
        print("✅ Connected to Claude AI\n")
        
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-5-20250929"
        
        # We'll use a fresh conversation for each major step to minimize token usage
        self.tools = [
            {
                "name": "read_file",
                "description": "Read file content",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filepath": {"type": "string"}
                    },
                    "required": ["filepath"]
                }
            },
            {
                "name": "write_file",
                "description": "Write to file",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filepath": {"type": "string"},
                        "content": {"type": "string"}
                    },
                    "required": ["filepath", "content"]
                }
            },
            {
                "name": "execute_command",
                "description": "Execute shell command",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string"}
                    },
                    "required": ["command"]
                }
            }
        ]
    
    def execute_tool(self, tool_name, tool_input):
        try:
            if tool_name == "read_file":
                with open(tool_input["filepath"], 'r') as f:
                    content = f.read()
                print(f"   ✅ Read: {tool_input['filepath']}")
                return {"success": True, "content": content}
            
            elif tool_name == "write_file":
                filepath = tool_input["filepath"]
                if os.path.exists(filepath):
                    backup = f"{filepath}.backup.{int(time.time())}"
                    with open(filepath, 'r') as f:
                        with open(backup, 'w') as b:
                            b.write(f.read())
                    print(f"   💾 Backup: {backup}")
                
                with open(filepath, 'w') as f:
                    f.write(tool_input["content"])
                print(f"   ✅ Fixed: {filepath}")
                return {"success": True}
            
            elif tool_name == "execute_command":
                result = subprocess.run(
                    tool_input["command"],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                print(f"   ✅ Executed: {tool_input['command'][:60]}")
                return {
                    "success": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
        
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return {"success": False, "error": str(e)}
    
    def make_api_call(self, task, max_iterations=5):
        """Make a focused API call with limited iterations to avoid rate limits"""
        conversation = [{"role": "user", "content": task}]
        
        for iteration in range(max_iterations):
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,  # Reduced to minimize token usage
                system="You are a focused system fixer. Work quickly and efficiently. Use tools to fix issues, don't just explain.",
                tools=self.tools,
                messages=conversation
            )
            
            conversation.append({
                "role": "assistant",
                "content": response.content
            })
            
            # Show what Claude is thinking
            for block in response.content:
                if hasattr(block, "text") and block.text:
                    print(f"\n💭 {block.text[:200]}{'...' if len(block.text) > 200 else ''}")
            
            if response.stop_reason == "tool_use":
                tool_results = []
                
                for block in response.content:
                    if block.type == "tool_use":
                        result = self.execute_tool(block.name, block.input)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result)
                        })
                
                conversation.append({
                    "role": "user",
                    "content": tool_results
                })
                continue
            else:
                break
        
        return True
    
    def fix_vite_issue(self):
        print("="*70)
        print("🎯 TARGETED VITE CONFIGURATION FIXER")
        print("="*70)
        print("\nThis will fix the vite.config.ts import issue efficiently.")
        print("Using minimal API calls to avoid rate limits.\n")
        
        input("Press ENTER to start fix... ")
        
        # Step 1: Read and analyze server/vite.ts
        print("\n" + "="*70)
        print("STEP 1: Analyzing server/vite.ts")
        print("="*70)
        
        task1 = """Read server/vite.ts and understand how it imports vite.config.

Then create a FIXED version of vite.config.ts that:
1. Does NOT use "import { defineConfig } from 'vite'"
2. Uses plain export default with config object
3. Includes proxy configuration for /api routes to localhost:5000

Write the fixed vite.config.ts file immediately."""

        self.make_api_call(task1, max_iterations=3)
        
        # Step 2: Restart and test
        print("\n" + "="*70)
        print("STEP 2: Restarting server and testing")
        print("="*70)
        
        task2 = """Now:
1. Execute: pm2 restart crypto-api
2. Wait 3 seconds
3. Execute: curl -s http://localhost:5000/gpts/health
4. Report if it works or show error from pm2 logs"""

        self.make_api_call(task2, max_iterations=3)
        
        return True

def main():
    print("\n" + "="*70)
    print("  EFFICIENT AUTONOMOUS FIXER")
    print("  Minimal API usage, maximum efficiency")
    print("="*70 + "\n")
    
    fixer = TargetedViteFixer()
    fixer.fix_vite_issue()
    
    # Final verification
    print("\n" + "="*70)
    print("FINAL VERIFICATION")
    print("="*70)
    
    time.sleep(3)
    result = subprocess.run(
        "curl -s http://localhost:5000/gpts/health",
        shell=True,
        capture_output=True,
        text=True
    )
    
    if "success" in result.stdout and result.returncode == 0:
        print("\n✅ SUCCESS! Server is running normally!")
        print(f"\nResponse: {result.stdout[:300]}")
        print("\n🎉 Your system is now working properly!")
    else:
        print("\n⚠️  Checking status...")
        subprocess.run("pm2 list | grep crypto-api", shell=True)
        print("\nCheck logs with: pm2 logs crypto-api --lines 20")
    
    print("\n")

if __name__ == "__main__":
    main()
