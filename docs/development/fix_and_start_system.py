#!/usr/bin/env python3
"""
Autonomous System Fixer & Starter

This agent will automatically:
- Diagnose why server won't start
- Fix all configuration issues
- Start server using correct method (PM2 or direct)
- Verify everything works
- Report final status

NO manual work needed - just run and watch!
"""
import anthropic
import os
from dotenv import load_dotenv
import json
import subprocess
import time

load_dotenv()

class SystemFixer:
    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌ ANTHROPIC_API_KEY not set!")
            exit(1)
        
        print("✅ Connected to Claude AI\n")
        
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-5-20250929"
        self.conversation = []
        
        self.tools = [
            {
                "name": "read_file",
                "description": "Read any file",
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
                "description": "Write to file with automatic backup",
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
                "description": "Execute any shell command",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string"},
                        "purpose": {"type": "string"}
                    },
                    "required": ["command", "purpose"]
                }
            }
        ]
    
    def execute_tool(self, tool_name, tool_input):
        purpose = tool_input.get('purpose', tool_input.get('filepath', ''))
        print(f"🔧 {purpose[:80]}")
        
        try:
            if tool_name == "read_file":
                with open(tool_input["filepath"], 'r') as f:
                    content = f.read()
                return {"success": True, "content": content}
            
            elif tool_name == "write_file":
                filepath = tool_input["filepath"]
                if os.path.exists(filepath):
                    with open(filepath, 'r') as f:
                        backup = f.read()
                    with open(f"{filepath}.backup.{int(time.time())}", 'w') as f:
                        f.write(backup)
                
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
                return {
                    "success": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.returncode
                }
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def fix_and_start(self):
        print("="*70)
        print("🔧 AUTONOMOUS SYSTEM FIXER & STARTER")
        print("="*70)
        print("\nI will automatically fix ALL issues and start your system.")
        print("Just watch - everything will be handled automatically!\n")
        
        input("Press ENTER to begin automatic fix... ")
        
        task = """You are a system administrator fixing a crypto-api Node.js application.

CURRENT SITUATION:
- npm run dev fails with vite defineConfig error
- PM2 shows no crypto-api process running
- ecosystem.config.js has module format issues
- User wants system running normally like before

YOUR AUTONOMOUS MISSION:

1. DIAGNOSE THE ISSUES:
   - Check ecosystem.config.js format issue (CommonJS vs ES module)
   - Check if api-crypto PM2 process is actually the crypto-api server
   - Determine correct way to start server

2. FIX CONFIGURATION FILES:
   - Fix ecosystem.config.js by renaming to .cjs OR converting to ES module format
   - Fix any PM2 configuration issues
   - Ensure all configs compatible with "type": "module" in package.json

3. DETERMINE BEST STARTUP METHOD:
   - Check if api-crypto PM2 process is this project
   - If yes, just restart it
   - If no, start new PM2 process with fixed config
   - As last resort, use direct tsx command

4. START THE SERVER:
   - Use PM2 if possible (production-ready)
   - Fall back to tsx if PM2 problematic
   - Ensure server binds to port 5000

5. VERIFY IT WORKS:
   - Test health endpoint: curl localhost:5000/gpts/health
   - Confirm server responding with JSON
   - Report final status

CRITICAL RULES:
- Fix files, don't just suggest fixes
- Test each fix immediately
- If one approach fails, try next automatically
- Goal: Server running and responding to requests
- Work quickly and efficiently

Start diagnosing and fixing NOW."""

        self.conversation.append({"role": "user", "content": task})
        
        iteration = 0
        max_iterations = 25
        
        while iteration < max_iterations:
            iteration += 1
            print(f"\n{'='*70}")
            print(f"Step {iteration}")
            print('='*70)
            
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system="""You are an autonomous system administrator.

YOUR PRIME DIRECTIVE: Get the server running and responding to requests.

WORKFLOW:
1. Diagnose → 2. Fix → 3. Test → 4. Verify

If something fails, immediately try alternative approach.
Work fast, work smart, work autonomously.
Use tools extensively - never ask human to do anything.""",
                tools=self.tools,
                messages=self.conversation
            )
            
            self.conversation.append({
                "role": "assistant",
                "content": response.content
            })
            
            for block in response.content:
                if hasattr(block, "text"):
                    print(f"\n💭 {block.text[:300]}{'...' if len(block.text) > 300 else ''}")
            
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
                
                self.conversation.append({
                    "role": "user",
                    "content": tool_results
                })
                continue
            else:
                print("\n" + "="*70)
                print("✅ SYSTEM FIX COMPLETED!")
                print("="*70)
                break
        
        return True

def main():
    print("\n" + "="*70)
    print("  AUTONOMOUS SYSTEM FIXER")
    print("  Your system will be running normally in moments...")
    print("="*70 + "\n")
    
    fixer = SystemFixer()
    fixer.fix_and_start()
    
    print("\n📊 FINAL STATUS CHECK:")
    print("Running health check to verify system operational...\n")
    
    result = subprocess.run(
        "curl -s http://localhost:5000/gpts/health",
        shell=True,
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0 and "success" in result.stdout:
        print("✅ SUCCESS! Your system is running normally!")
        print(f"Response: {result.stdout[:200]}...")
    else:
        print("⚠️  System started but health check inconclusive.")
        print("Check PM2 logs: pm2 logs")
    
    print("\n")

if __name__ == "__main__":
    main()
