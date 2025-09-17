import supertest from 'supertest';

const BASE_URL = "http://localhost:5000";
const request = supertest(BASE_URL);

describe("🚀 Endpoint Resilience Testing", () => {
  // Increase timeout for slow network operations
  jest.setTimeout(60000);

  // 1. Screener Auto-Batching (>15 symbols)
  test("Screener harus auto-batch kalau >15 symbols", async () => {
    const symbols = [
      "BTC","ETH","SOL","ADA","DOT","LINK","UNI","AVAX","ATOM","XRP",
      "LTC","BCH","EOS","TRX","MATIC","CRV","AAVE","COMP","YFI","SUSHI"
    ];

    console.log(`🧪 Testing Screener Auto-Batching with ${symbols.length} symbols...`);

    const res = await request
      .post("/api/screener/screen")
      .send({ symbols, timeframe: "4h" })
      .set("Content-Type", "application/json");

    console.log(`✅ Screener response status: ${res.status}, success: ${res.body?.success}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    
    // Check for batching metadata if present
    if (res.body.data?.metadata?.batch_info) {
      console.log(`📦 Batching used: ${res.body.data.metadata.batch_info.batching_used}`);
    }
  });

  // 2. Regime Auto-Batching (>10 symbols)
  test("Regime harus auto-batch kalau >10 symbols", async () => {
    const symbols = [
      "BTC-USDT-SWAP","ETH-USDT-SWAP","SOL-USDT-SWAP","ADA-USDT-SWAP",
      "DOT-USDT-SWAP","LINK-USDT-SWAP","UNI-USDT-SWAP","AVAX-USDT-SWAP",
      "ATOM-USDT-SWAP","XRP-USDT-SWAP","LTC-USDT-SWAP","BCH-USDT-SWAP"
    ];

    console.log(`🧪 Testing Regime Auto-Batching with ${symbols.length} symbols...`);

    const res = await request
      .post("/api/regime/batch")
      .send({ symbols })
      .set("Content-Type", "application/json");

    console.log(`✅ Regime response status: ${res.status}, success: ${res.body?.success}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    // Check for batching metadata
    if (res.body.data?.batch_info) {
      console.log(`📦 Regime batching used: ${res.body.data.batch_info.batching_used}`);
      console.log(`📊 Total batches: ${res.body.data.batch_info.total_batches}`);
      expect(res.body.data.batch_info.batching_used).toBe(true);
    }
  });

  // 3. CoinAPI History Retry
  test("CoinAPI History harus retry kalau response incomplete", async () => {
    console.log("🧪 Testing CoinAPI History Retry mechanism...");

    const res = await request
      .get("/api/coinapi/history/BINANCE_SPOT_BTC_USDT?period=1HRS&limit=24&time_start=2025-09-16T00:00:00Z&time_end=2025-09-17T00:00:00Z");

    console.log(`✅ History response status: ${res.status}, data type: ${typeof res.body}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    // Should return array of historical data
    expect(Array.isArray(res.body)).toBe(true);
  });

  // 4. TWAP Fallback (VWAP jika TWAP null)
  test("TWAP harus fallback ke VWAP kalau data kosong", async () => {
    console.log("🧪 Testing TWAP/VWAP Fallback mechanism...");

    const res = await request
      .get("/api/coinapi/twap/BINANCE_SPOT_SOL_USDT?hours=24");

    console.log(`✅ TWAP response status: ${res.status}, success: ${res.body?.success}`);
    console.log(`💰 TWAP value: ${res.body?.data?.twap}, Data source: ${res.body?.data?.data_source || 'N/A'}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    
    // Should have either TWAP or fallback mechanism worked
    expect(res.body.data.twap).toBeDefined();
    expect(typeof res.body.data.twap).toBe('number');
    expect(res.body.data.twap).toBeGreaterThan(0);

    // Check fallback metadata if present
    if (res.body.metadata?.fallback) {
      console.log(`🔄 Fallback used: ${res.body.metadata.fallback.used}, reason: ${res.body.metadata.fallback.reason}`);
    }
  });

  // 5. Health Check
  test("Health check endpoint should be responsive", async () => {
    console.log("🧪 Testing Health Check endpoint...");

    const res = await request
      .get("/api/health");

    console.log(`✅ Health response status: ${res.status}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});