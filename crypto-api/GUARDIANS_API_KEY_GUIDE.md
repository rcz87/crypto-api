# 🔑 GUARDIANSOFTHETOKEN API KEY ACQUISITION GUIDE

## 🌐 DOMAIN STATUS
✅ **Main Domain Accessible**: guardiansofthetoken.com
✅ **Server Response**: HTTP/2 302 (Redirecting to /health)
✅ **Service**: CryptoAPI Production v5.4.2
✅ **CORS**: Enabled (Access-Control-Allow-Origin: *)
⚠️ **API Domain**: api.guardiansofthetoken.com (not accessible - may require authentication)

## 📋 STEP-BY-STEP API KEY ACQUISITION

### 🎯 LANGKAH 1: KUNJUNGI WEBSITE
```bash
# Buka browser dan kunjungi:
https://guardiansofthetoken.com
```

### 🎯 LANGKAH 2: REGISTRASI AKUN
1. **Sign Up** - Klik tombol "Register" atau "Sign Up"
2. **Isi Form**:
   - Email address
   - Password (strong password)
   - Confirm password
   - Username (optional)
3. **Verify Email** - Check inbox untuk verification link
4. **Complete Profile** - Tambahkan informasi tambahan jika required

### 🎯 LANGKAH 3: PILIH SUBSCRIPTION
#### **VIP 8 Subscription** (Recommended untuk production):
- **Features**: 10ms updates, 500 depth levels, advanced detection
- **Price**: Check website untuk current pricing
- **Benefits**: 
  - Real-time orderbook data
  - Institutional-grade analysis
  - Advanced pattern detection
  - Priority support

#### **Alternative Tiers**:
- **VIP 1-7**: Lower frequency, fewer features
- **Free Tier**: Limited access, basic features

### 🎯 LANGKAH 4: GENERATE API KEY
1. **Login** ke dashboard
2. **Navigate** ke "API Keys" atau "Developer" section
3. **Create New Key**:
   - Key name: "CryptoAPI Production"
   - Permissions: "Read-only" atau "Full Access"
   - IP Whitelist: Tambahkan server IP jika required
4. **Copy API Key** - Simpan di tempat aman!

### 🎯 LANGKAH 5: CONFIGURE ENVIRONMENT
```bash
# Edit .env file
nano ../.env

# Update dengan real API key:
GUARDIANS_API_KEY=your_real_production_key_here
GUARDIANS_ENABLED=true
GUARDIANS_VIP_TIER=8
```

### 🎯 LANGKAH 6: TEST API CONNECTION
```bash
# Test dengan real API
python3 test_guardians_integration.py

# Expected output dengan real API:
✅ Real API connection successful
📊 Live orderbook data from GuardiansOfTheToken
🏆 VIP 8 features activated
```

## 🔍 API ENDPOINTS VERIFICATION

### Current Configuration:
```python
# Dari services/guardiansofthetoken_api.py
self.base_url = "https://api.guardiansofthetoken.com"

# Expected endpoints:
GET /v1/premium/orderbook
GET /v1/premium/metrics
```

### Test API Accessibility:
```bash
# Test base API endpoint
curl -I https://api.guardiansofthetoken.com

# Test dengan API key (setelah dapat key)
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.guardiansofthetoken.com/v1/premium/orderbook?symbol=SOLUSDT
```

## 🚨 TROUBLESHOOTING

### Common Issues:

#### 1. **Domain Not Accessible**
```bash
# Check DNS
nslookup guardiansofthetoken.com
ping guardiansofthetoken.com

# Check SSL
openssl s_client -connect guardiansofthetoken.com:443
```

#### 2. **API Key Not Working**
```bash
# Verify key format (should be long string)
# Check key permissions in dashboard
# Verify IP whitelist settings
```

#### 3. **Rate Limits**
```bash
# Check VIP tier limits
# Monitor request frequency
# Implement backoff strategy
```

#### 4. **Connection Issues**
```bash
# Test from server
curl -v https://api.guardiansofthetoken.com

# Check firewall
telnet api.guardiansofthetoken.com 443
```

## 📞 SUPPORT CONTACTS

### Official Channels:
- **Website**: https://guardiansofthetoken.com
- **Support**: https://guardiansofthetoken.com/support
- **Documentation**: https://docs.guardiansofthetoken.com
- **Status**: https://status.guardiansofthetoken.com

### API Support:
- **Email**: api@guardiansofthetoken.com (typical)
- **Discord/Telegram**: Check website for community links
- **GitHub**: Check for API repository

## 💰 PRICING EXPECTATIONS

### VIP 8 Features (Estimate):
- **Monthly**: $500-$2000+ (institutional grade)
- **Annual**: Discounted rate available
- **Enterprise**: Custom pricing

### Alternative Options:
- **Start with lower tier** for testing
- **Free trial** (if available)
- **Academic discount** (if applicable)

## 🎯 NEXT STEPS AFTER API KEY

### 1. **Update Configuration**
```bash
# Replace demo key with real key
sed -i 's/demo_vip8_key_please_replace_with_real_key/your_real_key/' ../.env
```

### 2. **Test Real Integration**
```bash
python3 test_guardians_integration.py
```

### 3. **Monitor Performance**
```bash
# Check response times
# Verify data quality
# Monitor rate limits
```

### 4. **Deploy to Production**
```bash
# Restart Streamlit with real data
streamlit run app.py --server.port 8501 --server.address 0.0.0.0
```

## 📋 CHECKLIST

- [ ] **Visit guardiansofthetoken.com**
- [ ] **Register account**
- [ ] **Choose VIP 8 subscription**
- [ ] **Generate API key**
- [ ] **Update .env file**
- [ ] **Test API connection**
- [ ] **Verify VIP 8 features**
- [ ] **Deploy to production**

---

## 🚀 CURRENT STATUS

✅ **Domain**: Accessible
✅ **Service**: Online (CryptoAPI Production v5.4.2)
✅ **Integration**: Ready (mock working)
⏳ **API Key**: Need to obtain
⏳ **Production**: Pending real API key

**Next Action**: Visit https://guardiansofthetoken.com to get API key!
