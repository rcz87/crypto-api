"""Coding Assistant Agent dengan Claude API"""
import anthropic
import os
from dotenv import load_dotenv
from tools import TOOLS, execute_tool
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

load_dotenv()

console = Console()

class CodingAgent:
    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY")
        )
        self.model = "claude-sonnet-4-5-20250929"
        self.conversation = []
        
    def _print_tool_use(self, tool_name, tool_input):
        """Print info ketika agent pakai tool"""
        console.print(f"\n🔧 [cyan]Using tool:[/cyan] [yellow]{tool_name}[/yellow]")
        console.print(f"   Input: {tool_input}")
        
    def _print_tool_result(self, result):
        """Print hasil tool execution"""
        if result.get('success'):
            console.print(f"   ✅ [green]Success[/green]")
        else:
            console.print(f"   ❌ [red]Error: {result.get('error')}[/red]")
    
    def chat(self, user_message: str, system_prompt: str = None) -> str:
        """Send message ke Claude dan handle tool calls"""
        
        # Default system prompt untuk coding
        if system_prompt is None:
            system_prompt = """You are an expert coding assistant.

Your capabilities:
- Write production-ready code with proper error handling
- Debug and fix code issues
- Explain code clearly
- Test code using execute_python tool
- Read and write files
- Refactor and optimize code

Always:
1. Test your code using execute_python before presenting it
2. Include comments and documentation
3. Handle errors properly
4. Follow best practices
5. Be concise but thorough

When asked to create files, use write_file tool.
When asked to read existing code, use read_file tool first."""

        # Add user message ke conversation
        self.conversation.append({
            "role": "user",
            "content": user_message
        })
        
        # Loop untuk handle multiple tool calls
        while True:
            # Send request ke Claude
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                tools=TOOLS,
                messages=self.conversation
            )
            
            # Add assistant response ke conversation
            self.conversation.append({
                "role": "assistant",
                "content": response.content
            })
            
            # Check if Claude wants to use tools
            if response.stop_reason == "tool_use":
                # Execute semua tool yang dipanggil
                tool_results = []
                
                for block in response.content:
                    if block.type == "tool_use":
                        # Print tool usage
                        self._print_tool_use(block.name, block.input)
                        
                        # Execute tool
                        result = execute_tool(block.name, block.input)
                        self._print_tool_result(result)
                        
                        # Prepare tool result untuk Claude
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": str(result)
                        })
                
                # Add tool results ke conversation
                self.conversation.append({
                    "role": "user",
                    "content": tool_results
                })
                
                # Continue loop untuk get final response
                continue
            
            else:
                # No more tool calls, return final text response
                final_text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        final_text += block.text
                
                return final_text
    
    def reset_conversation(self):
        """Reset conversation history"""
        self.conversation = []
        console.print("\n[yellow]Conversation reset![/yellow]\n")
