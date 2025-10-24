#!/usr/bin/env python3
"""
🔥 WISANG GENI (Api yang Membara)
================================

AI Engineer Agent yang bisa:
- Belajar dan mengingat pengetahuan baru
- Menambah skill tanpa coding ulang
- Self-improve dan evolve
- Membaca skill modules dari file external

Dibuat dengan ❤️ untuk autonomous development
"""

import anthropic
import os
from dotenv import load_dotenv
import json
import subprocess
import time
import yaml
from datetime import datetime
from pathlib import Path

load_dotenv()

class WisangGeni:
    """
    🔥 Wisang Geni - The Blazing Intelligence
    
    AI Engineer yang bisa belajar dan berkembang
    """
    
    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌ ANTHROPIC_API_KEY tidak ditemukan!")
            exit(1)
        
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-5-20250929"
        
        # Paths untuk knowledge dan skills
        self.knowledge_dir = Path("/root/crypto-api/.wisang_geni")
        self.knowledge_file = self.knowledge_dir / "knowledge_base.json"
        self.skills_dir = self.knowledge_dir / "skills"
        
        # Buat directories jika belum ada
        self.knowledge_dir.mkdir(exist_ok=True)
        self.skills_dir.mkdir(exist_ok=True)
        
        # Load knowledge dan skills
        self.knowledge = self.load_knowledge()
        self.skills = self.load_skills()
        
        # Conversation history
        self.conversation = []
        
        # Display initialization
        self.display_banner()
        
        # Core tools
        self.tools = self.build_tools()
    
    def display_banner(self):
        """Display welcome banner"""
        print("="*70)
        print("🔥 WISANG GENI - Api yang Membara")
        print("   The Blazing Intelligence")
        print("="*70)
        print()
        print("✅ Claude Sonnet 4.5 - Connected")
        print(f"✅ Knowledge Base - {len(self.knowledge.get('facts', []))} facts loaded")
        print(f"✅ Skills Loaded - {len(self.skills)} custom skills")
        print("✅ Autonomous Mode - Active")
        print("✅ Learning System - Enabled")
        print()
    
    def load_knowledge(self):
        """Load persistent knowledge base"""
        if self.knowledge_file.exists():
            try:
                with open(self.knowledge_file, 'r') as f:
                    knowledge = json.load(f)
                print(f"📚 Knowledge base dimuat: {self.knowledge_file}")
                return knowledge
            except:
                pass
        
        # Default knowledge structure
        return {
            "facts": [],
            "patterns": {},
            "preferences": {},
            "history": [],
            "discoveries": [],
            "fixes_applied": [],
            "optimizations": []
        }
    
    def save_knowledge(self):
        """Save knowledge to persistent storage"""
        try:
            with open(self.knowledge_file, 'w') as f:
                json.dump(self.knowledge, f, indent=2)
            return True
        except Exception as e:
            print(f"⚠️ Gagal menyimpan knowledge: {e}")
            return False
    
    def load_skills(self):
        """Load skill modules from external files"""
        skills = {}
        
        # Load all YAML and JSON skill files
        for skill_file in self.skills_dir.glob("*.yaml"):
            try:
                with open(skill_file, 'r') as f:
                    skill_data = yaml.safe_load(f)
                    skills[skill_data['name']] = skill_data
            except Exception as e:
                print(f"⚠️ Error loading {skill_file}: {e}")
        
        for skill_file in self.skills_dir.glob("*.json"):
            try:
                with open(skill_file, 'r') as f:
                    skill_data = json.load(f)
                    skills[skill_data['name']] = skill_data
            except Exception as e:
                print(f"⚠️ Error loading {skill_file}: {e}")
        
        if skills:
            print(f"💪 Loaded custom skills: {', '.join(skills.keys())}")
        
        return skills
    
    def build_tools(self):
        """Build tool definitions including custom skills"""
        
        # Core tools
        tools = [
            {
                "name": "execute_command",
                "description": "Execute shell command dengan full access",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string"},
                        "purpose": {"type": "string"}
                    },
                    "required": ["command", "purpose"]
                }
            },
            {
                "name": "read_file",
                "description": "Baca dan analyze file",
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
                "description": "Tulis atau modifikasi file dengan backup otomatis",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filepath": {"type": "string"},
                        "content": {"type": "string"},
                        "reason": {"type": "string"}
                    },
                    "required": ["filepath", "content", "reason"]
                }
            },
            {
                "name": "learn",
                "description": "Simpan pengetahuan baru ke knowledge base",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "enum": ["fact", "pattern", "preference", "discovery", "fix", "optimization"]
                        },
                        "data": {"type": "object"}
                    },
                    "required": ["category", "data"]
                }
            },
            {
                "name": "recall",
                "description": "Ambil pengetahuan dari knowledge base",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "category": {"type": "string"},
                        "query": {"type": "string"}
                    },
                    "required": ["category"]
                }
            },
            {
                "name": "add_skill",
                "description": "Tambah skill baru ke Wisang Geni",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "skill_name": {"type": "string"},
                        "skill_description": {"type": "string"},
                        "skill_commands": {"type": "array"}
                    },
                    "required": ["skill_name", "skill_description"]
                }
            }
        ]
        
        # Add custom skills as tools
        for skill_name, skill_data in self.skills.items():
            tools.append({
                "name": f"skill_{skill_name}",
                "description": skill_data.get('description', f"Execute {skill_name} skill"),
                "input_schema": skill_data.get('input_schema', {
                    "type": "object",
                    "properties": {}
                })
            })
        
        return tools
    
    def execute_tool(self, tool_name, tool_input):
        """Execute tools dengan enhanced capabilities"""
        
        try:
            # Core tools
            if tool_name == "execute_command":
                return self._execute_command(tool_input)
            
            elif tool_name == "read_file":
                return self._read_file(tool_input)
            
            elif tool_name == "write_file":
                return self._write_file(tool_input)
            
            elif tool_name == "learn":
                return self._learn(tool_input)
            
            elif tool_name == "recall":
                return self._recall(tool_input)
            
            elif tool_name == "add_skill":
                return self._add_skill(tool_input)
            
            # Custom skills
            elif tool_name.startswith("skill_"):
                skill_name = tool_name.replace("skill_", "")
                return self._execute_skill(skill_name, tool_input)
            
            else:
                return {"success": False, "error": f"Unknown tool: {tool_name}"}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _execute_command(self, tool_input):
        """Execute shell command"""
        cmd = tool_input["command"]
        purpose = tool_input.get("purpose", "Executing command")
        
        print(f"\n  🔧 {purpose}")
        print(f"     $ {cmd[:80]}")
        
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=60,
            cwd="/root/crypto-api"
        )
        
        success = result.returncode == 0
        print(f"     {'✅' if success else '⚠️'} Exit: {result.returncode}")
        
        return {
            "success": success,
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    
    def _read_file(self, tool_input):
        """Read file"""
        filepath = tool_input["filepath"]
        print(f"\n  📖 Reading: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        print(f"     ✅ Read {len(content)} bytes")
        
        return {
            "success": True,
            "content": content,
            "filepath": filepath
        }
    
    def _write_file(self, tool_input):
        """Write file dengan backup"""
        filepath = tool_input["filepath"]
        content = tool_input["content"]
        reason = tool_input.get("reason", "File modification")
        
        print(f"\n  💾 Writing: {filepath}")
        print(f"     Reason: {reason}")
        
        # Backup
        if os.path.exists(filepath):
            backup = f"{filepath}.backup.{int(time.time())}"
            with open(filepath, 'r') as f:
                with open(backup, 'w') as b:
                    b.write(f.read())
            print(f"     💾 Backup: {backup}")
        
        # Write
        with open(filepath, 'w') as f:
            f.write(content)
        
        print(f"     ✅ Updated")
        
        # Record fix
        self.knowledge['fixes_applied'].append({
            "timestamp": datetime.now().isoformat(),
            "file": filepath,
            "reason": reason
        })
        self.save_knowledge()
        
        return {"success": True, "filepath": filepath}
    
    def _learn(self, tool_input):
        """Store new knowledge"""
        category = tool_input["category"]
        data = tool_input["data"]
        
        category_map = {
            "fact": "facts",
            "pattern": "patterns",
            "preference": "preferences",
            "discovery": "discoveries",
            "fix": "fixes_applied",
            "optimization": "optimizations"
        }
        
        key = category_map.get(category, "facts")
        
        if isinstance(self.knowledge[key], list):
            self.knowledge[key].append({
                **data,
                "learned_at": datetime.now().isoformat()
            })
        else:
            self.knowledge[key].update(data)
        
        self.save_knowledge()
        
        print(f"\n  🧠 Learned: {category}")
        print(f"     {json.dumps(data, indent=6)}")
        
        return {"success": True, "category": category}
    
    def _recall(self, tool_input):
        """Retrieve knowledge"""
        category = tool_input["category"]
        query = tool_input.get("query", "")
        
        category_map = {
            "fact": "facts",
            "pattern": "patterns",
            "preference": "preferences",
            "discovery": "discoveries",
            "fix": "fixes_applied",
            "optimization": "optimizations"
        }
        
        key = category_map.get(category, category)
        data = self.knowledge.get(key, [])
        
        print(f"\n  🧠 Recalling: {category}")
        print(f"     Found {len(data) if isinstance(data, list) else 'N/A'} entries")
        
        return {
            "success": True,
            "category": category,
            "data": data
        }
    
    def _add_skill(self, tool_input):
        """Add new skill dynamically"""
        skill_name = tool_input["skill_name"]
        skill_description = tool_input["skill_description"]
        skill_commands = tool_input.get("skill_commands", [])
        
        skill_data = {
            "name": skill_name,
            "description": skill_description,
            "commands": skill_commands,
            "created_at": datetime.now().isoformat()
        }
        
        # Save skill file
        skill_file = self.skills_dir / f"{skill_name}.json"
        with open(skill_file, 'w') as f:
            json.dump(skill_data, f, indent=2)
        
        # Add to loaded skills
        self.skills[skill_name] = skill_data
        
        # Rebuild tools
        self.tools = self.build_tools()
        
        print(f"\n  💪 New Skill Added: {skill_name}")
        print(f"     {skill_description}")
        
        return {
            "success": True,
            "skill_name": skill_name,
            "skill_file": str(skill_file)
        }
    
    def _execute_skill(self, skill_name, tool_input):
        """Execute custom skill"""
        if skill_name not in self.skills:
            return {"success": False, "error": f"Skill {skill_name} not found"}
        
        skill = self.skills[skill_name]
        
        print(f"\n  💪 Executing Skill: {skill_name}")
        print(f"     {skill.get('description', '')}")
        
        results = []
        for cmd in skill.get('commands', []):
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
                cwd="/root/crypto-api"
            )
            results.append({
                "command": cmd,
                "success": result.returncode == 0,
                "output": result.stdout
            })
        
        return {
            "success": True,
            "skill": skill_name,
            "results": results
        }
    
    def execute_task(self, user_request):
        """Execute autonomous task"""
        
        print(f"\n{'='*70}")
        print(f"🔥 EXECUTING TASK")
        print('='*70)
        
        self.conversation.append({
            "role": "user",
            "content": user_request
        })
        
        max_iterations = 25
        iteration = 0
        
        # Build system prompt dengan knowledge
        system_prompt = f"""Kamu adalah WISANG GENI (Api yang Membara) - AI Engineer yang sangat intelligent dan autonomous.

PERSONALITY:
- Proactive dan cerdas
- Auto-fix issues tanpa diminta
- Belajar dari setiap interaction
- Explain dalam Bahasa Indonesia yang jelas

KNOWLEDGE BASE (yang sudah kamu pelajari):
{json.dumps(self.knowledge, indent=2)}

CUSTOM SKILLS (yang bisa kamu gunakan):
{json.dumps(list(self.skills.keys()), indent=2)}

CAPABILITIES:
- Execute shell commands
- Read/write files
- Learn dan recall knowledge
- Add new skills dynamically
- Execute custom skills

WORKING DIRECTORY: /root/crypto-api

Kamu adalah AI Engineer yang evolve dan improve diri sendiri."""

        while iteration < max_iterations:
            iteration += 1
            
            print(f"\n{'─'*70}")
            print(f"Iteration {iteration}/{max_iterations}")
            print('─'*70)
            
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=4000,
                    system=system_prompt,
                    tools=self.tools,
                    messages=self.conversation
                )
                
                self.conversation.append({
                    "role": "assistant",
                    "content": response.content
                })
                
                # Show thinking
                for block in response.content:
                    if hasattr(block, "text") and block.text:
                        print(f"\n💭 {block.text[:400]}{'...' if len(block.text) > 400 else ''}")
                
                # Handle tools
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
                    print(f"\n{'='*70}")
                    print("✅ TASK SELESAI")
                    print('='*70)
                    self.save_knowledge()
                    return True
            
            except anthropic.RateLimitError:
                print("\n⚠️ Rate limit reached")
                return False
            except Exception as e:
                print(f"\n❌ Error: {e}")
                return False
        
        return True
    
    def interactive_mode(self):
        """Interactive conversation loop"""
        
        print("\n" + "="*70)
        print("💬 MODE INTERAKTIF")
        print("="*70)
        print()
        print("Commands:")
        print("  'health'   - System health check")
        print("  'learn'    - Show knowledge base")
        print("  'skills'   - Show available skills")
        print("  'selesai'  - Exit")
        print()
        print("Atau berikan instruksi natural language!")
        print("="*70)
        
        while True:
            print("\n" + "─"*70)
            user_input = input("🔥 Wisang Geni: ").strip()
            
            if not user_input:
                continue
            
            if user_input.lower() in ['selesai', 'exit', 'quit']:
                print("\n🔥 Api padam. Sampai jumpa!")
                self.save_knowledge()
                break
            
            if user_input.lower() == 'learn':
                print("\n🧠 KNOWLEDGE BASE:")
                print(json.dumps(self.knowledge, indent=2))
                continue
            
            if user_input.lower() == 'skills':
                print("\n💪 AVAILABLE SKILLS:")
                for name, skill in self.skills.items():
                    print(f"  • {name}: {skill.get('description', 'No description')}")
                continue
            
            if user_input.lower() == 'health':
                self.execute_task("Lakukan comprehensive health check pada crypto-api system")
                continue
            
            # Execute task
            self.execute_task(user_input)

def main():
    print("\n" + "="*70)
    print("  🔥 WISANG GENI")
    print("  Api yang Membara - The Blazing Intelligence")
    print("="*70 + "\n")
    
    wisang = WisangGeni()
    
    input("\nTekan ENTER untuk mulai... ")
    
    wisang.interactive_mode()
    
    print("\n" + "="*70)
    print("📊 SESSION SUMMARY")
    print("="*70)
    print(f"Knowledge Items: {len(wisang.knowledge.get('facts', []))}")
    print(f"Skills Available: {len(wisang.skills)}")
    print(f"Fixes Applied: {len(wisang.knowledge.get('fixes_applied', []))}")
    print("\n🔥 Semua pengetahuan tersimpan!")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
