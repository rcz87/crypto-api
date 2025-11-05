#!/usr/bin/env python3
"""
Full Autonomous Diagnostic and Fix Assistant
This assistant can automatically diagnose issues and fix them without manual intervention
"""
import anthropic
import os
from dotenv import load_dotenv
import json
import subprocess
import re

load_dotenv()

class FullAutoDiagnosticAssistant:
    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌ ERROR: ANTHROPIC_API_KEY not set!")
            exit(1)
        
        print(f"✅ API Key loaded successfully")
        
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-5-20250929"
        self.conversation = []
        
        # Define all tools yang bisa digunakan untuk autonomous operation
        self.tools = [
            {
                "name": "read_file",
                "description": "Read content of a file",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filepath": {"type": "string", "description": "Path to file"}
                    },
                    "required": ["filepath"]
                }
            },
            {
                "name": "write_file",
                "description": "Write content to a file with automatic backup",
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
                "name": "execute_shell_command",
                "description": "Execute any shell command and get output. Use this to diagnose system state.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "Shell command to execute"
                        },
                        "description": {
                            "type": "string", 
                            "description": "Human-readable description of what this command does"
                        }
                    },
                    "required": ["command", "description"]
                }
            }
        ]
    
    def execute_tool(self, tool_name, tool_input):
        """Execute tool and return result"""
        print(f"\n🔧 Executing: {tool_name}")
        print(f"   Purpose: {tool_input.get('description', 'N/A')}")
        
        try:
            if tool_name == "read_file":
                with open(tool_input["filepath"], 'r') as f:
                    content = f.read()
                print(f"   ✅ Read {len(content)} characters")
                return {"success": True, "content": content}
            
            elif tool_name == "write_file":
                filepath = tool_input["filepath"]
                # Create backup if file exists
                if os.path.exists(filepath):
                    backup_path = f"{filepath}.backup"
                    with open(filepath, 'r') as f:
                        backup_content = f.read()
                    with open(backup_path, 'w') as f:
                        f.write(backup_content)
                    print(f"   💾 Backup: {backup_path}")
                
                # Write new content
                with open(filepath, 'w') as f:
                    f.write(tool_input["content"])
                print(f"   ✅ Written to {filepath}")
                return {"success": True}
            
            elif tool_name == "execute_shell_command":
                cmd = tool_input["command"]
                print(f"   Command: {cmd}")
                
                result = subprocess.run(
                    cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0:
                    print(f"   ✅ Success")
                else:
                    print(f"   ⚠️  Exit code: {result.returncode}")
                
                return {
                    "success": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.returncode
                }
        
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def diagnose_and_fix_routing(self):
        """Fully autonomous diagnostic and fix for routing issue"""
        print("\n" + "="*70)
        print("🤖 FULL AUTONOMOUS DIAGNOSTIC & FIX")
        print("="*70)
        print("\nI will now automatically:")
        print("  1. Diagnose what ports are actually in use")
        print("  2. Find where backend server is listening")  
        print("  3. Check current vite proxy configuration")
        print("  4. Fix proxy to point to correct backend port")
        print("  5. Verify the fix works")
        print("\nNo manual intervention needed - just watch!\n")
        
        input("Press ENTER to start autonomous diagnostic and fix... ")
        
        # Create comprehensive task for Claude
        task = """You are an expert DevOps engineer debugging a crypto-api full-stack application.

SITUATION:
- Frontend: Vite dev server running on port 5173
- Backend: Express/Node server that should handle /api routes
- PROBLEM: /api requests return HTML instead of JSON
- CAUSE: Vite proxy misconfigured or pointing to wrong port

YOUR MISSION (fully autonomous):
1. Execute command to check what's listening on ports 5000-5173
2. Execute grep to find PORT configuration in server/index.ts  
3. Analyze results to identify actual backend port
4. Read current vite.config.ts
5. Update proxy target to correct backend port
6. Write fixed vite.config.ts
7. Test by executing curl to verify fix works

You have execute_shell_command tool - use it freely for all diagnostic commands.
Be systematic, explain your reasoning, and fix the issue completely.

DO NOT ask me to run commands manually - YOU run them using your tools!"""

        self.conversation.append({
            "role": "user",
            "content": task
        })
        
        # Main autonomous loop
        iteration = 0
        max_iterations = 20  # Prevent infinite loops
        
        while iteration < max_iterations:
            iteration += 1
            print(f"\n--- Iteration {iteration} ---")
            
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system="""You are an autonomous DevOps AI agent.

KEY PRINCIPLES:
- Use execute_shell_command tool to run ANY diagnostic command you need
- Analyze outputs systematically  
- Make decisions based on data
- Fix issues automatically
- Explain your reasoning clearly

NEVER ask the human to run commands - YOU have the tools to run them yourself!""",
                tools=self.tools,
                messages=self.conversation
            )
            
            # Add response to conversation
            self.conversation.append({
                "role": "assistant",
                "content": response.content
            })
            
            # Print any text responses from Claude
            for block in response.content:
                if hasattr(block, "text"):
                    print(f"\n💬 Claude:\n{block.text}")
            
            # Handle tool use
            if response.stop_reason == "tool_use":
                tool_results = []
                
                for block in response.content:
                    if block.type == "tool_use":
                        # Execute tool
                        result = self.execute_tool(block.name, block.input)
                        
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result)
                        })
                
                # Add tool results to conversation
                self.conversation.append({
                    "role": "user",
                    "content": tool_results
                })
                
                # Continue loop for next iteration
                continue
            else:
                # No more tool calls - Claude is done
                print("\n" + "="*70)
                print("✅ AUTONOMOUS DIAGNOSTIC & FIX COMPLETED!")
                print("="*70)
                break
        
        if iteration >= max_iterations:
            print("\n⚠️  Reached maximum iterations")
        
        return True

def main():
    assistant = FullAutoDiagnosticAssistant()
    
    print("="*70)
    print("🤖 Full Autonomous Diagnostic & Fix Assistant")
    print("="*70)
    print("\nThis assistant will:")
    print("  ✓ Run all diagnostic commands automatically")
    print("  ✓ Analyze system state")
    print("  ✓ Identify issues")
    print("  ✓ Fix configuration automatically")
    print("  ✓ Verify the fix works")
    print("\nYou just watch - AI does everything!")
    
    assistant.diagnose_and_fix_routing()

if __name__ == "__main__":
    main()
