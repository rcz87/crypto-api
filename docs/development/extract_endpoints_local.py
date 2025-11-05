#!/usr/bin/env python3
"""
Local Endpoint Extractor - No API calls needed!

This script directly parses your TypeScript files to extract endpoint definitions.
Fast, efficient, and no rate limits.
"""
import re
import os
from pathlib import Path

def extract_endpoints_from_file(filepath):
    """
    Parse a TypeScript file and extract API endpoint definitions.
    
    This function looks for common patterns like:
    - router.get('/path', ...)
    - router.post('/path', ...)
    - app.get('/path', ...)
    etc.
    """
    endpoints = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
        
        # Pattern untuk mencari endpoint definitions
        # Matches: router.get('/path', ...) atau app.post('/api/path', ...)
        pattern = r"(router|app|gptRouter|gptActionsRouter)\.(\w+)\(['\"]([^'\"]+)['\"]"
        
        for i, line in enumerate(lines, 1):
            matches = re.finditer(pattern, line)
            for match in matches:
                router_name = match.group(1)
                http_method = match.group(2).upper()
                path = match.group(3)
                
                # Skip jika ini bukan HTTP method
                if http_method not in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']:
                    continue
                
                endpoints.append({
                    'file': filepath,
                    'line': i,
                    'method': http_method,
                    'path': path,
                    'router': router_name,
                    'code': line.strip()
                })
        
        return endpoints
    
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return []

def find_route_files(base_dir='./server'):
    """
    Find all potential route files in the server directory.
    """
    route_files = []
    
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith('.ts') or file.endswith('.js'):
                # Prioritize files with common route naming patterns
                if any(keyword in file.lower() for keyword in ['route', 'gpt', 'api', 'endpoint']):
                    route_files.insert(0, os.path.join(root, file))
                else:
                    route_files.append(os.path.join(root, file))
    
    return route_files

def analyze_gpt_specific(endpoints):
    """
    Identify which endpoints are likely GPT-specific based on patterns.
    """
    gpt_endpoints = []
    
    for endpoint in endpoints:
        is_gpt = False
        
        # Check berbagai indicators
        if '/gpt' in endpoint['path'].lower():
            is_gpt = True
        elif 'gptRouter' in endpoint['router'] or 'gptActions' in endpoint['router']:
            is_gpt = True
        elif 'gpts.ts' in endpoint['file']:
            is_gpt = True
        
        if is_gpt:
            endpoint['gpt_specific'] = True
            gpt_endpoints.append(endpoint)
        else:
            endpoint['gpt_specific'] = False
    
    return gpt_endpoints

def generate_report(all_endpoints, gpt_endpoints):
    """
    Generate a comprehensive markdown report.
    """
    report = []
    report.append("# Endpoint Discovery Report")
    report.append(f"\nGenerated: {os.popen('date').read().strip()}")
    report.append(f"\n## Summary")
    report.append(f"\n- **Total Endpoints Found:** {len(all_endpoints)}")
    report.append(f"- **GPT-Specific Endpoints:** {len(gpt_endpoints)}")
    report.append(f"- **General API Endpoints:** {len(all_endpoints) - len(gpt_endpoints)}")
    
    # Group by file
    files = {}
    for ep in all_endpoints:
        if ep['file'] not in files:
            files[ep['file']] = []
        files[ep['file']].append(ep)
    
    report.append(f"\n## Files Analyzed")
    for file, eps in files.items():
        report.append(f"\n### {file}")
        report.append(f"- Endpoints found: {len(eps)}")
    
    # GPT-Specific Endpoints Section
    if gpt_endpoints:
        report.append(f"\n## 🎯 GPT-Specific Endpoints ({len(gpt_endpoints)})")
        report.append("\nThese endpoints are specifically designed for GPT Actions integration:\n")
        
        for ep in sorted(gpt_endpoints, key=lambda x: (x['method'], x['path'])):
            report.append(f"\n### {ep['method']} {ep['path']}")
            report.append(f"- **File:** `{ep['file']}`")
            report.append(f"- **Line:** {ep['line']}")
            report.append(f"- **Router:** `{ep['router']}`")
            report.append(f"- **Code:** `{ep['code']}`")
    
    # All Endpoints Section
    report.append(f"\n## 📋 All Discovered Endpoints ({len(all_endpoints)})")
    report.append("\nComplete list of all endpoints found in the system:\n")
    
    # Group by HTTP method
    by_method = {}
    for ep in all_endpoints:
        if ep['method'] not in by_method:
            by_method[ep['method']] = []
        by_method[ep['method']].append(ep)
    
    for method in sorted(by_method.keys()):
        endpoints_list = by_method[method]
        report.append(f"\n### {method} Endpoints ({len(endpoints_list)})")
        
        for ep in sorted(endpoints_list, key=lambda x: x['path']):
            gpt_badge = " 🤖 GPT" if ep['gpt_specific'] else ""
            report.append(f"\n- **{ep['path']}**{gpt_badge}")
            report.append(f"  - File: `{ep['file']}:{ep['line']}`")
    
    # Testing Guide
    report.append("\n## 🧪 Testing Guide")
    report.append("\nTo test these endpoints, use curl with appropriate authentication:\n")
    report.append("```bash")
    report.append("# Get your API key from .env file")
    report.append("API_KEY=$(grep GPT_ACTIONS_API_KEY .env | cut -d '=' -f2)")
    report.append("")
    report.append("# Test a GPT endpoint")
    report.append('curl -H "X-API-Key: $API_KEY" http://localhost:5000/api/gpt/your-endpoint')
    report.append("```")
    
    # Recommendations
    report.append("\n## 💡 Recommendations")
    report.append("\n1. **Documentation:** Consider generating OpenAPI spec from these endpoints")
    report.append("2. **Testing:** Implement automated tests for GPT endpoints")
    report.append("3. **Monitoring:** Set up logging for GPT Action calls")
    report.append("4. **Security:** Ensure all GPT endpoints have proper authentication")
    
    return '\n'.join(report)

def main():
    print("=" * 70)
    print("  LOCAL ENDPOINT EXTRACTOR")
    print("  Fast extraction without API calls")
    print("=" * 70)
    print()
    
    # Find all route files
    print("🔍 Scanning for route files...")
    route_files = find_route_files('./server')
    print(f"   Found {len(route_files)} TypeScript/JavaScript files")
    print()
    
    # Extract endpoints from each file
    print("📝 Extracting endpoints...")
    all_endpoints = []
    
    for filepath in route_files:
        endpoints = extract_endpoints_from_file(filepath)
        if endpoints:
            print(f"   {filepath}: {len(endpoints)} endpoints")
            all_endpoints.extend(endpoints)
    
    print(f"\n✅ Total endpoints extracted: {len(all_endpoints)}")
    print()
    
    # Analyze for GPT-specific endpoints
    print("🤖 Identifying GPT-specific endpoints...")
    gpt_endpoints = analyze_gpt_specific(all_endpoints)
    print(f"   Found {len(gpt_endpoints)} GPT-specific endpoints")
    print()
    
    # Generate report
    print("📄 Generating report...")
    report = generate_report(all_endpoints, gpt_endpoints)
    
    # Save report
    report_file = 'endpoint-discovery-report.md'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"✅ Report saved to: {report_file}")
    print()
    
    # Display summary
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total Endpoints: {len(all_endpoints)}")
    print(f"GPT-Specific: {len(gpt_endpoints)}")
    print(f"General API: {len(all_endpoints) - len(gpt_endpoints)}")
    print()
    print(f"📖 Read full report: {report_file}")
    print()

if __name__ == "__main__":
    main()
