/**
 * 🧠 Institutional Bias Alert System
 * Combines whale activity, ETF flows, and market sentiment for trading signals
 */

import fetch from "node-fetch";

const PY_BASE = process.env.PY_BASE || "http://localhost:5000/py";
const TG_URL = process.env.TELEGRAM_WEBHOOK_URL;

/**
 * 🎯 Institutional Bias Alert Logic:
 * Whale Buy (≥$1M) + ETF Inflow > 0 + Sentiment ≥ 60 → LONG bias alert
 */
export async function runInstitutionalBiasAlert() {
  try {
    console.log("🔍 Running Institutional Bias Analysis...");
    
    // Parallel fetch of all required data
    const [whaleData, etfData, sentimentData] = await Promise.all([
      fetchWithRetry(`${PY_BASE}/advanced/whale/alerts?symbol=BTC`),
      fetchWithRetry(`${PY_BASE}/advanced/etf/flows?asset=BTC`),
      fetchWithRetry(`${PY_BASE}/advanced/market/sentiment`)
    ]);

    // Analyze whale activity
    const whaleEvents = whaleData?.events || [];
    const whaleBuyLarge = whaleEvents.some(event => 
      event.side === "buy" && 
      (event.usd_size || 0) >= 1_000_000
    );
    
    // Analyze ETF flows
    const etfInflow = (etfData?.today?.net_inflow_usd || 0) > 0;
    const inflowAmount = Math.round(etfData?.today?.net_inflow_usd || 0);
    
    // Analyze sentiment
    const sentimentScore = sentimentData?.score || 50;
    const sentimentOK = sentimentScore >= 60;

    console.log(`📊 Bias Check: Whale=${whaleBuyLarge}, ETF=${etfInflow}, Sentiment=${sentimentScore}`);

    // Trigger LONG bias alert if all conditions met
    if (whaleBuyLarge && etfInflow && sentimentOK) {
      const alertMsg = `🟢 INSTITUTIONAL LONG BIAS (BTC)

🐋 Whale Activity: ≥$1M BUY detected
💰 ETF Net Inflow: $${inflowAmount.toLocaleString()} USD  
📈 Market Sentiment: ${sentimentScore}/100

⏱️ Next: Check liquidation heatmap & spot orderbook for precise entry levels.

#InstitutionalBias #BTC #LongSetup`;

      await sendTelegramAlert(alertMsg);
      console.log("✅ Institutional LONG bias alert sent!");
      return { bias: "LONG", triggered: true, reason: "All conditions met" };
    }

    // Check for SHORT bias (opposite conditions)
    const whaleSellLarge = whaleEvents.some(event => 
      event.side === "sell" && 
      (event.usd_size || 0) >= 1_000_000
    );
    const etfOutflow = (etfData?.today?.net_inflow_usd || 0) < -500_000;
    const sentimentBear = sentimentScore <= 40;

    if (whaleSellLarge && etfOutflow && sentimentBear) {
      const alertMsg = `🔴 INSTITUTIONAL SHORT BIAS (BTC)

🐋 Whale Activity: ≥$1M SELL detected
💸 ETF Net Outflow: $${Math.abs(inflowAmount).toLocaleString()} USD
📉 Market Sentiment: ${sentimentScore}/100

⏱️ Next: Check liquidation clusters above for short entry zones.

#InstitutionalBias #BTC #ShortSetup`;

      await sendTelegramAlert(alertMsg);
      console.log("✅ Institutional SHORT bias alert sent!");
      return { bias: "SHORT", triggered: true, reason: "Bearish conditions met" };
    }

    console.log("📊 No institutional bias trigger - conditions not met");
    return { bias: "NEUTRAL", triggered: false };

  } catch (error) {
    console.error("❌ Institutional Bias Alert Error:", error.message);
    return { error: error.message };
  }
}

/**
 * 🎯 SOL-specific Sniper Timing Alert
 */
export async function runSOLSniperAlert() {
  try {
    console.log("🎯 Running SOL Sniper Analysis...");
    
    const [btcWhale, solWhale, etfData, solHeatmap, solOrderbook] = await Promise.all([
      fetchWithRetry(`${PY_BASE}/advanced/whale/alerts?symbol=BTC`),
      fetchWithRetry(`${PY_BASE}/advanced/whale/alerts?symbol=SOL`),
      fetchWithRetry(`${PY_BASE}/advanced/etf/flows?asset=BTC`),
      fetchWithRetry(`${PY_BASE}/advanced/liquidation/heatmap/SOL?timeframe=1h`),
      fetchWithRetry(`${PY_BASE}/advanced/spot/orderbook/SOL?exchange=binance`)
    ]);

    const hasBTCWhaleBuy = (btcWhale?.events || []).some(e => e.side === "buy" && e.usd_size >= 1_000_000);
    const hasSOLWhaleBuy = (solWhale?.events || []).some(e => e.side === "buy" && e.usd_size >= 500_000);
    const hasETFInflow = (etfData?.today?.net_inflow_usd || 0) > 0;
    
    // Check liquidation clusters near current price (within 0.5%)
    const hasNearLiquidation = (solHeatmap?.heatmap || []).some(level => 
      Math.abs(level.price_distance_pct) < 0.5 && level.size_usd > 1_000_000
    );
    
    // Check orderbook for large support wall
    const orderbook = solOrderbook?.orderbook || { bids: [], asks: [] };
    const topBids = orderbook.bids.slice(0, 5);
    const avgBidSize = topBids.reduce((sum, bid) => sum + (bid[1] || 0), 0) / topBids.length;
    const hasLargeSupport = topBids.some(bid => (bid[1] || 0) > avgBidSize * 5);

    if ((hasBTCWhaleBuy || hasSOLWhaleBuy) && hasETFInflow && hasNearLiquidation && hasLargeSupport) {
      const alertMsg = `🎯 SOL SNIPER TIMING ALERT

🐋 Whale Activity: ${hasBTCWhaleBuy ? 'BTC' : 'SOL'} large buy detected
💰 BTC ETF Inflow: Positive (spillover effect)
🔥 Liquidation Cluster: <0.5% from current price  
🏛️ Support Wall: Large bids detected

⚡ 5M Entry Setup Ready - Check TradingView for precise levels

#SOLSniper #EntryTiming #5MinSetup`;

      await sendTelegramAlert(alertMsg);
      console.log("✅ SOL Sniper timing alert sent!");
      return { symbol: "SOL", timing: "SNIPER", triggered: true };
    }

    return { symbol: "SOL", timing: "NEUTRAL", triggered: false };

  } catch (error) {
    console.error("❌ SOL Sniper Alert Error:", error.message);
    return { error: error.message };
  }
}

/**
 * 🔄 Fetch with retry and timeout
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        return await response.json();
      }
      
      if (i === retries - 1) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      clearTimeout(timeout);
      
      if (i === retries - 1) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

/**
 * 📱 Send Telegram Alert
 */
async function sendTelegramAlert(message) {
  if (!TG_URL) {
    console.log("📱 Telegram URL not configured - alert logged only");
    console.log("📢 ALERT:", message);
    return;
  }

  try {
    const response = await fetch(TG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message })
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }

    console.log("📱 Telegram alert sent successfully");
  } catch (error) {
    console.error("📱 Telegram alert failed:", error.message);
    // Log alert locally as fallback
    console.log("📢 FALLBACK ALERT:", message);
  }
}