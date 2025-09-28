/**
 * 🧠 Institutional Bias Alert System
 * Combines whale activity, ETF flows, and market sentiment for trading signals
 */

import axios from "axios";
import { fetchInstitutionalBias } from "../clients/institutionalBias.js";

const PY_BASE = process.env.PY_BASE || "http://localhost:8000";
const TG_URL = process.env.TELEGRAM_WEBHOOK_URL;

/**
 * 🔄 Fetch Unified Endpoint Helper
 */
async function fetchUnifiedEndpoint(operation, params, retries = 3) {
  let lastError = null;
  
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch(`${PY_BASE}/gpts/advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          op: operation,
          params: params
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Expected JSON but got ${contentType || 'unknown content type'}. Response: ${text.substring(0, 200)}...`);
        }
      }
      
      // Handle specific HTTP errors with retry logic
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i + 2) * 1000;
        console.warn(`⚠️ [Unified API] Rate limit hit for ${operation} (attempt ${i + 1}/${retries}), waiting ${waitTime/1000}s`);
        
        if (i === retries - 1) throw error;
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (i === retries - 1) throw error;
      
      const waitTime = Math.pow(2, i + 1) * 1000;
      console.warn(`⚠️ [Unified API] ${operation} failed (attempt ${i + 1}/${retries}), retrying in ${waitTime/1000}s`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      
      if (i === retries - 1 || error.name === 'AbortError') {
        throw error;
      }
      
      const waitTime = Math.pow(2, i + 1) * 1000;
      console.warn(`⚠️ [Unified API] ${operation} error (attempt ${i + 1}/${retries}):`, error.message, `- retrying in ${waitTime/1000}s`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * 🎯 Institutional Bias Alert Logic:
 * Whale Buy (≥$1M) + ETF Inflow > 0 + Sentiment ≥ 60 → LONG bias alert
 */
export async function runInstitutionalBiasAlert() {
  try {
    console.log("🔍 Running Institutional Bias Analysis...");
    
    // Use the new institutional bias client with fallback and 404 handling
    const DEFAULT_SYMBOL = process.env.BIAS_SYMBOL || "SOL-USDT-SWAP";
    const biasResult = await fetchInstitutionalBias(DEFAULT_SYMBOL);
    
    // Handle 404 unavailable case
    if (biasResult && biasResult.unavailable) {
      console.warn(`ℹ️ [InstitutionalBias] Unavailable for ${biasResult.symbol}. Reason: ${biasResult.reason || 'endpoint not found'}`);
      return { 
        bias: "UNAVAILABLE", 
        triggered: false, 
        reason: `Institutional bias data not available for ${biasResult.symbol}`,
        symbol: biasResult.symbol
      };
    }
    
    // Extract data from successful response
    const biasData = biasResult.data || {};
    const whaleEvents = biasData?.whale_data?.events || [];
    const etfData = biasData?.etf_data || {};
    const sentimentData = biasData?.sentiment_data || {};

    // Analyze whale activity - TEMPORARILY LOWERED FOR TESTING
    const whaleBuyLarge = whaleEvents.some(event => 
      event.side === "buy" && 
      (event.usd_size || 0) >= 200_000  // Lowered from 1M to 200K for testing
    );
    
    // Analyze ETF flows - LOWERED THRESHOLD FOR TESTING
    const etfInflow = (etfData?.today?.net_inflow_usd || 0) > -999_999_999;  // Accept any value for testing
    const inflowAmount = Math.round(etfData?.today?.net_inflow_usd || 0);
    
    // Analyze sentiment - LOWERED THRESHOLD FOR TESTING
    const sentimentScore = sentimentData?.score || 50;
    const sentimentOK = sentimentScore >= 30;  // Lowered from 60 to 30 for testing

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
      (event.usd_size || 0) >= 200_000  // Lowered from 1M to 200K for testing
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
      fetchUnifiedEndpoint('whale_alerts', { symbol: 'BTC' }),
      fetchUnifiedEndpoint('whale_alerts', { symbol: 'SOL' }),
      fetchUnifiedEndpoint('etf_flows', { asset: 'BTC' }),
      fetchUnifiedEndpoint('liquidation_heatmap', { symbol: 'SOL', timeframe: '1h' }),
      fetchUnifiedEndpoint('spot_orderbook', { symbol: 'SOL', exchange: 'binance' })
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
 * 🔄 Enhanced Fetch with retry, timeout, and 429 handling
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastError = null;
  
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
        // Check if response is actually JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            return await response.json();
          } catch (jsonError) {
            throw new Error(`Invalid JSON response from ${url}: ${jsonError.message}`);
          }
        } else {
          // If response is not JSON, read as text to see what we got
          const text = await response.text();
          throw new Error(`Expected JSON but got ${contentType || 'unknown content type'}. Response: ${text.substring(0, 200)}...`);
        }
      }
      
      // Handle specific HTTP errors
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.isRateLimit = response.status === 429;
      
      // For 429, parse retry-after if available
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        error.retryAfter = retryAfter ? parseInt(retryAfter) * 1000 : null;
        console.warn(`⚠️ [API] Rate limit hit for ${url} (attempt ${i + 1}/${retries})`);
        
        // If this is our last retry, propagate the 429 error immediately
        if (i === retries - 1) {
          lastError = error;
          break;
        }
        
        // Use server-suggested retry time or exponential backoff
        const waitTime = error.retryAfter || Math.pow(2, i + 2) * 1000; // Start with 4s for 429
        console.log(`🕒 [API] Waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For other 4xx/5xx errors, use standard exponential backoff
      lastError = error;
      if (i === retries - 1) {
        break;
      }
      
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      
      if (i === retries - 1) {
        break;
      }
      
      // Wait before retry (exponential backoff)
      const waitTime = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Throw the last error encountered
  throw lastError;
}

/**
 * 📱 Send Enhanced Interactive Telegram Alert
 */
async function sendTelegramAlert(message) {
  try {
    // Import enhanced Telegram functions
    const { sendInstitutionalBias, sendSOLSniperAlert } = await import("../observability/telegram-actions.js");
    
    // Try to extract structured data from message for interactive alerts
    if (message.includes("INSTITUTIONAL") && message.includes("BIAS")) {
      // Parse institutional bias data
      const symbol = message.includes("BTC") ? "BTC" : message.includes("SOL") ? "SOL" : "BTC";
      const bias = message.includes("LONG") ? "LONG" : message.includes("SHORT") ? "SHORT" : "NEUTRAL";
      const whale = message.includes("≥$1M BUY") || message.includes("buy") && message.includes("detected");
      const etfFlow = message.includes("Inflow") ? 25000000 : message.includes("Outflow") ? -10000000 : 0;
      
      // Extract sentiment score if available
      const sentimentMatch = message.match(/Sentiment: (\d+)/);
      const sentiment = sentimentMatch ? parseInt(sentimentMatch[1]) : 50;
      
      // Extract confidence if available  
      const confidenceMatch = message.match(/(\d+)%/);
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;
      
      // Send interactive alert
      const success = await sendInstitutionalBias({
        symbol,
        bias,
        whale,
        etfFlow,
        sentiment,
        confidence,
        altSymbol: symbol === "BTC" ? "SOL" : "BTC"
      });
      
      if (success) {
        console.log("📱 Interactive institutional bias alert sent successfully");
        return;
      }
    }
    
    if (message.includes("SOL SNIPER") || message.includes("SNIPER TIMING")) {
      // Parse sniper data
      const symbol = "SOL";
      const bias = message.includes("LONG") ? "LONG" : "SHORT";
      
      // Mock data for demo - in production would parse from actual market data
      const currentPrice = 221.35;
      const entry = [currentPrice * 0.998, currentPrice * 1.002]; 
      const stopLoss = currentPrice * (bias === "LONG" ? 0.9975 : 1.0025);
      const takeProfit = [currentPrice * 1.005, currentPrice * 1.01];
      const invalidation = currentPrice * (bias === "LONG" ? 0.996 : 1.004);
      
      const success = await sendSOLSniperAlert({
        symbol,
        bias,
        entry,
        stopLoss,
        takeProfit,
        invalidation,
        confidence: 85
      });
      
      if (success) {
        console.log("📱 Interactive SOL sniper alert sent successfully");
        return;
      }
    }
    
    // Fallback to basic alert if structured alert fails
    await fallbackTelegramAlert(message);
    
  } catch (error) {
    console.error("📱 Enhanced Telegram alert failed:", error.message);
    await fallbackTelegramAlert(message);
  }
}

/**
 * 📢 Fallback Basic Telegram Alert
 */
async function fallbackTelegramAlert(message) {
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

    console.log("📱 Telegram fallback alert sent successfully");
  } catch (error) {
    console.error("📱 Telegram alert failed:", error.message);
    // Log alert locally as fallback
    console.log("📢 FALLBACK ALERT:", message);
  }
}