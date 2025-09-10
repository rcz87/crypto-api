// services.ts — plug-and-play modules for Technical + Orderflow + DB persistence

// === Technical Service (LuxAlgo / RSI / EMA) ===
export interface TechnicalService {
  getSnapshot(symbol: string): Promise<{
    rsi: number;
    ema20: number;
    ema50: number;
    trend: "bullish" | "bearish" | "neutral" | "strong_bullish" | "strong_bearish";
    strength: number; // 0..1
  }>;
}

export class LuxAlgoTechnicalService implements TechnicalService {
  async getSnapshot(symbol: string) {
    // TODO: wire with LuxAlgo API / Binance feed
    return {
      rsi: 55,
      ema20: 212,
      ema50: 208,
      trend: "bullish",
      strength: 0.7,
    };
  }
}

// === Orderflow Service (CVD + Orderbook) ===
export interface OrderflowService {
  getCVD(symbol: string): Promise<{ ratio: number; dominant: "buy" | "sell" | "balanced" }>;
  getOrderbookImbalance(symbol: string): Promise<{ bidAskImb: number; largeWalls: number }>; // normalized
}

export class CoinglassOrderflowService implements OrderflowService {
  async getCVD(symbol: string) {
    // TODO: call Coinglass CVD endpoint
    return { ratio: 1.1, dominant: "buy" };
  }
  async getOrderbookImbalance(symbol: string) {
    // TODO: call Coinglass heatmap / OB endpoint
    return { bidAskImb: 0.12, largeWalls: 3 };
  }
}

// === DB Schema (Postgres) ===
/*
CREATE TABLE signals (
  signal_id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  ts TIMESTAMP NOT NULL,
  direction TEXT NOT NULL,
  confidence REAL,
  rr REAL
);

CREATE TABLE executions (
  exec_id SERIAL PRIMARY KEY,
  signal_id TEXT REFERENCES signals(signal_id),
  entry_price REAL,
  exit_price REAL,
  size REAL,
  return REAL,
  duration_hours REAL
);
*/

// === Execution Recorder API ===
export interface ExecutionResult {
  signal_id: string;
  entry_price: number;
  exit_price: number;
  size: number;
  return: number;
  duration_hours: number;
}

export class ExecutionRecorder {
  constructor(private db: any) {} // pass in pg client/knex

  async recordExecution(result: ExecutionResult) {
    await this.db.insert({
      signal_id: result.signal_id,
      entry_price: result.entry_price,
      exit_price: result.exit_price,
      size: result.size,
      return: result.return,
      duration_hours: result.duration_hours,
    }).into("executions");

    // Recalculate win_rate and update pattern accuracy dynamically
    const { rows } = await this.db.raw(
      `SELECT AVG(CASE WHEN return > 0 THEN 1 ELSE 0 END) AS win_rate FROM executions WHERE signal_id = ?`,
      [result.signal_id]
    );
    const winRate = rows[0].win_rate ?? 0.5;

    // TODO: update engine.patterns map with new accuracy
    return winRate;
  }
}

// === Telegram Notifier Adapter ===
export class TelegramNotifier {
  constructor(private botToken: string, private chatId: string) {}

  async notifySignal(signal: any) {
    const msg = `🚨 AI Signal ${signal.direction.toUpperCase()} ${signal.symbol}\n` +
      `Confidence: ${signal.confidence}% | Strength: ${signal.strength}\n` +
      `SL: ${signal.execution_details.stop_loss*100}% | TP: ${signal.execution_details.take_profit.map(tp => tp*100+"%").join(", ")}`;

    await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: this.chatId, text: msg })
    });
  }
}

// === Executor Adapter (OKX example) ===
export class OkxExecutor {
  constructor(private api: any) {}

  async execute(signal: any) {
    const { direction, execution_details } = signal;
    const size = execution_details.recommended_size;
    // Convert decimal SL/TP → absolute prices
    // Example for long:
    // entry = ticker.price
    // slPrice = entry * (1 - stop_loss)
    // tpPrice = entry * (1 + tpDecimal)
    // TODO: implement OKX API call
  }
}
