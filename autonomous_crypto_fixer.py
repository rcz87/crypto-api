#!/usr/bin/env python3
"""
Autonomous Crypto-API Fixer Agent

This agent will systematically fix all issues with crypto-api project
following the detailed instructions provided by the user.
"""
import anthropic
import os
from dotenv import load_dotenv
import json
import subprocess
import time

load_dotenv()

class CryptoAPIFixer:
    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌ ERROR: ANTHROPIC_API_KEY not set in .env file!")
            print("   Please set your Anthropic API key and try again.")
            exit(1)
        
        print("✅ Claude AI Agent Connected")
        print("   Model: claude-sonnet-4-5-20250929")
        print("   Mode: Autonomous System Repair\n")
        
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-5-20250929"
        
        # Tools that agent can use to interact with system
        self.tools = [
            {
                "name": "execute_command",
                "description": "Execute any shell command on the Linux server",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "The shell command to execute"
                        },
                        "purpose": {
                            "type": "string",
                            "description": "Clear explanation of what this command does and why"
                        }
                    },
                    "required": ["command", "purpose"]
                }
            },
            {
                "name": "read_file",
                "description": "Read contents of a file",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filepath": {
                            "type": "string",
                            "description": "Path to the file to read"
                        }
                    },
                    "required": ["filepath"]
                }
            },
            {
                "name": "write_file",
                "description": "Write content to a file (creates backup automatically)",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filepath": {
                            "type": "string",
                            "description": "Path to the file to write"
                        },
                        "content": {
                            "type": "string",
                            "description": "Content to write to the file"
                        }
                    },
                    "required": ["filepath", "content"]
                }
            }
        ]
    
    def execute_tool(self, tool_name, tool_input):
        """Execute a tool and return its result"""
        
        try:
            if tool_name == "execute_command":
                cmd = tool_input["command"]
                purpose = tool_input.get("purpose", "Executing command")
                
                print(f"\n🔧 {purpose}")
                print(f"   $ {cmd}")
                
                result = subprocess.run(
                    cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30,
                    cwd="/root/crypto-api"
                )
                
                success = result.returncode == 0
                symbol = "✅" if success else "⚠️"
                
                print(f"   {symbol} Exit code: {result.returncode}")
                
                # Show output preview
                if result.stdout:
                    lines = result.stdout.strip().split('\n')
                    preview = '\n'.join(lines[:3])
                    if len(lines) > 3:
                        preview += f"\n   ... ({len(lines)-3} more lines)"
                    print(f"   Output: {preview}")
                
                if result.stderr and not success:
                    print(f"   Error: {result.stderr[:200]}")
                
                return {
                    "success": success,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.returncode
                }
            
            elif tool_name == "read_file":
                filepath = tool_input["filepath"]
                print(f"\n📖 Reading: {filepath}")
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                lines = len(content.split('\n'))
                print(f"   ✅ Read {lines} lines ({len(content)} chars)")
                
                return {
                    "success": True,
                    "content": content,
                    "size": len(content)
                }
            
            elif tool_name == "write_file":
                filepath = tool_input["filepath"]
                content = tool_input["content"]
                
                print(f"\n💾 Writing: {filepath}")
                
                # Create backup if file exists
                if os.path.exists(filepath):
                    backup = f"{filepath}.backup.{int(time.time())}"
                    with open(filepath, 'r') as f:
                        with open(backup, 'w') as b:
                            b.write(f.read())
                    print(f"   💾 Backup: {backup}")
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                print(f"   ✅ Written successfully")
                
                return {
                    "success": True,
                    "filepath": filepath
                }
        
        except subprocess.TimeoutExpired:
            print(f"   ❌ Command timed out after 30 seconds")
            return {"success": False, "error": "Command timeout"}
        
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def run_autonomous_fix(self):
        """Main method that runs the autonomous fixing process"""
        
        print("="*70)
        print("🤖 AUTONOMOUS CRYPTO-API SYSTEM REPAIR")
        print("="*70)
        print()
        print("This AI agent will systematically repair your crypto-api project.")
        print("The agent has full shell access and will work autonomously.")
        print()
        print("What will happen:")
        print("  • Diagnose current system state")
        print("  • Fix Vite configuration issues")
        print("  • Isolate Replit-specific code")
        print("  • Start backend server on port 5000")
        print("  • Configure PM2 for process management")
        print("  • Verify all endpoints working")
        print()
        
        input("Press ENTER to begin autonomous repair... ")
        
        # The detailed task from user
        task = """Kamu adalah AI agent di dalam server Linux (Ubuntu) dengan akses shell.
Tugasmu adalah memperbaiki masalah proyek Node.js "crypto-api" yang awalnya dibuat di Replit dan sekarang dijalankan di VPS biasa.

🎯 OBJECTIVE:
1. Hidupkan kembali backend API (server/index.ts) di port 5000.
2. Atasi crash yang disebabkan oleh file `vite.config.ts` dan plugin Replit seperti @replit/vite-plugin-shadcn-theme-json.
3. Pisahkan environment Replit (frontend/Vite) dari backend agar server bisa berjalan tanpa error.
4. Jalankan backend menggunakan PM2 dengan nama `crypto-api`.

🛑 MASALAH YANG HARUS DISOLUSIKAN:
- Saat menjalankan `npm run dev` atau `pm2 start`, server crash dengan error:
  `SyntaxError: The requested module 'vite' does not provide an export named 'defineConfig'`
- Port 5000 tidak aktif (`curl localhost:5000/gpts/health` gagal).
- File `vite.config.ts` di root menyebabkan backend ikut mencoba load plugin Replit.

✅ TASKS YANG HARUS KAMU EKSEKUSI:

1. Cek apakah proses crypto-api sedang jalan:
   - `pm2 list | grep crypto-api`
   - `ps aux | grep node | grep crypto-api`

2. Stop semua proses crypto-api yang error:
   - `pm2 delete crypto-api || true`

3. Rename atau isolasi file vite.config.ts agar backend tidak load file tersebut:
   - `mv vite.config.ts vite.config.replit.bak || true`

4. Cek file server/vite.ts yang mungkin mengimport vite.config:
   - Read file tersebut
   - Jika ada import vite.config, comment atau disable code path yang load Vite di development

5. Test start backend manual untuk debugging:
   - `tsx server/index.ts` (jangan tunggu lama, ctrl+c setelah 5 detik jika jalan)
   - Atau test dengan: `node --loader tsx server/index.ts`

6. Jika manual test berhasil tanpa error, start dengan PM2:
   - `pm2 start ecosystem.config.cjs --only crypto-api`
   - Atau: `pm2 start server/index.ts --name crypto-api --interpreter tsx`

7. Uji endpoint setelah PM2 start:
   - Wait 3 detik untuk server warm up
   - `curl -s http://localhost:5000/gpts/health`
   - `curl -s http://localhost:5000/gpts/unified/symbols`

8. Jika masih error, analyze PM2 logs:
   - `pm2 logs crypto-api --lines 30 --nostream`
   - Identify masalahnya dan FIX automatically

9. Jika berhasil, save PM2 configuration:
   - `pm2 save`

10. Final verification:
    - `pm2 list` - pastikan status online
    - `curl localhost:5000/gpts/health` - pastikan dapat JSON response

🎯 IMPORTANT GUIDELINES:
- Explain EVERY step you take in Bahasa Indonesia yang jelas
- If something fails, analyze WHY and try alternative approaches
- Don't give up - try multiple solutions until backend is running
- Working directory is /root/crypto-api
- Be thorough and systematic

Begin working NOW and fix this system completely."""

        conversation = [{"role": "user", "content": task}]
        
        # Allow enough iterations for complete fix
        max_iterations = 25
        iteration = 0
        
        print("\n" + "="*70)
        print("🤖 AI AGENT STARTING AUTONOMOUS REPAIR")
        print("="*70)
        
        while iteration < max_iterations:
            iteration += 1
            
            print(f"\n{'='*70}")
            print(f"🔄 Iteration {iteration}/{max_iterations}")
            print('='*70)
            
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=3000,
                    system="""You are an expert DevOps AI agent with full Linux shell access.

CORE PRINCIPLES:
- Execute commands immediately, don't just suggest them
- Analyze results and make decisions autonomously
- If something fails, try alternative approaches automatically
- Work systematically through the repair checklist
- Explain your reasoning clearly in Bahasa Indonesia
- Keep working until the backend is fully operational

You have these tools:
- execute_command: Run any shell command
- read_file: Read file contents
- write_file: Modify files (auto-creates backups)

Work efficiently but thoroughly. Your goal is to get crypto-api backend running on port 5000 with PM2.""",
                    tools=self.tools,
                    messages=conversation
                )
                
                conversation.append({
                    "role": "assistant",
                    "content": response.content
                })
                
                # Display Claude's thinking
                for block in response.content:
                    if hasattr(block, "text") and block.text:
                        # Print explanation
                        print(f"\n💭 Agent Explanation:")
                        # Split into paragraphs for better readability
                        paragraphs = block.text.split('\n\n')
                        for para in paragraphs:
                            if para.strip():
                                print(f"   {para.strip()}")
                        print()
                
                # Handle tool usage
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
                    # Agent finished
                    print("\n" + "="*70)
                    print("✅ AUTONOMOUS REPAIR COMPLETED")
                    print("="*70)
                    break
            
            except anthropic.RateLimitError as e:
                print(f"\n⚠️  Rate limit reached at iteration {iteration}")
                print(f"   {str(e)}")
                print("\n   The agent has made significant progress.")
                print("   Wait a minute and run the script again to continue.")
                break
            
            except Exception as e:
                print(f"\n❌ Unexpected error: {str(e)}")
                print("   The agent will attempt to continue...")
                time.sleep(2)
        
        if iteration >= max_iterations:
            print("\n⚠️  Reached maximum iterations")
            print("   Check the work completed so far and run again if needed")
        
        return True

def main():
    """Main entry point"""
    print("\n" + "="*70)
    print("  🤖 AUTONOMOUS CRYPTO-API REPAIR AGENT")
    print("  Powered by Claude Sonnet 4.5")
    print("="*70 + "\n")
    
    fixer = CryptoAPIFixer()
    fixer.run_autonomous_fix()
    
    # Final status check
    print("\n" + "="*70)
    print("📊 FINAL SYSTEM STATUS CHECK")
    print("="*70)
    
    print("\n🔍 Checking PM2 status...")
    subprocess.run("pm2 list | grep crypto-api", shell=True)
    
    print("\n🔍 Testing endpoint...")
    result = subprocess.run(
        "curl -s http://localhost:5000/gpts/health",
        shell=True,
        capture_output=True,
        text=True
    )
    
    if "success" in result.stdout:
        print("✅ SUCCESS! Backend is responding correctly!")
        print(f"\nResponse preview: {result.stdout[:200]}...")
        print("\n🎉 Your crypto-api backend is now fully operational!")
    else:
        print("⚠️  Backend may need additional work")
        print("   Check: pm2 logs crypto-api")
    
    print("\n")

if __name__ == "__main__":
    main()
