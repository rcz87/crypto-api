#!/bin/bash
# Replit Cleanup Script - Safe Migration to VPS
# Run: bash cleanup_replit.sh

set -e  # Exit on error

echo "======================================================================="
echo "  REPLIT CLEANUP SCRIPT"
echo "  Safe removal of all Replit references"
echo "======================================================================="
echo ""

# Create backup
BACKUP_DIR=".migration-backup-$(date +%Y%m%d-%H%M%S)"
echo "[1/6] Creating backup: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup files that will be modified
cp package.json "$BACKUP_DIR/" 2>/dev/null || true
cp .replit "$BACKUP_DIR/" 2>/dev/null || true
cp replit.md "$BACKUP_DIR/" 2>/dev/null || true
cp server/index.ts "$BACKUP_DIR/" 2>/dev/null || true
cp server/index-dev.ts "$BACKUP_DIR/" 2>/dev/null || true
cp client/src/lib/env.ts "$BACKUP_DIR/" 2>/dev/null || true

echo "[+] Backup created in $BACKUP_DIR"
echo ""

# Step 2: Remove Replit config files
echo "[2/6] Removing Replit configuration files"
rm -f .replit
rm -f replit.md
rm -f replit.nix
echo "[+] Deleted .replit, replit.md, replit.nix"
echo ""

# Step 3: Clean package.json
echo "[3/6] Cleaning package.json"
if [ -f "package.json" ]; then
    # Remove @replit dependencies
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Remove @replit dependencies
    if (pkg.dependencies) {
        Object.keys(pkg.dependencies).forEach(dep => {
            if (dep.startsWith('@replit/')) {
                delete pkg.dependencies[dep];
            }
        });
    }
    
    if (pkg.devDependencies) {
        Object.keys(pkg.devDependencies).forEach(dep => {
            if (dep.startsWith('@replit/')) {
                delete pkg.devDependencies[dep];
            }
        });
    }
    
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    " && echo "[+] Removed @replit/* dependencies from package.json"
fi
echo ""

# Step 4: Update server/index.ts
echo "[4/6] Updating server/index.ts"
if [ -f "server/index.ts" ]; then
    sed -i.bak \
        -e "s/\\.replit\\.dev/$(hostname)/g" \
        -e "s/'unsafe-eval' 'unsafe-inline' https:\\/\\/\\*\\.replit\\.dev//g" \
        -e "s/https:\\/\\/\\*\\.replit\\.dev//g" \
        server/index.ts
    rm -f server/index.ts.bak
    echo "[+] Updated server/index.ts"
fi
echo ""

# Step 5: Update client/src/lib/env.ts
echo "[5/6] Updating client/src/lib/env.ts"
if [ -f "client/src/lib/env.ts" ]; then
    sed -i.bak \
        -e "s/replit\\.dev/production/g" \
        -e "s/isReplit/isProduction/g" \
        client/src/lib/env.ts
    rm -f client/src/lib/env.ts.bak
    echo "[+] Updated client/src/lib/env.ts"
fi
echo ""

# Step 6: Summary
echo "[6/6] Generating summary"
echo ""
echo "======================================================================="
echo "  CLEANUP COMPLETE!"
echo "======================================================================="
echo ""
echo "[+] Backup location: $BACKUP_DIR"
echo "[+] Files modified:"
echo "    - package.json (removed @replit dependencies)"
echo "    - server/index.ts (updated CORS & CSP)"
echo "    - client/src/lib/env.ts (updated environment detection)"
echo ""
echo "[+] Files deleted:"
echo "    - .replit"
echo "    - replit.md"
echo "    - replit.nix"
echo ""
echo "[!] NEXT STEPS:"
echo "    1. Run: npm install"
echo "    2. Rebuild: npm run build"
echo "    3. Restart: pm2 restart crypto-api"
echo "    4. Test: curl http://localhost:5000/gpts/health"
echo ""
echo "To rollback: cp $BACKUP_DIR/* ./"
echo "======================================================================="
