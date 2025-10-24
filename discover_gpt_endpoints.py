#!/usr/bin/env python3
"""
Autonomous GPT Endpoint Discovery Agent

This agent will automatically discover, analyze, and test all API endpoints
in your crypto-api system, with special focus on endpoints designed for GPT Actions.

The agent will:
- Scan your entire codebase for endpoint definitions
- Identify which endpoints are GPT-compatible
- Test all endpoints to verify they're working
- Generate a comprehensive report with findings
"""
import anthropic
import os
from dotenv import load_dotenv
import json
import subprocess

load_dotenv()

class EndpointDiscoveryAgent:
    def __init__(self):
        """
        Initialize the discovery agent with Claude API credentials and tools.
        
        This constructor sets up everything needed for the agent to operate
        autonomously, including the Claude API client and tool definitions.
        """
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌ Error: ANTHROPIC_API_KEY environment variable not set!")
            print("   Please ensure your .env file contains the API key.")
            exit(1)
        
        print("✅ Claude API connected successfully\n")
        
        # Initialize Claude client with API key
        self.client = anthropic.Anthropic(api_key=api_key)
        
        # Use the most capable model for thorough analysis
        self.model = "claude-sonnet-4-5-20250929"
        
        # Conversation history for maintaining context across tool calls
        self.conversation = []
        
        # Define tools that the agent can use to interact with your system
        # Each tool gives the agent a specific capability
        self.tools = [
            {
                "name": "read_file",
                "description": "Read the complete content of a file. Use this to examine code files for endpoint definitions.",
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
                "name": "execute_shell_command",
                "description": "Execute any shell command to interact with the system. Use this for finding files, testing endpoints, checking processes, etc.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "The shell command to execute"
                        },
                        "purpose": {
                            "type": "string",
                            "description": "Human-readable explanation of what this command does and why"
                        }
                    },
                    "required": ["command", "purpose"]
                }
            },
            {
                "name": "write_report",
                "description": "Write the final discovery report to a file. Use this when analysis is complete.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filename": {
                            "type": "string",
                            "description": "Name of the report file"
                        },
                        "content": {
                            "type": "string",
                            "description": "Complete report content in markdown format"
                        }
                    },
                    "required": ["filename", "content"]
                }
            }
        ]
    
    def execute_tool(self, tool_name: str, tool_input: dict) -> dict:
        """
        Execute a tool and return its result.
        
        This method is the bridge between Claude's tool use requests and actual
        system operations. It handles different tool types and provides consistent
        error handling.
        
        Args:
            tool_name: Name of the tool to execute
            tool_input: Parameters for the tool
            
        Returns:
            Dictionary containing success status and tool output
        """
        # Display what we're doing for transparency
        print(f"\n🔧 Executing: {tool_name}")
        
        if tool_name == "execute_shell_command":
            print(f"   Purpose: {tool_input.get('purpose', 'No description')}")
            print(f"   Command: {tool_input['command'][:80]}{'...' if len(tool_input['command']) > 80 else ''}")
        elif tool_name == "read_file":
            print(f"   Reading: {tool_input['filepath']}")
        elif tool_name == "write_report":
            print(f"   Writing report: {tool_input['filename']}")
        
        try:
            if tool_name == "read_file":
                # Read file and return its content
                with open(tool_input["filepath"], 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Show user what we read
                lines = len(content.split('\n'))
                print(f"   ✅ Read {lines} lines ({len(content)} characters)")
                
                return {
                    "success": True,
                    "content": content,
                    "lines": lines
                }
            
            elif tool_name == "execute_shell_command":
                # Execute the shell command with timeout for safety
                result = subprocess.run(
                    tool_input["command"],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30  # Prevent hanging on long operations
                )
                
                # Determine if command was successful
                success = result.returncode == 0
                status_symbol = "✅" if success else "⚠️"
                
                print(f"   {status_symbol} Exit code: {result.returncode}")
                
                # Show preview of output if not too long
                if result.stdout and len(result.stdout) < 200:
                    print(f"   Output preview: {result.stdout[:150]}")
                elif result.stdout:
                    lines = len(result.stdout.split('\n'))
                    print(f"   Output: {lines} lines")
                
                return {
                    "success": success,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.returncode
                }
            
            elif tool_name == "write_report":
                # Write the discovery report to file
                filename = tool_input["filename"]
                content = tool_input["content"]
                
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                print(f"   ✅ Report written successfully")
                print(f"   File location: {os.path.abspath(filename)}")
                
                return {
                    "success": True,
                    "filepath": os.path.abspath(filename)
                }
        
        except subprocess.TimeoutExpired:
            print(f"   ❌ Command timed out after 30 seconds")
            return {
                "success": False,
                "error": "Command execution timed out"
            }
        
        except FileNotFoundError as e:
            print(f"   ❌ File not found: {e}")
            return {
                "success": False,
                "error": f"File not found: {str(e)}"
            }
        
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def discover_endpoints(self):
        """
        Main method that orchestrates the endpoint discovery process.
        
        This method creates a comprehensive task for Claude and then manages
        the iterative process as Claude uses various tools to discover and
        analyze endpoints in your system.
        """
        print("=" * 70)
        print("🔍 AUTONOMOUS ENDPOINT DISCOVERY AGENT")
        print("=" * 70)
        print("\nThis agent will comprehensively analyze your crypto-api system to:")
        print("  • Discover all API endpoints in your codebase")
        print("  • Identify which endpoints are designed for GPT Actions")
        print("  • Test endpoints to verify they're functioning correctly")
        print("  • Analyze authentication and CORS configurations")
        print("  • Generate a detailed report with findings and recommendations")
        print("\nThe process is completely autonomous - just watch as Claude works!\n")
        
        input("Press ENTER to begin endpoint discovery... ")
        
        # Create comprehensive task for Claude to execute
        task = """You are an expert systems analyst conducting a thorough audit of a crypto-api project.

YOUR MISSION: Discover and document ALL API endpoints, especially those designed for GPT Actions.

EXECUTE THESE STEPS AUTONOMOUSLY:

1. SCAN PROJECT STRUCTURE
   - Find all TypeScript/JavaScript files in server/ directory
   - List routing files and their paths
   - Identify main server entry point

2. ANALYZE EACH ROUTING FILE
   - Read content of all potential route definition files
   - Extract endpoint definitions (app.get, router.get, app.post, etc.)
   - Note HTTP methods, paths, and handler names
   - Identify middleware (authentication, CORS, etc.)

3. IDENTIFY GPT-SPECIFIC ENDPOINTS
   Look for indicators:
   - Routes under /api/gpt/ or similar
   - API key authentication middleware
   - CORS configuration for OpenAI domains
   - Structured JSON responses
   - Comments mentioning GPT/OpenAI/Actions

4. DETERMINE BACKEND SERVER PORT
   - Check server/index.ts for PORT configuration
   - Verify which port is actually in use
   - Determine if server is currently running

5. TEST DISCOVERED ENDPOINTS
   - For each endpoint, execute curl to test it
   - Check if authentication is required
   - Verify response format (JSON vs HTML)
   - Document which endpoints return proper data

6. ANALYZE OPENAPI SPECIFICATIONS
   - Look for existing OpenAPI/Swagger specs
   - Check if they match actual implementations

7. GENERATE COMPREHENSIVE REPORT
   Create markdown report with:
   - Executive summary
   - Complete list of ALL discovered endpoints
   - Categorization (GPT-specific vs general API)
   - Status of each endpoint (working/broken/untested)
   - Authentication requirements
   - Recommendations for improvements
   - Ready-to-use curl examples for each endpoint

Use execute_shell_command tool extensively for finding files, testing endpoints, etc.
Use read_file to examine code.
Use write_report when analysis is complete.

Be thorough - your goal is to give the user complete visibility into their API."""

        # Add task to conversation history
        self.conversation.append({
            "role": "user",
            "content": task
        })
        
        # Iterative loop where Claude uses tools to complete the mission
        iteration = 0
        max_iterations = 30  # Allow enough iterations for thorough analysis
        
        print("\n" + "=" * 70)
        print("🤖 Claude is now analyzing your system autonomously...")
        print("=" * 70)
        
        while iteration < max_iterations:
            iteration += 1
            print(f"\n--- Iteration {iteration} ---")
            
            # Request Claude to take next action
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system="""You are an autonomous systems analyst.

CORE PRINCIPLES:
- Use tools extensively - never ask human to run commands
- Be thorough and systematic in your analysis
- Test everything you discover
- Document findings clearly
- Provide actionable insights

IMPORTANT:
- Use execute_shell_command for ANY system interaction
- Use read_file to examine code
- When done, use write_report to save findings""",
                tools=self.tools,
                messages=self.conversation
            )
            
            # Add Claude's response to conversation history
            self.conversation.append({
                "role": "assistant",
                "content": response.content
            })
            
            # Display Claude's thinking and explanations
            for block in response.content:
                if hasattr(block, "text"):
                    text = block.text
                    # Show summary if text is long
                    if len(text) > 300:
                        print(f"\n💭 Claude: {text[:300]}...\n   [Summary of longer message]")
                    else:
                        print(f"\n💭 Claude: {text}")
            
            # Check if Claude wants to use tools
            if response.stop_reason == "tool_use":
                tool_results = []
                
                # Execute all tool requests from this turn
                for block in response.content:
                    if block.type == "tool_use":
                        # Execute the tool
                        result = self.execute_tool(block.name, block.input)
                        
                        # Package result for Claude
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result)
                        })
                
                # Send tool results back to Claude
                self.conversation.append({
                    "role": "user",
                    "content": tool_results
                })
                
                # Continue to next iteration
                continue
            
            else:
                # Claude is done - no more tool use
                print("\n" + "=" * 70)
                print("✅ ENDPOINT DISCOVERY COMPLETED!")
                print("=" * 70)
                break
        
        if iteration >= max_iterations:
            print("\n⚠️  Reached maximum iterations. Analysis may be incomplete.")
            print("    Consider running again with more iterations if needed.")
        
        return True

def main():
    """
    Main entry point for the endpoint discovery agent.
    """
    print("\n" + "=" * 70)
    print("  CRYPTO-API ENDPOINT DISCOVERY AGENT")
    print("  Powered by Claude AI")
    print("=" * 70 + "\n")
    
    # Create and run the agent
    agent = EndpointDiscoveryAgent()
    agent.discover_endpoints()
    
    print("\n📋 WHAT TO DO NEXT:")
    print("   1. Review the generated report (endpoint-discovery-report.md)")
    print("   2. Check which endpoints are GPT-compatible")
    print("   3. Test any endpoints that weren't automatically tested")
    print("   4. Update your GPT Actions configuration if needed")
    print("\n")

if __name__ == "__main__":
    main()
