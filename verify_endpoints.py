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
# Helper: HTTP
# =========================
def http_get(path: str) -> Tuple[int, int, str]:
    url = BASE_URL + path
    t0 = time.time()
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT_GET)
        ms = int((time.time() - t0) * 1000)
        return r.status_code, ms, (r.text or "")[:200].replace("\n", " ")
    except requests.Timeout:
        return -1, TIMEOUT_GET*1000, "TIMEOUT"
    except Exception as e:
        return -2, 0, f"ERROR: {type(e).__name__}: {str(e)[:160]}"

def http_post(path: str, payload: Dict[str, Any]) -> Tuple[int, int, str]:
    url = BASE_URL + path
    t0 = time.time()
    try:
        r = requests.post(url, json=payload, headers=HEADERS, timeout=TIMEOUT_POST)
        ms = int((time.time() - t0) * 1000)
        return r.status_code, ms, (r.text or "")[:200].replace("\n", " ")
    except requests.Timeout:
        return -1, TIMEOUT_POST*1000, "TIMEOUT"
    except Exception as e:
        return -2, 0, f"ERROR: {type(e).__name__}: {str(e)[:160]}"

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
    print(f"=== VERIFY ENDPOINTS @ {BASE_URL} ===")
    print(f"- YAML: {RAW_YAML}")
    print(f"- Auth: {'X-API-Key' if X_API_KEY else ''} {'Bearer' if AUTH_BEARER else ''}".strip() or "None")
    print("Loading OpenAPI YAML...")
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

        status, latency, snippet, final_path = None, None, None, None
        # try variants until one returns non-error/timeout
        for pv in path_variants:
            # Add throttling for AI endpoints
            maybe_throttle(pv)
            
            if method == "GET":
                s, ms, snip = http_get(pv)
            elif method == "POST":
                s, ms, snip = http_post(pv, t.get("json", {}))
                # Special-case: jika POST 405, coba GET (kadang API beda implementasi)
                if s == 405:
                    s2, ms2, snip2 = http_get(pv)
                    if isinstance(s2, int): s, ms, snip = s2, ms2, snip2
            else:
                s, ms, snip = http_get(pv)  # fallback
            status, latency, snippet, final_path = s, ms, snip, pv
            # break if we got any HTTP code (even 404), we record first tried alias
            break

        results.append({
            "no": i,
            "method": method,
            "path": final_path,
            "status": status,
            "latency_ms": latency,
            "snippet": snippet
        })

    # Summaries
    ok = sum(1 for r in results if isinstance(r["status"], int) and 200 <= r["status"] < 300)
    warn = sum(1 for r in results if r["status"] in (400,401,403,404,405))
    err = len(results) - ok - warn

    print("\n=== TL;DR ===")
    print(f"Total tested: {len(results)} | ✅ {ok}  ⚠️ {warn}  ❌ {err}")

    # Markdown table
    print("\n=== RESULTS (Markdown) ===")
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

    # Action checklist
    print("\n=== ACTION CHECKLIST ===")
    print("- [ ] 404 → kemungkinan blueprint belum ter-register / prefix beda (/gpts vs /api/gpts).")
    print("- [ ] 405 → method mismatch (ubah handler atau ikuti method di schema).")
    print("- [ ] 401/403 → set header auth: X-API-Key/Authorization Bearer.")
    print("- [ ] 5xx/timeout → cek log FastAPI/Express & upstream provider (OKX/CoinGlass).")

if __name__ == "__main__":
    main()