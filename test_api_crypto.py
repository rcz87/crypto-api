#!/usr/bin/env python3
"""
API-Crypto Testing & Information Gathering Agent

This agent will automatically test api-crypto to determine if it's
the solution we should use for heatmap integration.
"""
import anthropic
import os
from dotenv import load_dotenv
import json
import subprocess

load_dotenv()

class ApiCryptoTester:
    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌ ANTHROPIC_API_KEY not set!")
            exit(1)
        
        print("✅ Connected to Claude AI\n")
        
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-5-20250929"
        
        self.tools = [
            {
                "name": "execute_command",
                "description": "Execute shell command and return output",
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
        if tool_name == "execute_command":
            cmd = tool_input["command"]
            purpose = tool_input["purpose"]
            
            print(f"🔍 {purpose}")
            print(f"   Command: {cmd[:70]}{'...' if len(cmd) > 70 else ''}")
            
            try:
                result = subprocess.run(
                    cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                success = result.returncode == 0
                print(f"   {'✅' if success else '⚠️'} Exit code: {result.returncode}")
                
                # Show preview of output
                if result.stdout:
                    preview = result.stdout[:150]
                    print(f"   Output: {preview}{'...' if len(result.stdout) > 150 else ''}")
                
                return {
                    "success": success,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.returncode
                }
            except Exception as e:
                print(f"   ❌ Error: {e}")
                return {"success": False, "error": str(e)}
    
    def test_api_crypto(self):
        print("="*70)
        print("🔬 API-CRYPTO TESTING & ANALYSIS")
        print("="*70)
        print("\nThis agent will test api-crypto to see if it's our solution.")
        print("Testing will be fast and focused.\n")
        
        input("Press ENTER to start testing... ")
        
        # Single focused task to minimize API calls
        task = """You are testing the api-crypto PM2 process to determine if it can be used for heatmap integration.

EXECUTE THESE TESTS IN SEQUENCE:

1. Get detailed info about api-crypto process:
   pm2 describe api-crypto | grep -E "script|cwd|status|uptime|restarts" -A 1

2. Test GPT health endpoint:
   curl -s http://localhost:5000/gpts/health

3. Test if heatmap endpoints exist (try multiple patterns):
   curl -s http://localhost:5000/api/liquidations/BTC/heatmap
   curl -s http://localhost:5000/liquidations/BTC/heatmap  
   curl -s http://localhost:5000/gpts/heatmap/status

4. Check what port api-crypto is actually listening on:
   lsof -i -P -n | grep LISTEN | grep node | grep 5000

After running all tests, analyze the results and tell me:
- Is api-crypto serving GPT endpoints successfully?
- Where is api-crypto running from (directory)?
- Does heatmap functionality already exist in api-crypto?
- Should we use api-crypto instead of trying to fix crypto-api?

Work efficiently - execute all commands and provide clear analysis."""

        conversation = [{"role": "user", "content": task}]
        
        # Allow up to 10 iterations for this testing
        for iteration in range(10):
            print(f"\n{'='*70}")
            print(f"Testing Step {iteration + 1}")
            print('='*70)
            
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                system="You are a system tester. Execute commands efficiently and analyze results clearly. Work fast.",
                tools=self.tools,
                messages=conversation
            )
            
            conversation.append({
                "role": "assistant",
                "content": response.content
            })
            
            # Show Claude's analysis
            for block in response.content:
                if hasattr(block, "text") and block.text:
                    print(f"\n💭 Analysis:")
                    print(f"   {block.text[:400]}{'...' if len(block.text) > 400 else ''}\n")
            
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
                # Claude finished analysis
                print("\n" + "="*70)
                print("✅ TESTING COMPLETE")
                print("="*70)
                break
        
        return True

def main():
    print("\n" + "="*70)
    print("  API-CRYPTO AUTONOMOUS TESTER")
    print("  Fast, focused, efficient")
    print("="*70 + "\n")
    
    tester = ApiCryptoTester()
    tester.test_api_crypto()
    
    print("\n📊 Testing complete. Review the analysis above to determine next steps.")
    print("\n")

if __name__ == "__main__":
    main()
