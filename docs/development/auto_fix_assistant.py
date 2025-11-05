#!/usr/bin/env python3
"""
Auto-Fix Assistant for Crypto API Project
This assistant can automatically read, analyze, and fix common issues
"""
import anthropic
import os
from dotenv import load_dotenv
import json
import subprocess

load_dotenv()

class AutoFixAssistant:
    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌ ERROR: ANTHROPIC_API_KEY not set!")
            exit(1)
        
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-5-20250929"
        self.conversation = []
        
        # Tools yang bisa digunakan untuk auto-fix
        self.tools = [
            {
                "name": "read_file",
                "description": "Read content of a file",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filepath": {
                            "type": "string",
                            "description": "Path to file to read"
                        }
                    },
                    "required": ["filepath"]
                }
            },
            {
                "name": "write_file",
                "description": "Write content to a file. This will overwrite existing content.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filepath": {
                            "type": "string",
                            "description": "Path to file to write"
                        },
                        "content": {
                            "type": "string",
                            "description": "Content to write to file"
                        }
                    },
                    "required": ["filepath", "content"]
                }
            },
            {
                "name": "execute_command",
                "description": "Execute a shell command and return result",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "Shell command to execute"
                        }
                    },
                    "required": ["command"]
                }
            }
        ]
    
    def execute_tool(self, tool_name, tool_input):
        """Execute tool dan return result"""
        print(f"\n🔧 Executing: {tool_name}")
        print(f"   Input: {json.dumps(tool_input, indent=2)}")
        
        try:
            if tool_name == "read_file":
                with open(tool_input["filepath"], 'r') as f:
                    content = f.read()
                print(f"   ✅ Read {len(content)} characters from {tool_input['filepath']}")
                return {"success": True, "content": content}
            
            elif tool_name == "write_file":
                # Backup file dulu sebelum overwrite
                filepath = tool_input["filepath"]
                if os.path.exists(filepath):
                    backup_path = f"{filepath}.backup"
                    with open(filepath, 'r') as f:
                        backup_content = f.read()
                    with open(backup_path, 'w') as f:
                        f.write(backup_content)
                    print(f"   💾 Backup created: {backup_path}")
                
                # Write new content
                with open(filepath, 'w') as f:
                    f.write(tool_input["content"])
                print(f"   ✅ Written to {filepath}")
                return {"success": True, "message": f"File written to {filepath}"}
            
            elif tool_name == "execute_command":
                result = subprocess.run(
                    tool_input["command"],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                print(f"   ✅ Command executed")
                return {
                    "success": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "returncode": result.returncode
                }
        
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def auto_fix_vite_proxy(self):
        """Automatically fix Vite proxy configuration"""
        print("\n" + "="*60)
        print("🔧 AUTO-FIX: Vite Proxy Configuration")
        print("="*60)
        
        task = """I need to fix the Vite proxy configuration for /api routes.

Current situation:
- Backend API running on port 5000
- Need to add proxy config to vite.config.ts
- The proxy should forward /api requests to http://localhost:5000

Steps to do:
1. Read current vite.config.ts
2. Analyze its structure
3. Add proxy configuration to the server section
4. Write the updated file back
5. Show me the changes made

Be careful to preserve all existing configuration.
"""
        
        self.conversation.append({
            "role": "user",
            "content": task
        })
        
        # Loop untuk handle tool calls
        while True:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system="""You are an expert at fixing configuration files.
When asked to fix something:
1. Read the current file first
2. Analyze what needs to change
3. Make minimal, surgical changes
4. Preserve all existing config
5. Write the updated file

Always explain what you're doing.""",
                tools=self.tools,
                messages=self.conversation
            )
            
            # Add response to conversation
            self.conversation.append({
                "role": "assistant",
                "content": response.content
            })
            
            # Print text responses
            for block in response.content:
                if hasattr(block, "text"):
                    print(f"\n💬 Claude: {block.text}")
            
            # Check if wants to use tools
            if response.stop_reason == "tool_use":
                tool_results = []
                
                for block in response.content:
                    if block.type == "tool_use":
                        # Ask for confirmation for write operations
                        if block.name == "write_file":
                            print("\n⚠️  Claude wants to write to a file.")
                            confirm = input("   Allow this operation? (yes/no): ").strip().lower()
                            if confirm not in ['yes', 'y']:
                                print("   ❌ Operation cancelled by user")
                                return False
                        
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
                
                continue
            else:
                # Done
                break
        
        print("\n✅ Auto-fix process completed!")
        return True

def main():
    assistant = AutoFixAssistant()
    
    print("="*60)
    print("🤖 Auto-Fix Assistant for Crypto API")
    print("="*60)
    print("\nThis assistant can automatically fix common issues.")
    print("You'll be asked for confirmation before files are modified.")
    
    print("\n📋 Available Auto-Fixes:")
    print("1. Fix Vite proxy configuration for /api routes")
    print("2. Exit")
    
    choice = input("\nChoice (1-2): ").strip()
    
    if choice == "1":
        assistant.auto_fix_vite_proxy()
    else:
        print("Goodbye!")

if __name__ == "__main__":
    main()
