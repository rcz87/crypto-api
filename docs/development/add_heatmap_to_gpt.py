#!/usr/bin/env python3
"""
Autonomous Heatmap to GPT Integration Builder

This script will automatically add heatmap endpoints to your GPT Actions routes
so that your Custom GPT can access heatmap data.
"""
import anthropic
import os
from dotenv import load_dotenv
import json
import subprocess

load_dotenv()

class HeatmapGPTIntegrator:
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
                "description": "Write to file with backup",
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
                        "purpose": {"type": "string"}
                    },
                    "required": ["command"]
                }
            }
        ]
    
    def execute_tool(self, tool_name, tool_input):
        print(f"\n🔧 {tool_name}: {tool_input.get('purpose', tool_input.get('filepath', tool_input.get('command', '')))[:80]}")
        
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
                    print(f"   💾 Backup: {filepath}.backup")
                
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
                print(f"   ✅ Exit code: {result.returncode}")
                return {
                    "success": result.returncode == 0,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
        
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return {"success": False, "error": str(e)}
    
    def integrate_heatmap(self):
        print("="*70)
        print("🔥 AUTONOMOUS HEATMAP → GPT INTEGRATION")
        print("="*70)
        print("\nI will automatically:")
        print("  ✓ Read existing heatmap endpoints")
        print("  ✓ Read GPT routes pattern")
        print("  ✓ Create wrapper endpoints at /gpts/heatmap/*")
        print("  ✓ Add to gpts.ts file")
        print("  ✓ Test the new endpoints")
        print("\nNo manual work needed!\n")
        
        input("Press ENTER to start integration... ")
        
        task = """You are integrating heatmap functionality into GPT Actions routes.

YOUR MISSION:

1. READ server/routes/heatmap.ts to understand:
   - What endpoints exist
   - What parameters they take
   - What they return
   - Any authentication requirements

2. READ server/routes/gpts.ts to understand:
   - Pattern used for GPT endpoints
   - Response format conventions
   - Error handling approach
   - How other features are exposed

3. DESIGN new GPT heatmap endpoints:
   - Use path /gpts/heatmap/* for all heatmap endpoints
   - Create wrappers that call existing heatmap logic
   - Follow same patterns as other gpts endpoints
   - Ensure proper error handling

4. MODIFY server/routes/gpts.ts:
   - Add new heatmap endpoints
   - Place them in logical location (near other endpoints)
   - Maintain code style consistency
   - Add helpful comments

5. UPDATE health endpoint to include new heatmap routes

6. TEST new endpoints with curl

Key endpoints to expose:
- Liquidation heatmap data
- Liquidity data  
- Market metrics related to heatmap

Make these accessible for GPT Actions so Custom GPT can display heatmap data to users.

Be surgical - preserve all existing code in gpts.ts."""

        self.conversation.append({"role": "user", "content": task})
        
        iteration = 0
        max_iterations = 20
        
        while iteration < max_iterations:
            iteration += 1
            print(f"\n--- Step {iteration} ---")
            
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system="""You are an autonomous integration engineer.

CORE PRINCIPLES:
- Read before modifying
- Preserve existing code
- Follow established patterns
- Test your changes
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
                    text = block.text[:400]
                    print(f"\n💭 Claude: {text}{'...' if len(block.text) > 400 else ''}")
            
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
                print("✅ HEATMAP INTEGRATION COMPLETED!")
                print("="*70)
                break
        
        return True

def main():
    integrator = HeatmapGPTIntegrator()
    integrator.integrate_heatmap()
    
    print("\n📋 NEXT STEPS:")
    print("1. Backend will auto-reload with new routes")
    print("2. Test: curl http://localhost:5000/gpts/heatmap/...")
    print("3. Check: curl http://localhost:5000/gpts/health")
    print("4. Update your GPT Actions OpenAPI spec if needed")
    print("\nYour Custom GPT can now access heatmap data! 🔥\n")

if __name__ == "__main__":
    main()
