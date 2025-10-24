"""Tools yang bisa digunakan Coding Agent"""
import subprocess
import os

def execute_python(code: str) -> dict:
    """Execute Python code dan return hasil"""
    try:
        # Buat temporary file
        with open('/tmp/temp_code.py', 'w') as f:
            f.write(code)
        
        # Execute
        result = subprocess.run(
            ['python3', '/tmp/temp_code.py'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        return {
            'success': result.returncode == 0,
            'output': result.stdout,
            'error': result.stderr
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'output': '',
            'error': 'Timeout: Code execution took too long'
        }
    except Exception as e:
        return {
            'success': False,
            'output': '',
            'error': str(e)
        }

def read_file(filepath: str) -> dict:
    """Read file content"""
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        return {
            'success': True,
            'content': content
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def write_file(filepath: str, content: str) -> dict:
    """Write content to file"""
    try:
        # Buat directory jika belum ada
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'w') as f:
            f.write(content)
        return {
            'success': True,
            'message': f'File written to {filepath}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def list_files(directory: str = '.') -> dict:
    """List files in directory"""
    try:
        files = []
        for root, dirs, filenames in os.walk(directory):
            for filename in filenames:
                if not filename.startswith('.'):
                    files.append(os.path.join(root, filename))
        return {
            'success': True,
            'files': files[:50]  # Limit 50 files
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

# Define tools schema untuk Claude
TOOLS = [
    {
        "name": "execute_python",
        "description": "Execute Python code and return the output. Use this to test code, run scripts, or verify functionality.",
        "input_schema": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "The Python code to execute"
                }
            },
            "required": ["code"]
        }
    },
    {
        "name": "read_file",
        "description": "Read the contents of a file",
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
        "description": "Write content to a file. Creates directories if needed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filepath": {
                    "type": "string",
                    "description": "Path where to write the file"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write to the file"
                }
            },
            "required": ["filepath", "content"]
        }
    },
    {
        "name": "list_files",
        "description": "List all files in a directory",
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {
                    "type": "string",
                    "description": "Directory path to list files from",
                    "default": "."
                }
            }
        }
    }
]

# Tool executor
def execute_tool(tool_name: str, tool_input: dict) -> dict:
    """Execute tool berdasarkan nama"""
    if tool_name == "execute_python":
        return execute_python(tool_input["code"])
    elif tool_name == "read_file":
        return read_file(tool_input["filepath"])
    elif tool_name == "write_file":
        return write_file(tool_input["filepath"], tool_input["content"])
    elif tool_name == "list_files":
        directory = tool_input.get("directory", ".")
        return list_files(directory)
    else:
        return {"success": False, "error": f"Unknown tool: {tool_name}"}
