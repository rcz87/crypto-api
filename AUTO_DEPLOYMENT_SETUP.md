# 🚀 AUTO-DEPLOYMENT SETUP GUIDE

## Setup GitHub → VPS Auto-Deployment

### ✅ YANG SUDAH DIKONFIGURASI:

1. ✅ GitHub Actions workflow sudah ada (`.github/workflows/ci-cd.yml`)
2. ✅ SSH key khusus untuk GitHub Actions sudah dibuat
3. ✅ Public key sudah ditambahkan ke authorized_keys
4. ✅ Deployment script sudah dibuat (`deploy-from-github.sh`)

---

## 📋 LANGKAH SETUP (10 MENIT):

### Step 1: Add GitHub Secrets

Buka repository di GitHub → Settings → Secrets and variables → Actions → New repository secret

**Tambahkan 3 secrets berikut:**

#### Secret 1: `PRODUCTION_HOST`
```
Value: srv795356.ha.gcp.servers.koding.io
```
*(atau IP address VPS Anda)*

#### Secret 2: `PRODUCTION_USER`
```
Value: root
```

#### Secret 3: `PRODUCTION_SSH_KEY`
```
Value: <Copy private key dari bawah>
```

**🔑 PRIVATE KEY (COPY SELURUH TEXT INI):**
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACAIb2UyDM79g6qVN5FRv9l7ZWT9eO/pQcbKiNr+KFloOAAAAJjpN+P66Tfj
+gAAAAtzc2gtZWQyNTUxOQAAACAIb2UyDM79g6qVN5FRv9l7ZWT9eO/pQcbKiNr+KFloOA
AAAEByjSQ1uSHlf51y6uB5b/ebwLXICAypKSx0z16HbEl5ZwhvZTIMzv2DqpU3kVG/2Xtl
ZP147+lBxsqI2v4oWWg4AAAAFWdpdGh1Yi1hY3Rpb25zLWRlcGxveQ==
-----END OPENSSH PRIVATE KEY-----
```

#### Secret 4 (Optional): `PRODUCTION_URL`
```
Value: https://guardiansofthetoken.com
```
*(untuk health check setelah deployment)*

---

### Step 2: Update GitHub Actions Workflow

File `.github/workflows/ci-cd.yml` sudah dikonfigurasi untuk:
- ✅ Run tests pada setiap push
- ✅ Auto-deploy ke production saat push ke branch `main`
- ✅ Run health check setelah deployment

**Deployment akan terjadi otomatis saat:**
```bash
git push origin main
```

---

### Step 3: Test Auto-Deployment

Buat perubahan kecil dan push:

```bash
# Di local atau VPS
echo "# Test auto-deployment" >> README.md
git add README.md
git commit -m "test: auto-deployment"
git push origin main
```

**Cek progress di GitHub:**
1. Buka repository → Actions tab
2. Lihat workflow run berjalan
3. Tunggu sampai selesai (2-5 menit)

---

## 🔄 CARA KERJA AUTO-DEPLOYMENT:

```
┌──────────────┐
│  Git Push    │
│  to main     │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ GitHub Actions   │
│ Workflow Trigger │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Run Tests &      │
│ Build (CI)       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ SSH to VPS       │
│ Run Deploy Script│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ VPS Actions:     │
│ 1. git pull      │
│ 2. npm ci        │
│ 3. npm build     │
│ 4. pm2 reload    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Health Check     │
│ & Notification   │
└──────────────────┘
```

---

## 📝 DEPLOYMENT SCRIPT DETAILS:

File: `/root/crypto-api/deploy-from-github.sh`

```bash
#!/bin/bash
set -e

# Automated deployment steps:
1. Pull latest changes from GitHub
2. Install dependencies (npm ci)
3. Build application
4. Reload PM2 process
5. Health check
```

**Manual deployment (jika diperlukan):**
```bash
cd /root/crypto-api
./deploy-from-github.sh
```

---

## 🎯 WORKFLOW YANG TERSEDIA:

### 1. Auto-Deploy on Push to Main
- **Trigger:** Push ke branch `main`
- **Actions:**
  - Lint & type check
  - Run tests
  - Build application
  - Deploy to production
  - Health check

### 2. PR Checks (develop branch)
- **Trigger:** Pull request ke `main` atau `develop`
- **Actions:**
  - Lint & type check
  - Run tests
  - Build verification
  - Security scan

### 3. Manual Deploy
- **Trigger:** Manual workflow dispatch
- **Usage:** GitHub → Actions → CI/CD Pipeline → Run workflow

---

## ⚙️ KONFIGURASI BRANCH STRATEGY:

```
main (production)
├── Auto-deploy enabled ✅
├── Requires: passing tests
└── Health check mandatory

develop (staging)
├── Auto-deploy to staging (optional)
├── Pre-production testing
└── Merge to main via PR
```

---

## 🔒 SECURITY BEST PRACTICES:

1. ✅ Dedicated SSH key (tidak share dengan keys lain)
2. ✅ Key disimpan sebagai GitHub Secret (encrypted)
3. ✅ Deployment hanya dari main branch
4. ✅ Health check setelah deployment
5. ✅ PM2 graceful reload (zero downtime)

---

## 📊 MONITORING DEPLOYMENT:

### Cek Deployment History:
```bash
# Di GitHub
Repository → Actions → CI/CD Pipeline

# Di VPS
pm2 logs crypto-api --lines 50
```

### Rollback (jika diperlukan):
```bash
cd /root/crypto-api
git log --oneline -10  # Cari commit yang baik
git reset --hard <commit-hash>
pm2 reload ecosystem.config.cjs
```

---

## 🎉 KEUNTUNGAN AUTO-DEPLOYMENT:

✅ **Zero Manual Effort:** Push → Auto deploy
✅ **Consistent:** Selalu pakai deployment script yang sama
✅ **Fast:** 2-5 menit dari push sampai live
✅ **Safe:** Tests run before deployment
✅ **Traceable:** Full deployment history di GitHub
✅ **Zero Downtime:** PM2 graceful reload

---

## 🆘 TROUBLESHOOTING:

### Deployment gagal?
1. Cek GitHub Actions logs
2. Verifikasi SSH connection: `ssh root@srv795356.ha.gcp.servers.koding.io`
3. Test deployment script manual: `./deploy-from-github.sh`

### Health check failed?
1. Cek PM2 status: `pm2 list`
2. Cek logs: `pm2 logs crypto-api`
3. Manual restart: `pm2 restart crypto-api`

### SSH connection refused?
1. Verifikasi GitHub Secrets
2. Test SSH key: `ssh -i ~/.ssh/github_actions_deploy root@<host>`
3. Cek authorized_keys: `cat ~/.ssh/authorized_keys`

---

## 📚 RESOURCES:

- GitHub Actions Docs: https://docs.github.com/en/actions
- PM2 Deployment: https://pm2.keymetrics.io/docs/usage/deployment/
- SSH Actions: https://github.com/appleboy/ssh-action

---

**Setup by:** Cline AI Assistant  
**Date:** 2025-10-24  
**Status:** ✅ Ready for Production
