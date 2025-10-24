#!/usr/bin/env python3
"""
Autonomous GPT Actions Endpoint Builder

This script will AUTOMATICALLY:
1. Create endpoint files for crypto data
2. Integrate endpoints into your server
3. Setup API key authentication
4. Generate OpenAPI specification
5. Test all endpoints
6. Give you ready-to-use GPT Actions configuration

NO manual file editing needed!
"""
import anthropic
import os
from dotenv import load_dotenv
import json
import subprocess

load_dotenv()

class GPTActionsBuilder:
    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌ ANTHROPIC_API_KEY not set!")
            exit(1)
        
        print("✅ API Key loaded\n")
        
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-5-20250929"
        self.conversation = []
        
        self.tools = [
            {
                "name": "read_file",
                "description": "Read a file",
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
                "description": "Write content to file with backup",
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
                        "command": {"type": "string"},
                        "description": {"type": "string"}
                    },
                    "required": ["command"]
                }
            }
        ]
    
    def execute_tool(self, tool_name, tool_input):
        print(f"\n🔧 {tool_name}: {tool_input.get('description', tool_input.get('filepath', tool_input.get('command', '')))}")
        
        try:
            if tool_name == "read_file":
                with open(tool_input["filepath"], 'r') as f:
                    content = f.read()
                print(f"   ✅ Read {len(content)} chars")
                return {"success": True, "content": content}
            
            elif tool_name == "write_file":
                filepath = tool_input["filepath"]
                if os.path.exists(filepath):
                    with open(filepath, 'r') as f:
                        backup = f.read()
                    with open(f"{filepath}.backup", 'w') as f:
                        f.write(backup)
                    print(f"   💾 Backup created")
                
                with open(filepath, 'w') as f:
                    f.write(tool_input["content"])
                print(f"   ✅ Written successfully")
                return {"success": True}
            
            elif tool_name == "execute_command":
                result = subprocess.run(
                    tool_input["command"],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                print(f"   ✅ Executed")
                return {
                    "success": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
        
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return {"success": False, "error": str(e)}
    
    def build_gpt_actions(self):
        print("="*70)
        print("🤖 AUTONOMOUS GPT ACTIONS ENDPOINT BUILDER")
        print("="*70)
        print("\nI will automatically create everything you need:")
        print("  ✓ Crypto data API endpoints")
        print("  ✓ CORS configuration for OpenAI")
        print("  ✓ API key authentication")
        print("  ✓ Integration with your server")
        print("  ✓ OpenAPI specification for GPT Actions")
        print("  ✓ Test all endpoints")
        print("\nJust watch - no manual work needed!\n")
        
        input("Press ENTER to start... ")
        
        task = """You are building GPT Actions integration for a crypto API.

YOUR MISSION - Complete these tasks AUTONOMOUSLY:

1. CREATE server/gpt-actions.ts with these endpoints:
   - GET /api/gpt/crypto/prices (return multiple crypto prices)
   - GET /api/gpt/crypto/info/:symbol (detailed info for one crypto)
   - GET /api/gpt/health (health check)
   
   Requirements:
   - Include CORS for OpenAI domains (chat.openai.com, chatgpt.com)
   - API key authentication via X-API-Key header
   - Proper TypeScript types
   - Structured JSON responses with success/error format
   - Error handling for all endpoints

2. READ server/index.ts to understand structure

3. MODIFY server/index.ts to:
   - Import the new GPT actions router
   - Register route at /api/gpt
   - Place BEFORE any catch-all routes

4. GENERATE gpt-actions-openapi.json with:
   - Complete OpenAPI 3.1 spec
   - All endpoints documented
   - API key security scheme
   - Example responses
   - Server URL: http://localhost:5000/api/gpt

5. GENERATE API key using: openssl rand -hex 32

6. CREATE/UPDATE .env file with GPT_ACTIONS_API_KEY

7. TEST endpoints with curl using the generated API key

Be surgical in edits - preserve all existing code.
Explain each step briefly.
Execute everything automatically."""

        self.conversation.append({"role": "user", "content": task})
        
        iteration = 0
        max_iterations = 25
        
        while iteration < max_iterations:
            iteration += 1
            print(f"\n--- Step {iteration} ---")
            
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system="""You are an autonomous coding agent.

KEY RULES:
- Use tools to do ALL work - never ask human to do anything
- Make surgical edits that preserve existing code
- Test your work
- Explain briefly what you're doing""",
                tools=self.tools,
                messages=self.conversation
            )
            
            self.conversation.append({
                "role": "assistant",
                "content": response.content
            })
            
            for block in response.content:
                if hasattr(block, "text"):
                    print(f"\n💬 {block.text[:500]}{'...' if len(block.text) > 500 else ''}")
            
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
                print("✅ GPT ACTIONS ENDPOINTS BUILT SUCCESSFULLY!")
                print("="*70)
                break
        
        return True

def main():
    builder = GPTActionsBuilder()
    builder.build_gpt_actions()
    
    print("\n📋 NEXT STEPS:")
    print("1. Restart your backend server (it will auto-load new endpoints)")
    print("2. Check gpt-actions-openapi.json file")
    print("3. Import that OpenAPI spec into your Custom GPT")
    print("4. Configure API key authentication in GPT Actions")
    print("5. Your Custom GPT can now access your crypto data!\n")

if __name__ == "__main__":
    main()
