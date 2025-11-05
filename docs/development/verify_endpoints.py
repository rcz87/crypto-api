#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os, sys, re, time, csv, json
from typing import Dict, Any, List, Tuple, Set
import requests

try:
    import yaml  # pip install pyyaml
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyyaml"])
    import yaml

# =========================
# CONFIG (ubah kalau perlu)
# =========================
BASE_URL = os.environ.get("BASE_URL", "https://guardiansofthegreentoken.com").rstrip("/")
RAW_YAML = os.environ.get("RAW_YAML", "https://raw.githubusercontent.com/rcz87/crypto-api/main/public/openapi-4.0.1-gpts-compat.yaml")
TIMEOUT_GET = int(os.environ.get("TIMEOUT_GET", "15"))
TIMEOUT_POST = int(os.environ.get("TIMEOUT_POST", "25"))

# 🎯 STRICT MODE Configuration (Enhanced CI)
STRICT_MODE = os.environ.get("STRICT_MODE", "false").lower() in ("true", "1", "yes")
GENERATE_ARTIFACTS = os.environ.get("GENERATE_ARTIFACTS", "true").lower() in ("true", "1", "yes")
ARTIFACTS_DIR = os.environ.get("ARTIFACTS_DIR", "artifacts")
MAX_FAILURES = int(os.environ.get("MAX_FAILURES", "3"))  # Max failures before exit in strict mode

# Optional auth
X_API_KEY     = os.environ.get("X_API_KEY", "").strip()
AUTH_BEARER   = os.environ.get("AUTH_BEARER", "").strip()

DEFAULTS = {
    "pair":   "sol",      # ← Fixed: lowercase untuk /api/{pair}/* paths
    "symbol": "SOL",      # ← Symbol untuk query parameters 
    "asset":  "SOL",
}

HEADERS = {}
if X_API_KEY:
    HEADERS["X-API-Key"] = X_API_KEY
if AUTH_BEARER:
    HEADERS["Authorization"] = f"Bearer {AUTH_BEARER}"

# =========================
# Enhanced HTTP with Strict Validation
# =========================
def http_get(path: str) -> Tuple[int, int, str, Dict[str, Any]]:
    """Enhanced HTTP GET with response body parsing"""
    url = BASE_URL + path
    t0 = time.time()
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT_GET)
        ms = int((time.time() - t0) * 1000)
        
        # Parse response body if JSON
        response_data = {}
        try:
            response_data = r.json() if r.content else {}
        except:
            response_data = {"raw_text": r.text[:500]}
            
        return r.status_code, ms, (r.text or "")[:200].replace("\n", " "), response_data
    except requests.Timeout:
        return -1, TIMEOUT_GET*1000, "TIMEOUT", {}
    except Exception as e:
        return -2, 0, f"ERROR: {type(e).__name__}: {str(e)[:160]}", {}

def http_post(path: str, payload: Dict[str, Any]) -> Tuple[int, int, str, Dict[str, Any]]:
    """Enhanced HTTP POST with response body parsing"""
    url = BASE_URL + path
    t0 = time.time()
    try:
        r = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT_POST)
        ms = int((time.time() - t0) * 1000)
        
        # Parse response body if JSON
        response_data = {}
        try:
            response_data = r.json() if r.content else {}
        except:
            response_data = {"raw_text": r.text[:500]}
            
        return r.status_code, ms, (r.text or "")[:200].replace("\n", " "), response_data
    except requests.Timeout:
        return -1, TIMEOUT_POST*1000, "TIMEOUT", {}
    except Exception as e:
        return -2, 0, f"ERROR: {type(e).__name__}: {str(e)[:160]}", {}

# =========================
# Strict Response Validation
# =========================
def validate_response_strict(path: str, status: int, response_data: Dict[str, Any]) -> Dict[str, Any]:
    """Strict validation of API response structure and content"""
    validation = {
        "valid": True,
        "errors": [],
        "warnings": [],
        "score": 100
    }
    
    # Basic HTTP status validation
    if status < 200 or status >= 300:
        if status == 404:
            validation["errors"].append(f"404 Not Found - endpoint may not exist")
            validation["score"] -= 50
        elif status == 429:
            validation["warnings"].append(f"429 Rate Limited - consider throttling")
            validation["score"] -= 20
        elif status >= 500:
            validation["errors"].append(f"5xx Server Error - critical infrastructure issue")
            validation["score"] -= 80
        else:
            validation["errors"].append(f"Non-2xx status: {status}")
            validation["score"] -= 30
    
    # Response structure validation
    if not response_data:
        validation["warnings"].append("Empty response body")
        validation["score"] -= 10
    else:
        # Check for standard response fields
        if "success" in response_data:
            if not response_data.get("success"):
                validation["errors"].append("Response indicates failure (success=false)")
                validation["score"] -= 40
        elif "ok" in response_data:
            if not response_data.get("ok"):
                validation["errors"].append("Response indicates failure (ok=false)")
                validation["score"] -= 40
        else:
            validation["warnings"].append("No success/ok field in response")
            validation["score"] -= 5
            
        # Check for error fields
        if "error" in response_data and response_data["error"]:
            validation["errors"].append(f"Error in response: {response_data['error']}")
            validation["score"] -= 30
            
        # Check for data field
        if "data" not in response_data and "/health" not in path:
            validation["warnings"].append("No 'data' field in response")
            validation["score"] -= 10
            
        # GPT Actions specific validation
        if "/gpts/" in path:
            if "timestamp" not in response_data:
                validation["warnings"].append("GPT Actions missing timestamp")
                validation["score"] -= 5
                
        # Health endpoint specific validation
        if "/health" in path:
            if "status" not in response_data:
                validation["errors"].append("Health endpoint missing status field")
                validation["score"] -= 20
    
    validation["score"] = max(0, validation["score"])
    validation["valid"] = len(validation["errors"]) == 0 and validation["score"] >= 70
    
    return validation

# =========================
# Artifacts Generation
# =========================
def generate_artifacts(results: List[Dict[str, Any]], artifacts_dir: str):
    """Generate comprehensive test artifacts for CI/CD"""
    os.makedirs(artifacts_dir, exist_ok=True)
    
    # 1. Detailed JSON report
    report = {
        "test_run": {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "base_url": BASE_URL,
            "total_tests": len(results),
            "passed": len([r for r in results if r.get("validation", {}).get("valid", False)]),
            "failed": len([r for r in results if not r.get("validation", {}).get("valid", False)]),
            "strict_mode": STRICT_MODE
        },
        "results": results,
        "summary": {
            "core12_status": {},
            "critical_failures": [],
            "warnings": []
        }
    }
    
    # Core 12 analysis
    core12_paths = [ep["path"] for ep in CORE12]
    for result in results:
        path = result.get("path", "")
        if path in core12_paths:
            validation = result.get("validation", {})
            report["summary"]["core12_status"][path] = {
                "valid": validation.get("valid", False),
                "score": validation.get("score", 0),
                "status": result.get("status", 0)
            }
    
    # Critical failures
    for result in results:
        validation = result.get("validation", {})
        if not validation.get("valid", False) and validation.get("score", 0) < 50:
            report["summary"]["critical_failures"].append({
                "path": result.get("path", ""),
                "status": result.get("status", 0),
                "errors": validation.get("errors", [])
            })
    
    # Save JSON report
    with open(f"{artifacts_dir}/test_report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    # 2. CSV for spreadsheet analysis
    csv_path = f"{artifacts_dir}/test_results.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["method", "path", "status", "latency_ms", "valid", "score", "errors", "warnings"])
        for r in results:
            validation = r.get("validation", {})
            writer.writerow([
                r.get("method", ""),
                r.get("path", ""),
                r.get("status", 0),
                r.get("latency_ms", 0),
                validation.get("valid", False),
                validation.get("score", 0),
                "; ".join(validation.get("errors", [])),
                "; ".join(validation.get("warnings", []))
            ])
    
    # 3. CI-friendly summary
    passed = report["test_run"]["passed"]
    total = report["test_run"]["total_tests"]
    core12_passed = len([v for v in report["summary"]["core12_status"].values() if v["valid"]])
    
    summary_path = f"{artifacts_dir}/summary.txt"
    with open(summary_path, "w") as f:
        f.write(f"# Endpoint Verification Summary\n\n")
        f.write(f"**Total Tests:** {total}\n")
        f.write(f"**Passed:** {passed}\n")
        f.write(f"**Failed:** {total - passed}\n")
        f.write(f"**Success Rate:** {passed/total*100:.1f}%\n\n")
        f.write(f"**Core 12 Status:** {core12_passed}/12 PASSED\n\n")
        
        if report["summary"]["critical_failures"]:
            f.write(f"## Critical Failures ({len(report['summary']['critical_failures'])})\n\n")
            for failure in report["summary"]["critical_failures"][:5]:  # Top 5
                f.write(f"- `{failure['path']}` - {failure['status']} - {'; '.join(failure['errors'][:2])}\n")
    
    print(f"📋 Artifacts generated in: {artifacts_dir}/")
    print(f"   - test_report.json (detailed)")
    print(f"   - test_results.csv (spreadsheet)")
    print(f"   - summary.txt (CI summary)")
    
    return report

# =========================
# OpenAPI loader & extractor
# =========================
def load_openapi_yaml(raw_url: str) -> Dict[str, Any]:
    r = requests.get(raw_url, timeout=20)
    r.raise_for_status()
    return yaml.safe_load(r.text)

def extract_paths(openapi_obj: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    paths = openapi_obj.get("paths", {}) or {}
    for raw_path, methods in paths.items():
        if not isinstance(methods, dict): 
            continue
        for method, meta in methods.items():
            if method.lower() in ("get","post","put","delete","patch","options","head"):
                out.append({
                    "method": method.upper(),
                    "path": raw_path,
                    "operationId": (meta or {}).get("operationId", ""),
                    "summary": (meta or {}).get("summary", ""),
                })
    return out

# =========================
# Param substitution
# =========================
def fill_path_params(path: str) -> str:
    # Replace {pair}, {symbol}, etc.
    def repl_curly(m):
        key = m.group(1).lower()
        if "pair" in key:   return DEFAULTS["pair"].lower()  # ← Ensure lowercase
        if "symbol" in key: return DEFAULTS["symbol"]
        if "asset" in key:  return DEFAULTS["asset"]
        return key  # fallback
    # Support <symbol> or {symbol}
    p = re.sub(r"<([^>]+)>", lambda m: repl_curly(type("M", (), {"group": lambda _,x: m.group(x)}) ), path)
    p = re.sub(r"{([^}]+)}", repl_curly, p)
    return p

# Alias rules (karena YAML vs prod kadang beda prefix)
def alias_paths(path: str) -> List[str]:
    candidates = {path}
    # /py/advanced/*  →  /advanced/*
    if path.startswith("/py/advanced/"):
        candidates.add(path.replace("/py/advanced/", "/advanced/"))
    # /sol/* → fallback pasangan /api/sol/* jika YAML beda
    if path.startswith("/sol/"):
        candidates.add("/api" + path)
    # /gpts/* (tanpa /api) → coba versi /api/gpts/*
    if path.startswith("/gpts/"):
        candidates.add("/api" + path)
    # /api/gpts/* → coba /gpts/*
    if path.startswith("/api/gpts/"):
        candidates.add(path.replace("/api", ""))
    return list(candidates)

# =========================
# Core 12 (tambahan luar YAML)
# =========================
CORE12 = [
    # GPT Actions (confirmed working)
    {"method":"GET", "path":"/gpts/health"},
    {"method":"GET", "path":"/gpts/unified/symbols"},
    
    # Core API endpoints (dari YAML real)
    {"method":"GET", "path":"/api/pairs/supported"},
    {"method":"GET", "path":f"/api/{DEFAULTS['pair']}/complete"},
    {"method":"GET", "path":f"/api/{DEFAULTS['pair']}/technical"},
    {"method":"GET", "path":f"/api/{DEFAULTS['pair']}/funding"},
    {"method":"GET", "path":f"/api/{DEFAULTS['pair']}/smc"},
    {"method":"GET", "path":f"/api/{DEFAULTS['pair']}/cvd"},
    
    # AI endpoints (dengan throttling)
    {"method":"GET", "path":"/api/ai/signal"},
    {"method":"GET", "path":"/api/ai/enhanced-signal"},
    
    # System health & premium
    {"method":"GET", "path":"/health"},
    {"method":"GET", "path":"/api/premium/institutional-analytics"}
]

# =========================
# AI Throttling untuk mencegah 429 errors
# =========================
HEAVY_ENDPOINTS = ("/api/ai/signal", "/api/ai/enhanced-signal", "/gpts/unified/advanced", "/api/ai/")
last_heavy_ts = 0

def maybe_throttle(path: str):
    """Add throttling for AI/heavy endpoints"""
    global last_heavy_ts
    if any(x in path for x in HEAVY_ENDPOINTS):
        gap = time.time() - last_heavy_ts
        if gap < 12:  # 12 second gap between AI calls
            print(f"🐌 Throttling {path}: waiting {12-gap:.1f}s...")
            time.sleep(12 - gap)
        last_heavy_ts = time.time()

# =========================
# Probe runner
# =========================
def classify(status: int) -> str:
    if isinstance(status, int):
        if 200 <= status < 300: return "✅"
        if status in (400,401,403,404,405): return "⚠️"
        return "❌"
    return "❌"

def main():
    print(f"=== 🎯 ENHANCED ENDPOINT VERIFICATION @ {BASE_URL} ===")
    print(f"- YAML: {RAW_YAML}")
    print(f"- Auth: {'X-API-Key' if X_API_KEY else ''} {'Bearer' if AUTH_BEARER else ''}".strip() or "None")
    print(f"- STRICT MODE: {'ENABLED' if STRICT_MODE else 'DISABLED'}")
    print(f"- ARTIFACTS: {'ENABLED' if GENERATE_ARTIFACTS else 'DISABLED'}")
    print(f"- MAX FAILURES: {MAX_FAILURES}")
    print("Loading OpenAPI YAML...")
    
    failure_count = 0
    
    try:
        spec = load_openapi_yaml(RAW_YAML)
        yaml_eps = extract_paths(spec)
    except Exception as e:
        print(f"WARNING: gagal memuat YAML: {e}")
        yaml_eps = []

    # Build test list = YAML endpoints + Core12 (union; GET/POST guess)
    tests: List[Dict[str, Any]] = []

    # 1) From YAML
    for ep in yaml_eps:
        method = ep["method"]
        path   = fill_path_params(ep["path"])
        # heuristik: tambahkan query minimal untuk beberapa path umum
        if method == "GET":
            tests.append({"method":"GET","path":path})
        elif method == "POST":
            # payload minimal default
            payload = {}
            if "market-data" in path:
                payload = {"symbol":DEFAULTS["symbol"], "tf":"1h", "limit":100}
            elif "analysis" in path and "smc" not in path:
                payload = {"symbol":DEFAULTS["symbol"], "tf":"4h"}
            elif "smc-analysis" in path:
                payload = {"symbol":DEFAULTS["symbol"], "tfs":["5m","15m","1h"], "features":["BOS","CHOCH","OB","FVG","LIQ_SWEEP"]}
            elif "smc-zones" in path:
                payload = {"symbol":DEFAULTS["symbol"], "tfs":["5m","15m","1h"]}
            tests.append({"method":"POST","path":path,"json":payload})
        else:
            tests.append({"method":method,"path":path})

    # 2) Add Core12 (even if missing in YAML)
    # Avoid duplicates by path+method signature
    seen = {(t["method"], t["path"]) for t in tests}
    for t in CORE12:
        sig = (t["method"], t["path"])
        if sig not in seen:
            tests.append(t)
            seen.add(sig)

    # Execute probes with alias fallback
    results: List[Dict[str, Any]] = []
    for i, t in enumerate(tests, 1):
        method = t["method"]
        raw_path = t["path"]
        # split query if embedded
        if "?" in raw_path and method == "GET":
            path_only, qs = raw_path.split("?", 1)
            path_variants = alias_paths(path_only)
            path_variants = [p + "?" + qs for p in path_variants]
        else:
            path_variants = alias_paths(raw_path)

        status, latency, snippet, response_data, final_path = None, None, None, {}, None
        # try variants until one returns non-error/timeout
        for pv in path_variants:
            # Add throttling for AI endpoints
            maybe_throttle(pv)
            
            if method == "GET":
                s, ms, snip, resp_data = http_get(pv)
            elif method == "POST":
                s, ms, snip, resp_data = http_post(pv, t.get("json", {}))
                # Special-case: jika POST 405, coba GET (kadang API beda implementasi)
                if s == 405:
                    s2, ms2, snip2, resp_data2 = http_get(pv)
                    if isinstance(s2, int): 
                        s, ms, snip, resp_data = s2, ms2, snip2, resp_data2
            else:
                s, ms, snip, resp_data = http_get(pv)  # fallback
            status, latency, snippet, response_data, final_path = s, ms, snip, resp_data, pv
            # break if we got any HTTP code (even 404), we record first tried alias
            break

        # Strict validation if enabled
        validation = {}
        if STRICT_MODE:
            validation = validate_response_strict(final_path, status, response_data)
            
            # Early exit if too many failures in strict mode
            if not validation.get("valid", False):
                failure_count += 1
                if failure_count >= MAX_FAILURES:
                    print(f"\n🚨 STRICT MODE: {failure_count} failures reached. Exiting early.")
                    break

        result = {
            "no": i,
            "method": method,
            "path": final_path,
            "status": status,
            "latency_ms": latency,
            "snippet": snippet,
            "response_data": response_data,
            "validation": validation
        }
        results.append(result)
        
        # Real-time progress with validation info
        emoji = classify(status)
        valid_emoji = ""
        if STRICT_MODE:
            valid_emoji = "✓" if validation.get("valid", False) else "✗"
            score = validation.get("score", 0)
            print(f"{emoji} {valid_emoji} [{i:2d}/{len(tests)}] {method:4s} {final_path} → {status} ({latency}ms) Score:{score}")
        else:
            print(f"{emoji} [{i:2d}/{len(tests)}] {method:4s} {final_path} → {status} ({latency}ms)")

    # Enhanced Summaries with Strict Mode
    ok = sum(1 for r in results if isinstance(r["status"], int) and 200 <= r["status"] < 300)
    warn = sum(1 for r in results if r["status"] in (400,401,403,404,405))
    err = len(results) - ok - warn
    
    # Strict mode validation summary
    strict_passed = strict_failed = 0
    if STRICT_MODE:
        strict_passed = sum(1 for r in results if r.get("validation", {}).get("valid", False))
        strict_failed = len(results) - strict_passed

    print("\n=== 📊 ENHANCED SUMMARY ===")
    print(f"Total tested: {len(results)} | ✅ {ok}  ⚠️ {warn}  ❌ {err}")
    
    if STRICT_MODE:
        print(f"Strict validation: {strict_passed} PASSED | {strict_failed} FAILED")
        avg_score = sum(r.get("validation", {}).get("score", 0) for r in results) / len(results) if results else 0
        print(f"Average quality score: {avg_score:.1f}/100")
    
    # Core 12 specific analysis
    core12_paths = [ep["path"] for ep in CORE12]
    core12_results = [r for r in results if r.get("path", "") in core12_paths]
    core12_passed = sum(1 for r in core12_results if 200 <= r.get("status", 0) < 300)
    
    print(f"Core 12 endpoints: {core12_passed}/{len(CORE12)} PASSED")
    
    # Generate artifacts if enabled
    report = None
    if GENERATE_ARTIFACTS:
        try:
            report = generate_artifacts(results, ARTIFACTS_DIR)
        except Exception as e:
            print(f"⚠️ Failed to generate artifacts: {e}")

    # Markdown table
    print("\n=== RESULTS (Markdown) ===")
    if STRICT_MODE:
        print("| No | Method | Path | Status | Latency | Valid | Score | Errors |")
        print("|---:|:------:|:-----|:------:|-------:|:-----:|:-----:|:-------|")
    else:
        print("| No | Method | Path | Status | Latency | Note |")
        print("|---:|:------:|:-----|:------:|-------:|:-----|")
    for r in results[:120]:  # avoid flooding
        st = r["status"]
        mark = classify(st)
        st_disp = st if isinstance(st,int) else str(st)
        note = ""
        if st == 404:
            note = "Route not found (cek prefix /gpts vs /api/gpts)."
        elif st == 405:
            note = "Method not allowed (cek GET vs POST)."
        elif st in (401,403):
            note = "Auth needed (set X-API-Key/Bearer)."
        elif isinstance(st,int) and st >= 500:
            note = "Server error (cek upstream logs)."
        elif st in (-1, -2):
            note = r["snippet"][:80]
        print(f"| {r['no']} | {r['method']} | `{r['path']}` | {mark} {st_disp} | {r['latency_ms']} ms | {note} |")

    # Save CSV
    try:
        os.makedirs("tools/testers", exist_ok=True)
        with open("tools/testers/probe_results.csv","w",newline="",encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["no","method","path","status","latency_ms","snippet"])
            for r in results:
                w.writerow([r["no"], r["method"], r["path"], r["status"], r["latency_ms"], r["snippet"]])
        print("\nSaved: tools/testers/probe_results.csv")
    except Exception as e:
        print(f"CSV save failed: {e}")

    # Enhanced CI Exit Codes
    exit_code = 0
    if STRICT_MODE:
        # Strict mode: fail if any validation failures or too many HTTP errors
        if strict_failed > 0:
            print(f"\n❌ STRICT MODE FAILURE: {strict_failed} validation failures")
            exit_code = 1
        elif core12_passed < 10:  # At least 10/12 core endpoints must pass
            print(f"\n❌ CORE 12 FAILURE: Only {core12_passed}/12 passed (minimum: 10)")
            exit_code = 2
        elif err > 3:  # More than 3 HTTP errors
            print(f"\n❌ HTTP ERROR THRESHOLD: {err} errors (maximum: 3)")
            exit_code = 3
        else:
            print(f"\n✅ STRICT MODE: All validations passed!")
    else:
        # Standard mode: fail only on critical issues
        if err > len(results) // 2:  # More than 50% errors
            print(f"\n❌ HIGH ERROR RATE: {err}/{len(results)} failed")
            exit_code = 1
        elif core12_passed < 8:  # At least 8/12 core endpoints must pass
            print(f"\n❌ CORE 12 FAILURE: Only {core12_passed}/12 passed (minimum: 8)")
            exit_code = 2

    # Action checklist
    print("\n=== ACTION CHECKLIST ===")
    print("- [ ] 404 → kemungkinan blueprint belum ter-register / prefix beda (/gpts vs /api/gpts).")
    print("- [ ] 405 → method mismatch (ubah handler atau ikuti method di schema).")
    print("- [ ] 401/403 → set header auth: X-API-Key/Authorization Bearer.")
    print("- [ ] 5xx/timeout → cek log FastAPI/Express & upstream provider (OKX/CoinGlass).")

    print(f"\n=== 🎯 VERIFICATION COMPLETE ===")
    print(f"Exit code: {exit_code}")
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()