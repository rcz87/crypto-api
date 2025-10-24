#!/usr/bin/env python3
"""Interactive Coding Assistant"""
from coding_agent import CodingAgent, console, Markdown, Panel
from rich.prompt import Prompt

def print_welcome():
    welcome = """
# 🤖 Claude Coding Assistant

Saya bisa membantu:
- ✍️  Generate code (Python, JavaScript, dll)
- 🐛 Debug & fix bugs
- 📝 Explain code
- 🔄 Refactor code
- 📂 Read/Write files
- ✅ Test code otomatis

**Commands:**
- `exit` atau `quit` - Keluar
- `reset` - Reset conversation
- `help` - Show help
"""
    console.print(Panel(Markdown(welcome), title="Welcome", border_style="cyan"))

def main():
    agent = CodingAgent()
    print_welcome()
    
    while True:
        try:
            # Get user input
            user_input = Prompt.ask("\n[bold green]You[/bold green]").strip()
            
            # Handle commands
            if user_input.lower() in ['exit', 'quit', 'bye']:
                console.print("\n[cyan]👋 Goodbye![/cyan]\n")
                break
            
            if user_input.lower() == 'reset':
                agent.reset_conversation()
                continue
            
            if user_input.lower() == 'help':
                print_welcome()
                continue
            
            if not user_input:
                continue
            
            # Send to agent
            console.print("\n[bold cyan]🤖 Claude:[/bold cyan]")
            response = agent.chat(user_input)
            
            # Print response as markdown
            console.print(Markdown(response))
            
        except KeyboardInterrupt:
            console.print("\n[yellow]Use 'exit' to quit[/yellow]")
        except Exception as e:
            console.print(f"\n[red]Error: {e}[/red]")

if __name__ == "__main__":
    main()
