#!/bin/bash

# Backup dulu
cp wisang_geni.py wisang_geni.py.broken.backup

# Fix line 791-792 yang rusak
python3 << 'PYTHON'
with open('wisang_geni.py', 'r') as f:
    lines = f.readlines()

# Fix line 791 (index 790) dan 792 (index 791)
if len(lines) > 791:
    # Cek apakah ada masalah
    if 'medium' in lines[790] and lines[790].strip().endswith('medium'):
        lines[790] = '        priority = tool_input.get("priority", "medium")\n'
    
    # Hapus line rusak jika ada
    if len(lines) > 791 and lines[791].strip() == '")':
        lines.pop(791)

# Write back
with open('wisang_geni.py', 'w') as f:
    f.writelines(lines)

print("✅ Fixed!")
PYTHON

echo "Testing syntax..."
python3 -m py_compile wisang_geni.py && echo "✅ Syntax OK!" || echo "❌ Still has errors"
